import fetch from "node-fetch";
import { config } from "./config.js";

export interface MembershipCheckResult {
  isPaid: boolean;
  reason?: string;
}

export const checkTelegramMembership = async (
  telegramId: string
): Promise<MembershipCheckResult> => {
  if (!config.telegramBotToken || !config.telegramChannelId) {
    return {
      isPaid: false,
      reason: "Отсутствует TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID",
    };
  }

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getChatMember?chat_id=${config.telegramChannelId}&user_id=${telegramId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { isPaid: false, reason: "Bot API вернул ошибку" };
    }
    const payload = (await response.json()) as {
      ok: boolean;
      result?: { status: string };
    };
    if (!payload.ok || !payload.result) {
      return { isPaid: false, reason: "Некорректный ответ Bot API" };
    }
    const status = payload.result.status;
    const paid = status !== "left" && status !== "kicked";
    return { isPaid: paid };
  } catch (error) {
    console.error("[telegram] membership error", error);
    return { isPaid: false, reason: "Bot API недоступен" };
  }
};


