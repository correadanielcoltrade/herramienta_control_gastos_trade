import { apiClient } from "./client";
import type { AprobarNovedadPayload, Novedad, NovedadResolucion } from "../types";

export const novedadesApi = {
  async list(cavId?: number, regional?: string) {
    const params: Record<string, string | number> = {};
    if (cavId) params.cav_id = cavId;
    if (regional) params.regional = regional;
    const { data } = await apiClient.get<Novedad[]>("/novedades/", { params });
    return data;
  },
  async darDeBaja(serialId: number, observacion: string) {
    const { data } = await apiClient.post(`/novedades/${serialId}/dar-de-baja`, { observacion });
    return data;
  },
  async aprobar(serialId: number, payload: AprobarNovedadPayload) {
    const { data } = await apiClient.post<NovedadResolucion>(`/novedades/${serialId}/aprobar`, payload);
    return data;
  },
  async listAprobaciones() {
    const { data } = await apiClient.get<NovedadResolucion[]>("/novedades/aprobaciones");
    return data;
  },
  async opsAprobar(resolucionId: number, observacion?: string) {
    const { data } = await apiClient.post(`/novedades/aprobaciones/${resolucionId}/aprobar`, {
      observacion: observacion || null,
    });
    return data;
  },
  async opsRechazar(resolucionId: number, observacion: string) {
    const { data } = await apiClient.post(`/novedades/aprobaciones/${resolucionId}/rechazar`, {
      observacion,
    });
    return data;
  },
};
