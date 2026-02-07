import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import onboardingRouter from "./api/onboarding.js";
import benefitsRouter from "./api/benefits.js";
import recalculateRouter from "./api/recalculate.js";
import { connectToMongo } from "./database/mongo.js";
import { AppError, errorHandler } from "./utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../frontend");
const sharedDir = path.resolve(__dirname, "../shared");

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    console.log(line);
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

app.use("/api", (req, res, next) => {
  next(new AppError("API route not found", 404, "not_found"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use(errorHandler);

const port = Number(process.env.PORT || 4000);

connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Rally Forge API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
