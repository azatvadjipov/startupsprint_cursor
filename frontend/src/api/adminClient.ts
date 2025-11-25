import { httpRequest } from "./http";
import type {
  AdminLesson,
  AdminProgram,
  AdminStats,
  UpsellSettings,
} from "../types";

export const AdminApi = {
  login: (password: string) =>
    httpRequest<{ message: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      asAdmin: true,
    }),
  logout: () =>
    httpRequest<{ message: string }>("/api/admin/logout", {
      method: "POST",
      asAdmin: true,
    }),
  getPrograms: () =>
    httpRequest<AdminProgram[]>("/api/admin/programs", { asAdmin: true }),
  createProgram: (payload: { name: string; description: string; isActive: boolean }) =>
    httpRequest("/api/admin/programs", {
      method: "POST",
      body: JSON.stringify(payload),
      asAdmin: true,
    }),
  updateProgram: (id: string, payload: Partial<AdminProgram>) =>
    httpRequest(`/api/admin/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      asAdmin: true,
    }),
  getLessons: (programId: string) =>
    httpRequest<AdminLesson[]>(`/api/admin/programs/${programId}/lessons`, {
      asAdmin: true,
    }),
  createLesson: (programId: string, payload: Partial<AdminLesson>) =>
    httpRequest(`/api/admin/programs/${programId}/lessons`, {
      method: "POST",
      body: JSON.stringify(payload),
      asAdmin: true,
    }),
  updateLesson: (id: string, payload: Partial<AdminLesson>) =>
    httpRequest(`/api/admin/lessons/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      asAdmin: true,
    }),
  deleteLesson: (id: string) =>
    httpRequest(`/api/admin/lessons/${id}`, {
      method: "DELETE",
      asAdmin: true,
    }),
  moveLesson: (id: string, direction: "up" | "down") =>
    httpRequest(`/api/admin/lessons/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
      asAdmin: true,
    }),
  getUpsell: () => httpRequest<UpsellSettings | null>("/api/admin/upsell", { asAdmin: true }),
  updateUpsell: (payload: Partial<UpsellSettings>) =>
    httpRequest("/api/admin/upsell", {
      method: "PUT",
      body: JSON.stringify(payload),
      asAdmin: true,
    }),
  getStats: () => httpRequest<AdminStats>("/api/admin/stats", { asAdmin: true }),
};

