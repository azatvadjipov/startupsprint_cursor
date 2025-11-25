import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import {
  Lesson,
  LessonStatus,
  Program,
  ProgramStatus,
  UpsellSettings,
  User,
  UserLessonProgress,
  UserProgramProgress,
} from "../types.js";

const now = () => new Date().toISOString();
const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;

const sortLessons = (lessons: Lesson[]) =>
  [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);

export interface ProgramBundle {
  program: Program | null;
  lessons: Lesson[];
  upsell: UpsellSettings | null;
}

export const getActiveProgramBundle = async (): Promise<ProgramBundle> => {
  const data = await db.read();
  const program = data.programs.find((p) => p.isActive) ?? null;
  if (!program) {
    return { program: null, lessons: [], upsell: data.upsell };
  }
  const lessons = sortLessons(
    data.lessons.filter((lesson) => lesson.programId === program.id)
  );
  return { program, lessons, upsell: data.upsell };
};

export const findUserByTelegramId = async (
  telegramId: string
): Promise<User | undefined> => {
  const data = await db.read();
  return data.users.find((u) => u.telegramId === telegramId);
};

export const findUserById = async (userId: string): Promise<User | undefined> => {
  const data = await db.read();
  return data.users.find((u) => u.id === userId);
};

export const createOrUpdateUser = async (
  telegramId: string,
  isPaid: boolean
): Promise<User> => {
  let user: User | undefined;
  await db.mutate((data) => {
    user = data.users.find((u) => u.telegramId === telegramId);
    if (user) {
      user.isPaid = isPaid;
      user.updatedAt = now();
      return;
    }
    const created: User = {
      id: uuid(),
      telegramId,
      isPaid,
      createdAt: now(),
      updatedAt: now(),
    };
    data.users.push(created);
    user = created;
  });
  if (!user) {
    throw new Error("Не удалось создать пользователя");
  }
  return user;
};

const getProgramProgressRecord = (
  data: Awaited<ReturnType<typeof db.read>>,
  userId: string,
  programId: string
) => data.userProgramProgress.find((p) => p.userId === userId && p.programId === programId);

const getLessonProgressRecord = (
  data: Awaited<ReturnType<typeof db.read>>,
  userId: string,
  lessonId: string
) => data.userLessonProgress.find((l) => l.userId === userId && l.lessonId === lessonId);

export const ensureProgramProgress = async (
  userId: string,
  programId: string
): Promise<UserProgramProgress | null> => {
  let record: UserProgramProgress | null = null;
  await db.mutate((data) => {
    record = getProgramProgressRecord(data, userId, programId) ?? null;
    if (record) return;
    const created: UserProgramProgress = {
      id: uuid(),
      userId,
      programId,
      status: "IN_PROGRESS",
      startedAt: now(),
      finishedAt: null,
      lastLessonId: null,
      updatedAt: now(),
    };
    data.userProgramProgress.push(created);
    record = created;
  });
  return record;
};

const ensureLessonProgressRecord = async (
  userId: string,
  lesson: Lesson
): Promise<UserLessonProgress> => {
  let record: UserLessonProgress | undefined;
  await db.mutate((data) => {
    record = getLessonProgressRecord(data, userId, lesson.id);
    if (record) return;
    const created: UserLessonProgress = {
      id: uuid(),
      userId,
      lessonId: lesson.id,
      status: "AVAILABLE",
      unlockedAt: now(),
      completedAt: null,
      expiresAt: new Date(Date.now() + hoursToMs(lesson.expiresInHours)).toISOString(),
      updatedAt: now(),
    };
    data.userLessonProgress.push(created);
    record = created;
  });
  if (!record) {
    throw new Error("Не удалось создать прогресс урока");
  }
  return record;
};

const refreshLessonProgressStates = async (userId: string, programId: string) => {
  const current = new Date();
  await db.mutate((data) => {
    const programProgress = getProgramProgressRecord(data, userId, programId);
    if (!programProgress) return;
    const lessons = data.userLessonProgress.filter((l) => {
      const lesson = data.lessons.find((item) => item.id === l.lessonId);
      return lesson?.programId === programId;
    });

    let shouldFailProgram = false;

    lessons.forEach((progress) => {
      if (
        progress.status === "LOCKED" &&
        progress.unlockedAt &&
        new Date(progress.unlockedAt) <= current
      ) {
        progress.status = "AVAILABLE";
        progress.updatedAt = now();
      }
      if (
        progress.status === "AVAILABLE" &&
        progress.expiresAt &&
        new Date(progress.expiresAt) < current
      ) {
        progress.status = "EXPIRED";
        progress.updatedAt = now();
        shouldFailProgram = true;
      }
    });

    if (shouldFailProgram && programProgress.status !== "FAILED") {
      programProgress.status = "FAILED";
      programProgress.updatedAt = now();
      programProgress.finishedAt = null;
    }
  });
};

const unlockNextLesson = (
  data: Awaited<ReturnType<typeof db.read>>,
  userId: string,
  currentLesson: Lesson
) => {
  const lessons = sortLessons(
    data.lessons.filter((lesson) => lesson.programId === currentLesson.programId)
  );
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
  if (currentIndex === -1 || currentIndex === lessons.length - 1) {
    return;
  }
  const nextLesson = lessons[currentIndex + 1];
  let progress = getLessonProgressRecord(data, userId, nextLesson.id);
  const baseUnlockTime = new Date(
    Date.now() + hoursToMs(nextLesson.delayHoursFromPrevious)
  );
  const unlockedAt = baseUnlockTime.toISOString();
  const expiresAt = new Date(
    baseUnlockTime.getTime() + hoursToMs(nextLesson.expiresInHours)
  ).toISOString();
  if (!progress) {
    progress = {
      id: uuid(),
      userId,
      lessonId: nextLesson.id,
      status: nextLesson.delayHoursFromPrevious === 0 ? "AVAILABLE" : "LOCKED",
      unlockedAt,
      completedAt: null,
      expiresAt,
      updatedAt: now(),
    };
    if (progress.status === "AVAILABLE") {
      progress.unlockedAt = now();
      progress.expiresAt = new Date(
        Date.now() + hoursToMs(nextLesson.expiresInHours)
      ).toISOString();
    }
    data.userLessonProgress.push(progress);
  } else {
    progress.unlockedAt = unlockedAt;
    progress.expiresAt = expiresAt;
    progress.status =
      nextLesson.delayHoursFromPrevious === 0 ? "AVAILABLE" : "LOCKED";
    progress.updatedAt = now();
    if (progress.status === "AVAILABLE") {
      progress.unlockedAt = now();
      progress.expiresAt = new Date(
        Date.now() + hoursToMs(nextLesson.expiresInHours)
      ).toISOString();
    }
  }
};

export type LessonPayload = Lesson & {
  userStatus: LessonStatus;
  unlockedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
};

export interface ProgramPayload {
  program: Program | null;
  lessons: LessonPayload[];
  progressStatus: ProgramStatus | "NOT_STARTED";
  completedLessons: number;
  totalLessons: number;
  upsell: UpsellSettings | null;
}

export const buildProgramPayload = async (
  userId: string,
  isPaid: boolean
): Promise<ProgramPayload> => {
  const { program, lessons, upsell } = await getActiveProgramBundle();
  if (!program) {
    return {
      program: null,
      lessons: [],
      progressStatus: "NOT_STARTED",
      completedLessons: 0,
      totalLessons: 0,
      upsell,
    };
  }

  await refreshLessonProgressStates(userId, program.id);

  const data = await db.read();
  const programProgress =
    getProgramProgressRecord(data, userId, program.id) ?? null;

  const visibleLessons = lessons.filter(
    (lesson) => lesson.visibility !== "ARCHIVED"
  );

  const payloadLessons: LessonPayload[] = visibleLessons.map((lesson) => {
    const progress = getLessonProgressRecord(data, userId, lesson.id);
    let userStatus: LessonStatus = "LOCKED";
    if (progress) {
      userStatus = progress.status;
    } else if (lesson.orderIndex === visibleLessons[0]?.orderIndex) {
      userStatus = "AVAILABLE";
    }

    if (!isPaid && lesson.visibility === "PAID") {
      userStatus = "LOCKED";
    }

    return {
      ...lesson,
      userStatus,
      unlockedAt: progress?.unlockedAt ?? null,
      expiresAt: progress?.expiresAt ?? null,
      completedAt: progress?.completedAt ?? null,
    };
  });

  const completedLessons = payloadLessons.filter(
    (entry) => entry.userStatus === "DONE"
  ).length;

  return {
    program,
    lessons: payloadLessons,
    progressStatus: programProgress?.status ?? "NOT_STARTED",
    completedLessons,
    totalLessons: payloadLessons.length,
    upsell,
  };
};

export const startLessonForUser = async (
  userId: string,
  lesson: Lesson
): Promise<void> => {
  await ensureProgramProgress(userId, lesson.programId);
  await ensureLessonProgressRecord(userId, lesson);
};

export const completeLessonForUser = async (
  userId: string,
  lesson: Lesson
): Promise<void> => {
  await db.mutate((data) => {
    const progress = getLessonProgressRecord(data, userId, lesson.id);
    if (!progress) {
      throw new Error("Урок ещё не начат");
    }
    if (progress.status === "DONE") {
      return;
    }
    if (progress.status !== "AVAILABLE") {
      throw new Error("Урок недоступен для завершения");
    }

    progress.status = "DONE";
    progress.completedAt = now();
    progress.updatedAt = now();

    const programProgress = getProgramProgressRecord(
      data,
      userId,
      lesson.programId
    );

    if (!programProgress) {
      throw new Error("Спринт не найден");
    }

    programProgress.lastLessonId = lesson.id;
    programProgress.updatedAt = now();

    const programLessons = sortLessons(
      data.lessons.filter((item) => item.programId === lesson.programId)
    ).filter((item) => item.visibility !== "ARCHIVED");

    const currentIndex = programLessons.findIndex(
      (item) => item.id === lesson.id
    );

    if (currentIndex === programLessons.length - 1) {
      programProgress.status = "COMPLETED";
      programProgress.finishedAt = now();
      return;
    }

    unlockNextLesson(data, userId, lesson);
  });
};

export const restartProgramForUser = async (
  userId: string,
  programId: string
): Promise<void> => {
  await db.mutate((data) => {
    data.userProgramProgress = data.userProgramProgress.filter(
      (record) => !(record.userId === userId && record.programId === programId)
    );
    data.userLessonProgress = data.userLessonProgress.filter((record) => {
      const lesson = data.lessons.find((l) => l.id === record.lessonId);
      return !(lesson?.programId === programId && record.userId === userId);
    });
  });
};

export const updateUserPaidStatus = async (
  userId: string,
  isPaid: boolean
) => {
  await db.mutate((data) => {
    const user = data.users.find((u) => u.id === userId);
    if (!user) return;
    user.isPaid = isPaid;
    user.updatedAt = now();
  });
};

export const computeStats = async () => {
  const data = await db.read();
  const users = data.users.length;
  const paid = data.users.filter((u) => u.isPaid).length;
  const completed = data.userProgramProgress.filter(
    (p) => p.status === "COMPLETED"
  ).length;
  const failed = data.userProgramProgress.filter(
    (p) => p.status === "FAILED"
  ).length;

  return { users, paid, completed, failed };
};

