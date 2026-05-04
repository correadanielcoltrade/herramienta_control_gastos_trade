import { apiClient } from "./client";
import type {
  DashboardFilters,
  LegalizationRecord,
  LegalizationPayload,
  ReceiptPayload,
  ReceptionRecord,
  ReceptionResult,
  SerialFilters,
  SerialMovement,
  SerialRecord,
  SupplyFilters,
  SupplyPayload,
  SupplyRecord,
} from "../types";

export const serialsApi = {
  async list(filters: SerialFilters = {}) {
    const { data } = await apiClient.get<SerialRecord[]>("/serials", { params: filters });
    return data;
  },
  async getMovements(serialId: number) {
    const { data } = await apiClient.get<SerialMovement[]>(`/serials/${serialId}/movements`);
    return data;
  },
  async createSupply(payload: SupplyPayload) {
    const { data } = await apiClient.post<SupplyRecord>("/serials/supplies", payload);
    return data;
  },
  async listSupplies(filters: SupplyFilters = {}) {
    const { data } = await apiClient.get<SupplyRecord[]>("/serials/supplies", {
      params: filters,
    });
    return data;
  },
  async updateSupply(supplyId: number, payload: SupplyPayload) {
    const { data } = await apiClient.put<SupplyRecord>(`/serials/supplies/${supplyId}`, payload);
    return data;
  },
  async deleteSupply(supplyId: number) {
    const { data } = await apiClient.delete<{ deleted: number }>(`/serials/supplies/${supplyId}`);
    return data;
  },
  async deleteSupplies(supplyIds: number[]) {
    const { data } = await apiClient.post<{ deleted: number }>("/serials/supplies/delete-batch", {
      supply_ids: supplyIds,
    });
    return data;
  },
  async createReceipts(payload: ReceiptPayload) {
    const { data } = await apiClient.post<ReceptionResult>("/serials/receipts", payload);
    return data;
  },
  async listReceipts() {
    const { data } = await apiClient.get<ReceptionRecord[]>("/serials/receipts");
    return data;
  },
  async createLegalization(payload: LegalizationPayload) {
    const { data } = await apiClient.post<SerialRecord>("/serials/legalizations", payload);
    return data;
  },
  async listLegalizations(filters: DashboardFilters = {}) {
    const { data } = await apiClient.get<LegalizationRecord[]>("/serials/legalizations", {
      params: filters,
    });
    return data;
  },
  async markDuplicate(serial: string, notes?: string) {
    const { data } = await apiClient.post<SerialRecord>("/serials/duplicates", {
      serial,
      notes,
    });
    return data;
  },
};
