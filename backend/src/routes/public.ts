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
import { createHttpError, respondWithError } from "../utils/respondWithError.js";

const router = Router();

const ensureUser = async (userId?: string) => {
  if (!userId) {
    throw createHttpError(400, "userId обязателен");
  }
  const user = await findUserById(userId);
  if (!user) {
    throw createHttpError(404, "Пользователь не найден");
  }
  return user;
};

const loadLesson = async (lessonId: string) => {
  const data = await db.read();
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson || lesson.visibility === "ARCHIVED") {
    throw createHttpError(404, "Урок не найден или архивирован");
  }
  return lesson;
};

const ensurePaidLessonAccess = async (
  userId: string | undefined,
  lessonId: string,
  preloadedLesson?: Lesson
) => {
  if (!userId) {
    throw createHttpError(400, "userId обязателен");
  }
  const user = await findUserById(userId);
  if (!user) {
    throw createHttpError(404, "Пользователь не найден");
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
    throw createHttpError(403, reason);
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
    return respondWithError(res, error, "Ошибка авторизации", 500, "public:auth");
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
    return respondWithError(
      res,
      error,
      "Не удалось проверить подписку",
      500,
      "public:check-membership"
    );
  }
});

router.get("/programs/active", async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    const user = await ensureUser(userId);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Ошибка получения программы",
      400,
      "public:get-program"
    );
  }
});

router.get("/progress", async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    const user = await ensureUser(userId);
    const payload = await buildProgramPayload(user.id, user.isPaid);
    return res.json({ userId: user.id, isPaid: user.isPaid, ...payload });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Ошибка получения прогресса",
      400,
      "public:get-progress"
    );
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
    return respondWithError(
      res,
      error,
      "Не удалось начать урок",
      400,
      "public:start-lesson"
    );
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
    return respondWithError(
      res,
      error,
      "Не удалось завершить урок",
      400,
      "public:complete-lesson"
    );
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
    return respondWithError(
      res,
      error,
      "Не удалось перезапустить спринт",
      400,
      "public:restart-program"
    );
  }
});

export default router;

