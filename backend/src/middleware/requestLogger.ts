import type { NextFunction, Request, Response } from "express";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 8);

  console.log(`[req:${requestId}] ${req.method} ${req.originalUrl}`);

  res.on("finish", () => {
    const duration = Date.now() - startedAt;
    console.log(
      `[res:${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};


