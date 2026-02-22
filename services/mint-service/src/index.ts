import express from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { createLogger, format, transports } from "winston";
import dotenv from "dotenv";

dotenv.config();

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new transports.Console()],
});

const app = express();
app.use(express.json());

// In-memory request store (use Redis/PostgreSQL in production)
const requests = new Map<string, MintRequest>();

type MintRequestStatus =
  | "pending"
  | "verifying"
  | "executing"
  | "completed"
  | "failed";

interface MintRequest {
  id: string;
  type: "mint" | "burn";
  recipient?: string;
  fromAccount?: string;
  amount: string;
  mint: string;
  status: MintRequestStatus;
  txSignature?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const MintSchema = z.object({
  recipient: z.string(),
  amount: z.string(),
  mint: z.string(),
});

const BurnSchema = z.object({
  fromAccount: z.string(),
  amount: z.string(),
  mint: z.string(),
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mint-service",
    timestamp: new Date().toISOString(),
    requests: requests.size,
  });
});

// POST /api/mint — Fiat-to-stablecoin lifecycle
app.post("/api/mint", async (req, res) => {
  try {
    const data = MintSchema.parse(req.body);
    const requestId = uuidv4();

    const request: MintRequest = {
      id: requestId,
      type: "mint",
      recipient: data.recipient,
      amount: data.amount,
      mint: data.mint,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    requests.set(requestId, request);
    logger.info("Mint request created", {
      requestId,
      recipient: data.recipient,
      amount: data.amount,
    });

    // Async processing
    processMintRequest(requestId, data).catch((err) => {
      logger.error("Mint processing failed", {
        requestId,
        error: err.message,
      });
      const r = requests.get(requestId);
      if (r) {
        r.status = "failed";
        r.error = err.message;
        r.updatedAt = new Date().toISOString();
      }
    });

    res.status(202).json({ requestId, status: "pending" });
  } catch (err: any) {
    logger.error("Mint request validation failed", { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/burn
app.post("/api/burn", async (req, res) => {
  try {
    const data = BurnSchema.parse(req.body);
    const requestId = uuidv4();

    const request: MintRequest = {
      id: requestId,
      type: "burn",
      fromAccount: data.fromAccount,
      amount: data.amount,
      mint: data.mint,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    requests.set(requestId, request);
    logger.info("Burn request created", {
      requestId,
      fromAccount: data.fromAccount,
      amount: data.amount,
    });

    res.status(202).json({ requestId, status: "pending" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/requests/:id
app.get("/api/requests/:id", (req, res) => {
  const request = requests.get(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }
  res.json(request);
});

// GET /api/requests
app.get("/api/requests", (_req, res) => {
  res.json(Array.from(requests.values()).slice(-100));
});

async function processMintRequest(
  requestId: string,
  data: z.infer<typeof MintSchema>
): Promise<void> {
  const request = requests.get(requestId)!;

  // Step 1: Verify (KYC check, fiat confirmation)
  request.status = "verifying";
  request.updatedAt = new Date().toISOString();
  logger.info("Verifying mint request", { requestId });

  await new Promise((r) => setTimeout(r, 100));

  // Step 2: Execute on-chain
  request.status = "executing";
  request.updatedAt = new Date().toISOString();
  logger.info("Executing mint on-chain", { requestId });

  // In production: call SolanaStablecoin.mint()
  // const stable = await SolanaStablecoin.load(connection, mint, minterKeypair);
  // const tx = await stable.mint({ recipient, amount, minter });

  // Step 3: Complete
  request.status = "completed";
  request.txSignature = "simulated_tx_" + requestId;
  request.updatedAt = new Date().toISOString();
  logger.info("Mint completed", {
    requestId,
    txSignature: request.txSignature,
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Mint service running on port ${PORT}`);
});

export default app;
