import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import onboardingRouter from "./api/onboarding.js";
import benefitsRouter from "./api/benefits.js";
import recalculateRouter from "./api/recalculate.js";
import intelligenceRouter from "./api/intelligence.js";
import { AppError, errorHandler } from "./utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../frontend");
const sharedDir = path.resolve(__dirname, "../shared");

const validateConfig = () => {
  const mongoUrl = process.env.MONGO_URL;
  if (mongoUrl && !mongoUrl.startsWith("mongodb://") && !mongoUrl.startsWith("mongodb+srv://")) {
    throw new Error("MONGO_URL must start with mongodb:// or mongodb+srv://");
  }
};

export const createApp = () => {
  validateConfig();

  const app = express();

  app.use((req, res, next) => {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use((req, res, next) => {
    res.setHeader("x-content-type-options", "nosniff");
    if (!req.query?.vscodeBrowserReqId) {
      res.setHeader("x-frame-options", "DENY");
    }
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("permissions-policy", "geolocation=(), microphone=(), camera=()");
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const entry = {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration
      };
      console.log(JSON.stringify(entry));
    });
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use("/shared", express.static(sharedDir));
  app.use(express.static(frontendDir));

  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      status: "ok",
      time: new Date().toISOString()
    });
  });

  app.use("/api", onboardingRouter);
  app.use("/api", benefitsRouter);
  app.use("/api", recalculateRouter);
  app.use("/api", intelligenceRouter);

  app.use("/api", (req, res, next) => {
    next(new AppError("API route not found", 404, "not_found"));
  });

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });

  app.use(errorHandler);

  return app;
};
