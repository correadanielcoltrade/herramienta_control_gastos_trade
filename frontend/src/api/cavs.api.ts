import { apiClient } from "./client";
import type { Cav } from "../types";

export const cavsApi = {
  async list() {
    const { data } = await apiClient.get<Cav[]>("/cavs");
    return data;
  },
  async create(payload: { nombre_cav: string; centro_costos: string; regional?: string | null }) {
    const { data } = await apiClient.post<Cav>("/cavs", payload);
    return data;
  },
  async update(
    cavId: number,
    payload: Partial<{ nombre_cav: string; centro_costos: string; regional: string | null }>,
  ) {
    const { data } = await apiClient.put<Cav>(`/cavs/${cavId}`, payload);
    return data;
  },
  async remove(cavId: number) {
    await apiClient.delete(`/cavs/${cavId}`);
  },
};

