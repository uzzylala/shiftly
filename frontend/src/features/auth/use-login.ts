import { useMutation } from "@tanstack/react-query";
import type { LoginRequest, LoginResponse } from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../store/auth-store";

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      setSession(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    },
  });
}
