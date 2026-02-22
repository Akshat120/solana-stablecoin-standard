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

const app = express();
app.use(express.json());

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
const WEBHOOK_URL = process.env.WEBHOOK_URL;

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
