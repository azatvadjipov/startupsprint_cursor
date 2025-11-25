import { Request, Response, Router } from "express";
import { v4 as uuid } from "uuid";
import { config } from "../config.js";
import { db } from "../db.js";
import {
  getAdminCookieName,
  requireAdmin,
  createAdminSession,
  destroyAdminSession,
} from "../middleware/adminAuth.js";
import { computeStats } from "../services/programService.js";

const router = Router();
const now = () => new Date().toISOString();
const secureCookie = process.env.NODE_ENV === "production";

type AsyncHandler = (req: Request, res: Response) => Promise<void | Response>;
const handle =
  (fn: AsyncHandler) =>
  async (req: Request, res: Response, _next?: any) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(error);
      res
        .status(400)
        .json({ message: (error as Error).message ?? "Ошибка обработки запроса" });
    }
  };

router.post("/login", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    return res.status(400).json({ message: "Введите пароль" });
  }
  if (!config.adminPassword) {
    return res.status(500).json({ message: "ADMIN_PASSWORD не настроен" });
  }
  if (password !== config.adminPassword) {
    return res.status(401).json({ message: "Неверный пароль" });
  }

  const token = await createAdminSession();
  res.cookie(getAdminCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return res.json({ message: "ok" });
});

router.use(requireAdmin);

router.post(
  "/logout",
  handle(async (req, res) => {
    const token = req.cookies?.[getAdminCookieName()];
    if (token) {
      await destroyAdminSession(token);
    }
    res.clearCookie(getAdminCookieName());
    return res.json({ message: "Вышли из админки" });
  })
);

router.get("/programs", handle(async (_req, res) => {
  const data = await db.read();
  const programs = data.programs.map((program) => {
    const lessonsCount = data.lessons.filter((lesson) => lesson.programId === program.id).length;
    return { ...program, lessonsCount };
  });
  return res.json(programs);
}));

router.post("/programs", handle(async (req, res) => {
  const { name, description, isActive } = req.body as {
    name?: string;
    description?: string;
    isActive?: boolean;
  };
  if (!name) {
    return res.status(400).json({ message: "Название обязательно" });
  }
  await db.mutate((data) => {
    if (isActive) {
      data.programs.forEach((program) => {
        program.isActive = false;
      });
    }
    data.programs.push({
      id: uuid(),
      name,
      description: description ?? "",
      isActive: Boolean(isActive),
      createdAt: now(),
      updatedAt: now(),
    });
  });
  return res.json({ message: "Программа создана" });
}));

router.put("/programs/:id", handle(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body as {
    name?: string;
    description?: string;
    isActive?: boolean;
  };
  await db.mutate((data) => {
    const target = data.programs.find((program) => program.id === id);
    if (!target) {
      throw new Error("Программа не найдена");
    }
    if (typeof name === "string") target.name = name;
    if (typeof description === "string") target.description = description;
    if (typeof isActive === "boolean") {
      if (isActive) {
        data.programs.forEach((program) => {
          program.isActive = false;
        });
      }
      target.isActive = isActive;
    }
    target.updatedAt = now();
  });
  return res.json({ message: "Программа обновлена" });
}));

router.get("/programs/:id/lessons", handle(async (req, res) => {
  const { id } = req.params;
  const data = await db.read();
  const lessons = data.lessons
    .filter((lesson) => lesson.programId === id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return res.json(lessons);
}));

router.post("/programs/:id/lessons", handle(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    videoUrl,
    homeworkText,
    visibility,
    delayHoursFromPrevious = 0,
    expiresInHours = 48,
  } = req.body as Record<string, any>;

  if (!title) {
    return res.status(400).json({ message: "Название урока обязательно" });
  }

  await db.mutate((data) => {
    const program = data.programs.find((program) => program.id === id);
    if (!program) {
      throw new Error("Программа не найдена");
    }
    const siblings = data.lessons
      .filter((lesson) => lesson.programId === id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const orderIndex = siblings.length ? siblings[siblings.length - 1].orderIndex + 1 : 1;
    data.lessons.push({
      id: uuid(),
      programId: id,
      orderIndex,
      title,
      description: description ?? "",
      videoUrl: videoUrl ?? "",
      homeworkText: homeworkText ?? "",
      visibility: visibility ?? "FREE",
      delayHoursFromPrevious: Number(delayHoursFromPrevious) || 0,
      expiresInHours: Number(expiresInHours) || 48,
      createdAt: now(),
      updatedAt: now(),
    });
  });
  return res.json({ message: "Урок создан" });
}));

router.put("/lessons/:id", handle(async (req, res) => {
  const { id } = req.params;
  await db.mutate((data) => {
    const lesson = data.lessons.find((item) => item.id === id);
    if (!lesson) {
      throw new Error("Урок не найден");
    }
    Object.assign(lesson, req.body);
    lesson.delayHoursFromPrevious = Number(lesson.delayHoursFromPrevious) || 0;
    lesson.expiresInHours = Number(lesson.expiresInHours) || 48;
    lesson.updatedAt = now();
  });
  return res.json({ message: "Урок обновлён" });
}));

router.delete("/lessons/:id", handle(async (req, res) => {
  const { id } = req.params;
  await db.mutate((data) => {
    data.lessons = data.lessons.filter((lesson) => lesson.id !== id);
    data.userLessonProgress = data.userLessonProgress.filter(
      (progress) => progress.lessonId !== id
    );
  });
  return res.json({ message: "Урок удалён" });
}));

router.post("/lessons/:id/move", handle(async (req, res) => {
  const { id } = req.params;
  const { direction } = req.body as { direction: "up" | "down" };
  if (!direction) {
    return res.status(400).json({ message: "Не указано направление" });
  }
  await db.mutate((data) => {
    const lesson = data.lessons.find((item) => item.id === id);
    if (!lesson) {
      throw new Error("Урок не найден");
    }
    const siblings = data.lessons
      .filter((item) => item.programId === lesson.programId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const index = siblings.findIndex((item) => item.id === lesson.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) {
      return;
    }
    const target = siblings[swapIndex];
    const tmp = lesson.orderIndex;
    lesson.orderIndex = target.orderIndex;
    target.orderIndex = tmp;
  });
  return res.json({ message: "Порядок обновлён" });
}));

router.get("/upsell", handle(async (_req, res) => {
  const data = await db.read();
  return res.json(data.upsell);
}));

router.put("/upsell", handle(async (req, res) => {
  const { title, text, buttonLabel, buttonUrl } = req.body as Record<string, string>;
  await db.mutate((data) => {
    data.upsell = {
      id: data.upsell?.id ?? uuid(),
      title: title ?? data.upsell?.title ?? "",
      text: text ?? data.upsell?.text ?? "",
      buttonLabel: buttonLabel ?? data.upsell?.buttonLabel ?? "",
      buttonUrl: buttonUrl ?? data.upsell?.buttonUrl ?? "",
      updatedAt: now(),
    };
  });
  return res.json({ message: "Апселл сохранён" });
}));

router.get("/stats", handle(async (_req, res) => {
  const stats = await computeStats();
  return res.json(stats);
}));

export default router;

