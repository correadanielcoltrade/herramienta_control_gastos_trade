import { apiClient } from "./client";
import type { AuthResponse, User } from "../types";

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
};
