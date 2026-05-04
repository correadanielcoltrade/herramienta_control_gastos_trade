import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <h1 className="text-4xl font-bold text-slate-900">Ruta no encontrada</h1>
      <p className="max-w-md text-sm text-slate-600">La pantalla que buscas no existe o no esta disponible para tu rol.</p>
      <Link to="/" className="rounded-2xl bg-brand-600 px-5 py-3 font-medium text-white">
        Volver al dashboard
      </Link>
    </div>
  );
}

