import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Lock } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { authApi } from "../api/auth.api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: () => authApi.resetPassword({ token: token!, password }),
    onSuccess: () => {
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Link Inválido</h1>
            </div>
            <p className="mb-6 text-center text-slate-600">
              El enlace de recuperación no es válido o ha expirado.
            </p>
            <Link
              to="/forgot-password"
              className="block rounded-2xl bg-brand-600 px-4 py-3 text-center font-medium text-white transition hover:bg-brand-700"
            >
              Solicitar Nuevo Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function validatePassword() {
    if (password.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return false;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return false;
    }
    setPasswordError(null);
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validatePassword()) return;
    await resetPasswordMutation.mutateAsync();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          {/* Logo/Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700">
              <Lock size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Nueva Contraseña</h1>
            <p className="mt-2 text-slate-600">Crea una contraseña segura para tu cuenta</p>
          </div>

          {resetPasswordMutation.isSuccess ? (
            <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
              <p className="font-medium">✓ Contraseña actualizada correctamente</p>
              <p className="mt-2 text-emerald-600">Redirigiendo al login...</p>
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nueva Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  required
                  disabled={resetPasswordMutation.isPending || resetPasswordMutation.isSuccess}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Confirmar Contraseña
              </span>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                }}
                required
                disabled={resetPasswordMutation.isPending || resetPasswordMutation.isSuccess}
              />
            </label>

            {passwordError ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {passwordError}
              </div>
            ) : null}

            {resetPasswordMutation.isError ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {(resetPasswordMutation.error as any)?.response?.data?.detail ||
                  "No fue posible actualizar la contraseña."}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                !password || !confirmPassword || resetPasswordMutation.isPending || resetPasswordMutation.isSuccess
              }
              className="w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 font-medium text-white transition hover:shadow-lg disabled:opacity-60"
            >
              {resetPasswordMutation.isPending ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              ¿Prefiere recuperación diferente?{" "}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                Volver al login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
