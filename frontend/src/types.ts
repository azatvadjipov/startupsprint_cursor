export type LessonStatus = "LOCKED" | "AVAILABLE" | "EXPIRED" | "DONE";
export type ProgramStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
export type LessonVisibility = "ARCHIVED" | "FREE" | "PAID";

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
  visibility: LessonVisibility;
  delayHoursFromPrevious: number;
  expiresInHours: number;
  userStatus: LessonStatus;
  unlockedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface UpsellSettings {
  id: string;
  title: string;
  text: string;
  buttonLabel: string;
  buttonUrl: string;
  updatedAt: string;
}

export interface ProgramPayload {
  program: Program | null;
  lessons: Lesson[];
  progressStatus: ProgramStatus | "NOT_STARTED";
  completedLessons: number;
  totalLessons: number;
  upsell: UpsellSettings | null;
  userId?: string;
  isPaid?: boolean;
}

export interface AuthResponse extends ProgramPayload {
  userId: string;
  telegramId: string;
  isPaid: boolean;
  membershipReason?: string;
}

export interface MembershipInfo {
  telegramId: string;
  userId: string | null;
  isPaid: boolean;
  membershipReason?: string;
}

export interface AdminProgram extends Program {
  lessonsCount: number;
}

export interface AdminLesson {
  id: string;
  programId: string;
  orderIndex: number;
  title: string;
  description: string;
  videoUrl: string;
  homeworkText: string;
  visibility: LessonVisibility;
  delayHoursFromPrevious: number;
  expiresInHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  users: number;
  paid: number;
  completed: number;
  failed: number;
}


