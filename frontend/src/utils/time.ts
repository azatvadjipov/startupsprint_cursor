const pad = (value: number) => value.toString().padStart(2, "0");

export const formatCountdown = (target?: string | null) => {
  if (!target) return "";
  const targetDate = new Date(target).getTime();
  const diff = targetDate - Date.now();
  if (diff <= 0) return "00:00";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${pad(hours)}:${pad(minutes)}`;
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(
    date.getDate()
  )}.${pad(date.getMonth() + 1)}`;
};

export const timeUntil = (value?: string | null) => {
  if (!value) return "";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};


