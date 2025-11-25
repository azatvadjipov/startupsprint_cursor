import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(__dirname, "../../.env"), // монорепозитарий корень
  path.resolve(__dirname, "../.env"), // /backend/.env
  path.resolve(process.cwd(), ".env"), // рабочая директория
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath });
}
dotenv.config();

const required = ["ADMIN_PASSWORD"] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] ENV ${key} не задан. Добавьте его в .env перед продом.`);
  }
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  jwtSecret: process.env.ADMIN_JWT_SECRET ?? "startupsprint-secret",
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
};


