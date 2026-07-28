import { apiClient } from "./client";
import type {
  AprobarNovedadPayload,
  Novedad,
  NovedadBaja,
  NovedadCerrada,
  NovedadResolucion,
  NovedadSoporte,
} from "../types";

export const novedadesApi = {
  async list(cavId?: number, regional?: string) {
    const params: Record<string, string | number> = {};
    if (cavId) params.cav_id = cavId;
    if (regional) params.regional = regional;
    const { data } = await apiClient.get<Novedad[]>("/novedades/", { params });
    return data;
  },
  async listBajas(cavId?: number, regional?: string) {
    const params: Record<string, string | number> = {};
    if (cavId) params.cav_id = cavId;
    if (regional) params.regional = regional;
    const { data } = await apiClient.get<NovedadBaja[]>("/novedades/bajas", { params });
    return data;
  },
  async listCerradas(cavId?: number, regional?: string) {
    const params: Record<string, string | number> = {};
    if (cavId) params.cav_id = cavId;
    if (regional) params.regional = regional;
    const { data } = await apiClient.get<NovedadCerrada[]>("/novedades/cerradas", { params });
    return data;
  },
  /** Sube el archivo de soporte y devuelve su id para adjuntarlo a la solicitud. */
  async subirSoporte(archivo: File) {
    const body = new FormData();
    body.append("archivo", archivo);
    const { data } = await apiClient.post<NovedadSoporte>("/novedades/soportes", body);
    return data;
  },
  /** Abre el soporte en una pestana nueva (la descarga necesita el token del cliente). */
  async abrirSoporte(soporteId: number) {
    const { data } = await apiClient.get<Blob>(`/novedades/soportes/${soporteId}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    // Se libera despues de que el navegador alcanza a abrirlo.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  /** Crea la solicitud de baja; queda pendiente de aprobacion por OPS. */
  async solicitarBaja(serialId: number, observacion: string, soporteId: number) {
    const { data } = await apiClient.post<NovedadResolucion>(
      `/novedades/${serialId}/dar-de-baja`,
      { observacion, soporte_id: soporteId },
    );
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
