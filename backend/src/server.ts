import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { config } from "./config.js";

const app = express();

const originConfig =
  config.clientOrigin === "*"
    ? true
    : config.clientOrigin.split(",").map((item) => item.trim());

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

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});


