import { httpRequest } from "./http";
import type { AuthResponse, MembershipInfo, ProgramPayload } from "../types";

export const AppClientApi = {
  auth: (telegramId: string) =>
    httpRequest<AuthResponse>("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ telegramId }),
    }),
  getProgress: (userId: string) =>
    httpRequest<ProgramPayload & { userId: string; isPaid: boolean }>("/api/progress", {
      query: { userId },
    }),
  startLesson: (userId: string, lessonId: string) =>
    httpRequest<ProgramPayload & { userId: string; isPaid: boolean }>(
      `/api/lessons/${lessonId}/start`,
      { method: "POST", body: JSON.stringify({ userId }) }
    ),
  completeLesson: (userId: string, lessonId: string) =>
    httpRequest<ProgramPayload & { userId: string; isPaid: boolean }>(
      `/api/lessons/${lessonId}/complete`,
      { method: "POST", body: JSON.stringify({ userId }) }
    ),
  restartProgram: (userId: string) =>
    httpRequest<ProgramPayload & { userId: string; isPaid: boolean }>("/api/restart-program", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  checkMembership: (telegramId: string) =>
    httpRequest<MembershipInfo>("/api/check-membership", { query: { telegramId } }),
};

