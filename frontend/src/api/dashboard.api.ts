import { apiClient } from "./client";
import type { DashboardFilters, DashboardResponse } from "../types";

export const dashboardApi = {
  async getSummary(filters: DashboardFilters = {}) {
    const { data } = await apiClient.get<DashboardResponse>("/dashboard/summary", {
      params: filters,
    });
    return data;
  },
};

