import axios from "axios";

import { authStore } from "../store/auth-store";
import { environment } from "../config/environment";

export const apiClient = axios.create({
  baseURL: environment.apiBaseUrl,
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

