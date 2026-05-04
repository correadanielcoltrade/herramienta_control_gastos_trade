import { apiClient } from "./client";
import type { Role, User } from "../types";

export const usersApi = {
  async list() {
    const { data } = await apiClient.get<User[]>("/users");
    return data;
  },
  async listRoles() {
    const { data } = await apiClient.get<Role[]>("/users/roles");
    return data;
  },
  async create(payload: {
    nombre_usuario: string;
    correo: string;
    password: string;
    role_id: number;
    cav_id: number | null;
    is_active: boolean;
  }) {
    const { data } = await apiClient.post<User>("/users", payload);
    return data;
  },
  async update(
    userId: number,
    payload: Partial<{
      nombre_usuario: string;
      correo: string;
      password: string;
      role_id: number;
      cav_id: number | null;
      is_active: boolean;
    }>,
  ) {
    const { data } = await apiClient.put<User>(`/users/${userId}`, payload);
    return data;
  },
};

