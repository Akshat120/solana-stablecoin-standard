import express from "express";
import { createLogger, format, transports } from "winston";
import { z } from "zod";
import dotenv from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenv.config();

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const app = express();
app.use(express.json());

// Audit log store (use PostgreSQL/S3 in production)
interface AuditEntry {
  id: string;
  timestamp: string;
  action:
    | "blacklist_add"
    | "blacklist_remove"
    | "seize"
    | "freeze"
    | "sanctions_check";
  address: string;
  details: Record<string, any>;
  operator: string;
  txSignature?: string;
  riskScore?: number;
}

const auditLog: AuditEntry[] = [];

const ScreeningSchema = z.object({
  address: z.string(),
});

const AuditEntrySchema = z.object({
  action: z.enum([
    "blacklist_add",
    "blacklist_remove",
    "seize",
    "freeze",
    "sanctions_check",
  ]),
  address: z.string(),
  details: z.record(z.any()).optional(),
  operator: z.string().optional(),
  txSignature: z.string().optional(),
  riskScore: z.number().optional(),
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "compliance",
    auditEntries: auditLog.length,
  });
});

// POST /api/screen — Sanctions screening integration point
app.post("/api/screen", async (req, res) => {
  try {
    const { address } = ScreeningSchema.parse(req.body);

    try {
      new PublicKey(address);
    } catch {
      return res.status(400).json({ error: "Invalid Solana address" });
    }

    const result = await performSanctionsCheck(address);

    auditLog.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: "sanctions_check",
      address,
      details: result,
      operator:
        (req.headers["x-operator-id"] as string) || "system",
      riskScore: result.riskScore,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/audit — Log a compliance action
app.post("/api/audit", (req, res) => {
  try {
    const data = AuditEntrySchema.parse(req.body);
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: data.action,
      address: data.address,
      details: data.details || {},
      operator:
        data.operator ||
        (req.headers["x-operator-id"] as string) ||
        "unknown",
      txSignature: data.txSignature,
      riskScore: data.riskScore,
    };

    auditLog.push(entry);
    logger.info("Audit entry recorded", entry);
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/audit — Export audit log
app.get("/api/audit", (req, res) => {
  const {
    action,
    address,
    fromDate,
    toDate,
    limit = "100",
  } = req.query;

  let filtered = [...auditLog];

  if (action) {
    filtered = filtered.filter((e) => e.action === action);
  }
  if (address) {
    filtered = filtered.filter((e) => e.address === address);
  }
  if (fromDate) {
    const from = new Date(fromDate as string);
    filtered = filtered.filter((e) => new Date(e.timestamp) >= from);
  }
  if (toDate) {
    const to = new Date(toDate as string);
    filtered = filtered.filter((e) => new Date(e.timestamp) <= to);
  }

  res.json({
    entries: filtered.slice(-parseInt(limit as string)),
    total: filtered.length,
    exportedAt: new Date().toISOString(),
  });
});

// GET /api/audit/export.csv — CSV export
app.get("/api/audit/export.csv", (_req, res) => {
  const csv = [
    "id,timestamp,action,address,operator,txSignature,riskScore",
    ...auditLog.map(
      (e) =>
        `${e.id},${e.timestamp},${e.action},${e.address},${e.operator},${
          e.txSignature || ""
        },${e.riskScore || ""}`
    ),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=audit-log.csv"
  );
  res.send(csv);
});

// GET /api/risk/:address — Risk assessment
app.get("/api/risk/:address", async (req, res) => {
  try {
    new PublicKey(req.params.address);
  } catch {
    return res.status(400).json({ error: "Invalid address" });
  }

  const result = await performSanctionsCheck(req.params.address);
  res.json(result);
});

async function performSanctionsCheck(address: string): Promise<{
  address: string;
  sanctioned: boolean;
  riskScore: number;
  riskLevel: string;
  sources: string[];
  checkedAt: string;
}> {
  // Integration point for real sanctions screening:
  // - OFAC SDN list
  // - Chainalysis KYT API
  // - Elliptic API
  // - TRM Labs API
  logger.info("Performing sanctions check", { address });

  return {
    address,
    sanctioned: false,
    riskScore: 0,
    riskLevel: "low",
    sources: ["OFAC_SDN_MOCK", "CHAINALYSIS_MOCK"],
    checkedAt: new Date().toISOString(),
  };
}

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`Compliance service running on port ${PORT}`);
});
