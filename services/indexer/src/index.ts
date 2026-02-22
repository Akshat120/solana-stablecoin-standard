import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";
import { createLogger, format, transports } from "winston";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const logger = createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

const app = express();
app.use(express.json());

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.removeHeader("X-Powered-By");
  next();
});

// Off-chain event store (use PostgreSQL in production)
interface IndexedEvent {
  type: string;
  slot: number;
  timestamp: string;
  signature?: string;
  raw: string;
}

const events: IndexedEvent[] = [];

const PROGRAM_ID = new PublicKey(
  process.env.STABLECOIN_PROGRAM_ID ||
    "STBLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
);
const RPC_URL =
  process.env.RPC_URL || "https://api.devnet.solana.com";
const RAW_WEBHOOK_URL = process.env.WEBHOOK_URL;

// Validate the WEBHOOK_URL points to a non-private host to prevent SSRF
function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname;
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /^0\.0\.0\.0$/,
    ];
    return !privatePatterns.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

const WEBHOOK_URL: string | undefined =
  RAW_WEBHOOK_URL && isSafeUrl(RAW_WEBHOOK_URL)
    ? RAW_WEBHOOK_URL
    : undefined;

if (RAW_WEBHOOK_URL && !WEBHOOK_URL) {
  logger.warn("WEBHOOK_URL was rejected (private/invalid address). Webhook delivery disabled.");
}

async function startIndexer() {
  const connection = new Connection(RPC_URL, "confirmed");

  logger.info("Starting indexer", {
    programId: PROGRAM_ID.toString(),
    rpc: RPC_URL,
  });

  connection.onLogs(
    PROGRAM_ID,
    async (logs, ctx) => {
      logger.debug("Received logs", { slot: ctx.slot, signature: logs.signature, err: logs.err });

      if (logs.err) return;

      const event = parseEventFromLogs(
        logs.logs,
        ctx.slot,
        logs.signature
      );
      if (event) {
        events.push(event);
        logger.info("Event indexed", event);

        if (WEBHOOK_URL) {
          sendWebhook(event).catch((err) =>
            logger.error("Webhook failed", { error: err.message })
          );
        }
      } else {
        logger.debug("No matching event in logs", { logs: logs.logs });
      }
    },
    "confirmed"
  );

  logger.info("Indexer subscribed to program logs");
}

// Maps Anchor instruction log strings → event type names
const INSTRUCTION_EVENT_MAP: Record<string, string> = {
  "Instruction: Initialize":          "StablecoinInitialized",
  "Instruction: MintTokens":          "TokensMinted",
  "Instruction: BurnTokens":          "TokensBurned",
  "Instruction: FreezeAccount":       "AccountFrozen",
  "Instruction: ThawAccount":         "AccountThawed",
  "Instruction: AddToBlacklist":      "AddedToBlacklist",
  "Instruction: RemoveFromBlacklist": "RemovedFromBlacklist",
  "Instruction: SeizeTokens":         "TokensSeized",
  "Instruction: Pause":               "StablecoinPaused",
  "Instruction: Unpause":             "StablecoinUnpaused",
  "Instruction: UpdateMinter":        "MinterUpdated",
  "Instruction: UpdateRoles":         "RolesUpdated",
  "Instruction: TransferAuthority":   "AuthorityTransferred",
};

function parseEventFromLogs(
  logs: string[],
  slot: number,
  signature: string
): IndexedEvent | null {
  for (const log of logs) {
    for (const [instruction, eventType] of Object.entries(INSTRUCTION_EVENT_MAP)) {
      if (log.includes(instruction)) {
        return {
          type: eventType,
          slot,
          signature,
          timestamp: new Date().toISOString(),
          raw: log,
        };
      }
    }
  }
  return null;
}

async function sendWebhook(event: IndexedEvent): Promise<void> {
  if (!WEBHOOK_URL) return;
  await axios.post(WEBHOOK_URL, event, {
    headers: { "Content-Type": "application/json" },
    timeout: 5000,
  });
}

// GET /health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "indexer",
    eventsIndexed: events.length,
    programId: PROGRAM_ID.toString(),
  });
});

// GET /api/events
app.get("/api/events", (req, res) => {
  const { type, limit = "100" } = req.query;
  let filtered = events;
  if (type) {
    filtered = events.filter((e) => e.type === type);
  }
  res.json(filtered.slice(-parseInt(limit as string)));
});

// GET /api/events/count
app.get("/api/events/count", (_req, res) => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }
  res.json(counts);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  logger.info(`Indexer running on port ${PORT}`);
  await startIndexer();
});
