import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { authApi } from "../api/auth.api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: (correo: string) => authApi.forgotPassword({ correo }),
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setEmail("");
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    await forgotPasswordMutation.mutateAsync(email);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          {/* Logo/Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700">
              <Mail size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Recuperar Contraseña</h1>
            <p className="mt-2 text-slate-600">
              Ingresa tu correo para recibir instrucciones de recuperación
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Correo Electrónico</span>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={forgotPasswordMutation.isPending || successMessage !== null}
              />
            </label>

            {successMessage ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                <p className="font-medium">✓ {successMessage}</p>
                <p className="mt-2 text-emerald-600">
                  Revisa tu bandeja de entrada (y spam) para el link de recuperación.
                </p>
              </div>
            ) : null}

            {forgotPasswordMutation.isError ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {(forgotPasswordMutation.error as any)?.response?.data?.detail ||
                  "No fue posible procesar la solicitud."}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                !email.trim() || forgotPasswordMutation.isPending || successMessage !== null
              }
              className="w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 font-medium text-white transition hover:shadow-lg disabled:opacity-60"
            >
              {forgotPasswordMutation.isPending ? "Enviando..." : "Enviar Instrucciones"}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              ¿Recordaste tu contraseña?{" "}
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
