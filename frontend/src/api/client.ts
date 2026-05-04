import axios from "axios";

import { authStore } from "../store/auth-store";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
});

apiClient.interceptors.request.use((config) => {
  const token = authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.clearToken();
    }
    return Promise.reject(error);
  },
);

