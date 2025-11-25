import { Router } from "express";
import {
  buildProgramPayload,
  completeLessonForUser,
  createOrUpdateUser,
  findUserById,
  findUserByTelegramId,
  restartProgramForUser,
  startLessonForUser,
  updateUserPaidStatus,
} from "../services/programService.js";
import { db } from "../db.js";
import { checkTelegramMembership } from "../telegram.js";
import { Lesson } from "../types.js";

const router = Router();

const ensureUser = async (userId?: string) => {
  if (!userId) {
    throw new Error("userId обязателен");
  }
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("Пользователь не найден");
  }
  return user;
};

const loadLesson = async (lessonId: string) => {
  const data = await db.read();
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson || lesson.visibility === "ARCHIVED") {
    throw new Error("Урок не найден или архивирован");
  }
  return lesson;
};

const ensurePaidLessonAccess = async (
  userId: string | undefined,
  lessonId: string,
  preloadedLesson?: Lesson
) => {
  if (!userId) {
    const error = new Error("userId обязателен");
    (error as any).status = 400;
    throw error;
  }
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("Пользователь не найден");
  }
  const lesson = preloadedLesson ?? (await loadLesson(lessonId));
  if (lesson.visibility !== "PAID") {
    return { user, lesson };
  }
  const membership = await checkTelegramMembership(user.telegramId);
  if (!membership.isPaid) {
    await updateUserPaidStatus(user.id, false);
    user.isPaid = false;
    const reason =
      membership.reason ?? "Нужно вступить в платный канал, чтобы открыть урок.";
    const error = new Error(reason);
    (error as any).status = 403;
    throw error;
  }
  if (!user.isPaid) {
    await updateUserPaidStatus(user.id, true);
    user.isPaid = true;
  }
  return { user, lesson };
};

router.post("/auth/telegram", async (req, res) => {
  try {
    const { telegramId } = req.body as { telegramId?: string };
    if (!telegramId) {
      return res.status(400).json({ message: "telegramId обязателен" });
    }
    const membership = await checkTelegramMembership(telegramId);
    const user = await createOrUpdateUser(telegramId, membership.isPaid);
    const payload = await buildProgramPayload(user.id, membership.isPaid);
    return res.json({
      userId: user.id,
      telegramId: user.telegramId,
      isPaid: membership.isPaid,
      membershipReason: membership.reason,
      ...payload,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Ошибка авторизации" });
  }
});

router.get("/check-membership", async (req, res) => {
  try {
    const { telegramId } = req.query as { telegramId?: string };
    if (!telegramId) {
      return res.status(400).json({ message: "telegramId обязателен" });
    }
    const user = await findUserByTelegramId(telegramId);
    const membership = await checkTelegramMembership(telegramId);
    if (user) {
      await updateUserPaidStatus(user.id, membership.isPaid);
    }
    return res.json({
      telegramId,
      userId: user?.id ?? null,
      isPaid: membership.isPaid,
      membershipReason: membership.reason,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Не удалось проверить подписку" });
  }
});

router.get("/programs/active", async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    const user = await ensureUser(userId);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ message: (error as Error).message ?? "Ошибка получения программы" });
  }
});

router.get("/progress", async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    const user = await ensureUser(userId);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ message: (error as Error).message ?? "Ошибка получения прогресса" });
  }
});

router.post("/lessons/:lessonId/start", async (req, res) => {
  const { lessonId } = req.params;
  const { userId } = req.body as { userId?: string };
  try {
    const lesson = await loadLesson(lessonId);
    const { user } =
      lesson.visibility === "PAID"
        ? await ensurePaidLessonAccess(userId, lessonId, lesson)
        : { user: await ensureUser(userId) };
    await startLessonForUser(user.id, lesson);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    console.error(error);
    const status = (error as any).status ?? 400;
    return res.status(status).json({ message: (error as Error).message });
  }
});

router.post("/lessons/:lessonId/complete", async (req, res) => {
  const { lessonId } = req.params;
  const { userId } = req.body as { userId?: string };
  try {
    const lesson = await loadLesson(lessonId);
    const { user } = await ensurePaidLessonAccess(userId, lessonId, lesson);
    await completeLessonForUser(user.id, lesson);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    console.error(error);
    const status = (error as any).status ?? 400;
    return res.status(status).json({ message: (error as Error).message });
  }
});

router.post("/restart-program", async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    const user = await ensureUser(userId);
    const { program } = await buildProgramPayload(user.id, user.isPaid);
    if (!program) {
      return res.status(404).json({ message: "Активная программа не найдена" });
    }
    await restartProgramForUser(user.id, program.id);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ message: (error as Error).message ?? "Не удалось перезапустить спринт" });
  }
});

export default router;

