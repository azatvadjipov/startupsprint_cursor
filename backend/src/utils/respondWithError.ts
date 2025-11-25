import type { Response } from "express";

export interface HttpError extends Error {
  status?: number;
}

export const createHttpError = (status: number, message: string): HttpError => {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
};

export const respondWithError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
  context = "api"
) => {
  const status =
    typeof (error as HttpError)?.status === "number"
      ? (error as HttpError).status!
      : fallbackStatus;

  const message =
    error instanceof Error && error.message ? error.message : fallbackMessage;

  const logPayload = {
    context,
    status,
    message,
  };

  console.error(`[${context}] request failed`, logPayload, error);

  return res.status(status).json({ message });
};


