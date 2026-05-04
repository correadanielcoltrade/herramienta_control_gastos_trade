import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { user, login, loginError, loginErrorMessage, isLoading } = useAuth();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login({ correo, password });
    } catch {
      // El error ya lo maneja React Query y se muestra en pantalla.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#f3f0ff_0%,_#fdf2f8_50%,_#ecf9ff_100%)] px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] bg-white shadow-2xl md:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-white md:block">
          <p className="text-xs uppercase tracking-[0.45em] text-brand-200">Inventario inteligente</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">
            Trazabilidad completa del serial, desde el envio hasta la legalizacion.
          </h1>
        </div>
        <div className="p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.35em] text-brand-600">Acceso seguro</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Inicia sesion</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usa tus credenciales para ingresar a la herramienta.
          </p>
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Correo</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                placeholder="tu correo de Acceso"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Contrasena</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
              />
            </label>
            {loginError ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loginErrorMessage ?? "No fue posible iniciar sesion. Verifica tus datos."}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700 shadow-button disabled:opacity-60"
            >
              {isLoading ? "Ingresando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
