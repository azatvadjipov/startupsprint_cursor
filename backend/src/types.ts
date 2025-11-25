export type Visibility = "ARCHIVED" | "FREE" | "PAID";

export interface Program {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  programId: string;
  orderIndex: number;
  title: string;
  description: string;
  videoUrl: string;
  homeworkText: string;
  visibility: Visibility;
  delayHoursFromPrevious: number;
  expiresInHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  telegramId: string;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProgramStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface UserProgramProgress {
  id: string;
  userId: string;
  programId: string;
  status: ProgramStatus;
  startedAt: string;
  finishedAt: string | null;
  lastLessonId: string | null;
  updatedAt: string;
}

export type LessonStatus = "LOCKED" | "AVAILABLE" | "EXPIRED" | "DONE";

export interface UserLessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  status: LessonStatus;
  unlockedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface UpsellSettings {
  id: string;
  title: string;
  text: string;
  buttonLabel: string;
  buttonUrl: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  programs: Program[];
  lessons: Lesson[];
  users: User[];
  userProgramProgress: UserProgramProgress[];
  userLessonProgress: UserLessonProgress[];
  upsell: UpsellSettings | null;
  adminSessions: AdminSession[];
}

export interface AdminSession {
  id: string;
  token: string;
  createdAt: string;
}


