import path from "path";
import dotenv from "dotenv";

const rootEnvPath = path.resolve(process.cwd(), "../.env");
dotenv.config({ path: rootEnvPath });
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


