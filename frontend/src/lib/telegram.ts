const FALLBACK_ID = import.meta.env.VITE_MOCK_TELEGRAM_ID ?? "10001";

export const getTelegramUserId = (): string => {
  const webApp = (window as any)?.Telegram?.WebApp;
  const unsafeUser = webApp?.initDataUnsafe?.user;
  if (unsafeUser?.id) {
    return String(unsafeUser.id);
  }
  // В продакшене нужно обязательно валидировать initData на бэкенде.
  // Здесь оставляем запасной идентификатор для локальной разработки.
  return FALLBACK_ID;
};


