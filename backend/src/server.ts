import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();

const originConfig =
  config.clientOrigin === "*"
    ? true
    : config.clientOrigin.split(",").map((item) => item.trim());

app.use(requestLogger);
app.use(
  cors({
    origin: originConfig,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../frontend/dist");

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(
  (
    err: (Error & { status?: number }) | undefined,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (!err) {
      return;
    }
    console.error("[server] Unhandled error", err);
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message ?? "Внутренняя ошибка сервера" });
  }
);

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});


