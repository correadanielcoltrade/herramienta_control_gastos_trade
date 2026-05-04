import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { authApi } from "../api/auth.api";
import { authStore } from "../store/auth-store";

export function useAuth() {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(authStore.subscribe, authStore.getToken, authStore.getToken);

  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: authApi.me,
    enabled: Boolean(token),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ correo, password }: { correo: string; password: string }) =>
      authApi.login(correo, password),
    onSuccess: (data) => {
      authStore.setToken(data.access_token);
      queryClient.setQueryData(["auth", "me", data.access_token], data.user);
      queryClient.removeQueries({ queryKey: ["auth", "me", null] });
    },
  });

  const logout = () => {
    authStore.clearToken();
    queryClient.removeQueries({ queryKey: ["auth"] });
  };

  return {
    token,
    user: meQuery.data ?? null,
    isAuthenticated: Boolean(token && meQuery.data),
    isLoading: meQuery.isLoading || loginMutation.isPending,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    loginErrorMessage:
      (loginMutation.error as { response?: { data?: { detail?: string } }; message?: string } | null)
        ?.response?.data?.detail ??
      (loginMutation.error as { message?: string } | null)?.message ??
      null,
    logout,
  };
}
