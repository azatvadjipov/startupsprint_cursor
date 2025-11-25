import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";

const COOKIE_NAME = "admin_session";
const now = () => new Date().toISOString();

export const createAdminSession = async () => {
  const token = uuid();
  await db.mutate((data) => {
    data.adminSessions.push({
      id: uuid(),
      token,
      createdAt: now(),
    });
  });
  return token;
};

export const destroyAdminSession = async (token: string) => {
  await db.mutate((data) => {
    data.adminSessions = data.adminSessions.filter((session) => session.token !== token);
  });
};

const findSession = async (token: string) => {
  const data = await db.read();
  return data.adminSessions.find((session) => session.token === token);
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  const session = await findSession(token);
  if (!session) {
    return res.status(401).json({ message: "Сессия истекла" });
  }
  (req as any).adminSession = session;
  return next();
};

export const getAdminCookieName = () => COOKIE_NAME;


