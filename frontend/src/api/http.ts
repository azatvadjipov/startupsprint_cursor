const API_URL = import.meta.env.VITE_API_URL ?? "";

interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | undefined>;
  asAdmin?: boolean;
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const buildUrl = (path: string, query?: Record<string, string | number | undefined>) => {
  const url = new URL(path, API_URL || window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

export const httpRequest = async <T>(path: string, options: RequestOptions = {}) => {
  const { query, asAdmin, headers, ...rest } = options;
  const response = await fetch(buildUrl(path, query), {
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    credentials: asAdmin ? "include" : "same-origin",
    ...rest,
  });

  if (!response.ok) {
    let message = "Ошибка запроса";
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // ignore
    }
    throw new HttpError(message, response.status);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
};

