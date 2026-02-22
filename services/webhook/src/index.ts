import express from "express";
import { createLogger, format, transports } from "winston";
import axios from "axios";
import { z } from "zod";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
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

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: any;
  attempts: number;
  lastAttempt?: string;
  status: "pending" | "delivered" | "failed";
  responseCode?: number;
}

const endpoints = new Map<string, WebhookEndpoint>();
const deliveries: WebhookDelivery[] = [];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // ms

// Block SSRF: reject URLs that resolve to private/loopback IP ranges
function isPrivateUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname;
    // Block loopback, private ranges, link-local, metadata IPs
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,   // link-local
      /^::1$/,         // IPv6 loopback
      /^fc00:/i,       // IPv6 private
      /^fe80:/i,       // IPv6 link-local
      /^0\.0\.0\.0$/,
      /^169\.254\.169\.254$/, // AWS/GCP metadata endpoint
    ];
    return privatePatterns.some((re) => re.test(hostname));
  } catch {
    return true; // malformed URL → reject
  }
}

const EndpointSchema = z.object({
  url: z.string().url().refine(
    (url) => !isPrivateUrl(url),
    { message: "URL must not point to a private or loopback address" }
  ),
  events: z.array(z.string()),
  secret: z.string().optional(),
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "webhook",
    endpoints: endpoints.size,
    deliveries: deliveries.length,
  });
});

// POST /api/endpoints — Register a webhook endpoint
app.post("/api/endpoints", (req, res) => {
  try {
    const data = EndpointSchema.parse(req.body);
    const endpoint: WebhookEndpoint = {
      id: crypto.randomUUID(),
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: true,
      createdAt: new Date().toISOString(),
    };
    endpoints.set(endpoint.id, endpoint);
    logger.info("Webhook endpoint registered", {
      id: endpoint.id,
      url: data.url,
    });
    res.status(201).json(endpoint);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/endpoints
app.get("/api/endpoints", (_req, res) => {
  res.json(Array.from(endpoints.values()));
});

// DELETE /api/endpoints/:id
app.delete("/api/endpoints/:id", (req, res) => {
  const deleted = endpoints.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

// POST /api/dispatch — Dispatch event to matching endpoints
app.post("/api/dispatch", async (req, res) => {
  const event = req.body;
  const eventType = event.type;

  if (!eventType) {
    return res.status(400).json({ error: "event.type is required" });
  }

  const matchingEndpoints = Array.from(endpoints.values()).filter(
    (ep) =>
      ep.active &&
      (ep.events.includes("*") || ep.events.includes(eventType))
  );

  const deliveryIds: string[] = [];

  for (const ep of matchingEndpoints) {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      endpointId: ep.id,
      event,
      attempts: 0,
      status: "pending",
    };
    deliveries.push(delivery);
    deliveryIds.push(delivery.id);

    deliverWithRetry(delivery, ep).catch((err) =>
      logger.error("Delivery failed permanently", {
        deliveryId: delivery.id,
        error: err.message,
      })
    );
  }

  res.json({ dispatched: deliveryIds.length, deliveryIds });
});

// GET /api/deliveries
app.get("/api/deliveries", (req, res) => {
  const { status, limit = "50" } = req.query;
  let filtered = deliveries;
  if (status) {
    filtered = deliveries.filter((d) => d.status === status);
  }
  res.json(filtered.slice(-parseInt(limit as string)));
});

async function deliverWithRetry(
  delivery: WebhookDelivery,
  endpoint: WebhookEndpoint
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    delivery.attempts++;
    delivery.lastAttempt = new Date().toISOString();

    try {
      const timestamp = new Date().toISOString();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-SSS-Event": delivery.event.type || "unknown",
        "X-SSS-Delivery": delivery.id,
        "X-SSS-Timestamp": timestamp,
      };

      if (endpoint.secret) {
        const payload = JSON.stringify(delivery.event);
        const sig = crypto
          .createHmac("sha256", endpoint.secret)
          .update(payload)
          .digest("hex");
        headers["X-SSS-Signature"] = `sha256=${sig}`;
      }

      const response = await axios.post(endpoint.url, delivery.event, {
        headers,
        timeout: 10000,
      });

      delivery.status = "delivered";
      delivery.responseCode = response.status;
      logger.info("Webhook delivered", {
        deliveryId: delivery.id,
        status: response.status,
      });
      return;
    } catch (err: any) {
      delivery.responseCode = err.response?.status;
      logger.warn("Webhook delivery attempt failed", {
        deliveryId: delivery.id,
        attempt: attempt + 1,
        error: err.message,
      });

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  delivery.status = "failed";
  logger.error("Webhook delivery failed permanently", {
    deliveryId: delivery.id,
  });
}

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  logger.info(`Webhook service running on port ${PORT}`);
});
