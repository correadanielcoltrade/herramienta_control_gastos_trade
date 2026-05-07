import { apiClient } from "./client";
import type { AuthResponse, ForgotPasswordPayload, ResetPasswordPayload, User } from "../types";

export const authApi = {
  async login(correo: string, password: string) {
    const normalizedEmail = correo.trim().toLowerCase();
    const { data } = await apiClient.post<AuthResponse>("/auth/login", {
      correo: normalizedEmail,
      password,
    });
    return data;
  },
  async me() {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
  async forgotPassword(payload: ForgotPasswordPayload) {
    const normalizedEmail = payload.correo.trim().toLowerCase();
    const { data } = await apiClient.post<{ message: string }>("/auth/forgot-password", {
      correo: normalizedEmail,
    });
    return data;
  },
  async resetPassword(payload: ResetPasswordPayload) {
    const { data } = await apiClient.post<{ message: string }>("/auth/reset-password", payload);
    return data;
  },
};
