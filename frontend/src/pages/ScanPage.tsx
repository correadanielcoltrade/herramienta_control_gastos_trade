import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { cavsApi } from "../api/cavs.api";
import { serialsApi } from "../api/serials.api";
import { Panel } from "../components/Panel";
import { PageTitle } from "../components/PageTitle";
import { QRScanner } from "../components/QRScanner";
import { useAuth } from "../hooks/useAuth";
import { hasGlobalCavAccess } from "../utils/access";
import type { BlockedSerial } from "../types";

export function ScanPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasGlobalAccess = hasGlobalCavAccess(user?.role.name);
  const [scannerActive, setScannerActive] = useState(false);
  const [seriales, setSeriales] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedCav, setSelectedCav] = useState<number | "">(hasGlobalAccess ? "" : user?.cav_id ?? "");
  const [manualSerial, setManualSerial] = useState("");
  const [serialesBloqueados, setSerialesBloqueados] = useState<BlockedSerial[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!hasGlobalAccess) {
      setSelectedCav(user.cav_id ?? "");
    }
  }, [hasGlobalAccess, user]);

  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const receiptsQuery = useQuery({
    queryKey: ["receipts", "history"],
    queryFn: serialsApi.listReceipts,
    enabled: Boolean(user),
  });
  const receiptMutation = useMutation({
    mutationFn: serialsApi.createReceipts,
    onSuccess: async (data) => {
      let successMessage = "Recibo guardado exitosamente. ";

      if (data.procesados.length > 0) {
        successMessage += `${data.procesados.length} serial(es) disponible(s) para usar. `;
      }

      if (data.pendientes.length > 0) {
        successMessage += `${data.pendientes.length} novedad(es) registrada(s). `;
      }

      if (data.duplicados.length > 0) {
        successMessage += `Aviso: ${data.duplicados.length} duplicado(s): ${data.duplicados.join(", ")}. `;
      }

      if (data.bloqueados.length > 0) {
        successMessage += `${data.bloqueados.length} bloqueado(s) - requieren reasignacion de CAV.`;
      }

      setFeedback(successMessage.trim());
      setSerialesBloqueados(data.bloqueados ?? []);
      setSeriales([]);
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["receipts"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Error al guardar el recibo.";
      setFeedback(`Error: ${errorMessage}`);
      setSerialesBloqueados([]);
    },
  });

  function formatReceiptDate(value: string) {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function handleDetected(value: string) {
    addSerial(value);
  }

  function addSerial(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    setSeriales((current) => {
      if (current.includes(trimmedValue)) {
        setFeedback(`El serial ${trimmedValue} ya estaba en la lista.`);
        return current;
      }
      setFeedback(`Serial ${trimmedValue} agregado.`);
      return [trimmedValue, ...current];
    });
  }

  function handleAddManualSerial() {
    if (manualSerial.trim()) {
      addSerial(manualSerial);
      setManualSerial("");
    }
  }

  function handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleAddManualSerial();
    }
  }

  async function handleSave() {
    if (!selectedCav) {
      setFeedback("Aviso: Debes seleccionar un CAV para guardar el recibo.");
      return;
    }
    if (seriales.length === 0) {
      setFeedback("Aviso: No hay seriales para guardar. Escanea o ingresa al menos uno.");
      return;
    }
    setFeedback("Guardando recibo...");
    try {
      await receiptMutation.mutateAsync({
        cav_id: Number(selectedCav),
        fecha: new Date().toISOString(),
        seriales,
      });
    } catch {
      // El mensaje visible se asigna en onError.
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Recibo de inventario de gastos"
        description="Captura seriales desde la camara, consolida el lote y guarda el recibo del inventario con feedback inmediato."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Captura de recibo" subtitle="Pensado para operacion movil con botones grandes y lectura continua.">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedCav}
                onChange={(event) => setSelectedCav(event.target.value ? Number(event.target.value) : "")}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                disabled={!hasGlobalAccess}
              >
                <option value="">Selecciona CAV</option>
                {cavsQuery.data?.map((cav) => (
                  <option key={cav.id} value={cav.id}>
                    {cav.nombre_cav}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setScannerActive((current) => !current)}
                className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 transition shadow-button"
              >
                {scannerActive ? "Detener camara" : "Iniciar camara"}
              </button>
              <button
                onClick={handleSave}
                className="rounded-2xl bg-accent-600 px-5 py-3 text-sm font-medium text-white hover:bg-accent-700 transition shadow-button"
              >
                Guardar recibo
              </button>
            </div>
            <QRScanner active={scannerActive} onDetected={handleDetected} />

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700">Ingresar serial manualmente (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualSerial}
                  onChange={(event) => setManualSerial(event.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe el serial aqui y presiona Enter o Agregar"
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm placeholder-slate-400"
                />
                <button
                  onClick={handleAddManualSerial}
                  className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 transition shadow-button"
                >
                  Agregar
                </button>
              </div>
              <p className="text-xs text-slate-500">Si no puedes escanear con la camara, escribe el serial manualmente aqui.</p>
            </div>

            {feedback ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  feedback.includes("guardado exitosamente")
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : feedback.startsWith("Error:")
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : feedback.startsWith("Aviso:")
                        ? "border border-yellow-200 bg-yellow-50 text-yellow-700"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                {feedback}
              </div>
            ) : null}

            {serialesBloqueados.length > 0 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="font-semibold text-red-700">
                  {serialesBloqueados.length} serial(es) bloqueado(s)
                </p>
                <p className="mt-1 text-sm text-red-600">
                  Estos seriales fueron abastecidos a un CAV diferente. Para recibirlos,
                  ve a Abastecimiento y reasigna el CAV de cada serial al CAV actual.
                </p>
                <ul className="mt-3 space-y-1">
                  {serialesBloqueados.map((b) => (
                    <li key={b.serial} className="flex items-center gap-2 text-sm text-red-700">
                      <span className="font-mono font-semibold">{b.serial}</span>
                      <span className="text-red-500">debe ir al CAV: {b.cav_asignado_nombre}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Lote escaneado" subtitle="El listado evita capturas duplicadas y deja listo el envio al backend.">
          <div className="space-y-3">
            <div className="rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 px-4 py-4 text-brand-900 border border-brand-200">
              <p className="text-sm font-medium">Seriales en memoria</p>
              <p className="mt-2 text-3xl font-semibold">{seriales.length}</p>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {seriales.map((item) => {
                const isBlocked = serialesBloqueados.some((b) => b.serial === item);
                return (
                  <div
                    key={item}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                      isBlocked ? "border-red-300 bg-red-50" : "border-slate-200"
                    }`}
                  >
                    <span className={`font-medium ${isBlocked ? "text-red-700" : "text-slate-800"}`}>{item}</span>
                    <button
                      onClick={() => setSeriales((current) => current.filter((value) => value !== item))}
                      className="text-sm text-rose-600"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
              {seriales.length === 0 ? <p className="text-sm text-slate-500">Aun no hay seriales escaneados.</p> : null}
            </div>
          </div>
        </Panel>
      </div>

      {user ? (
        <Panel
          title="Recibos confirmados"
          subtitle="Tabla de seguimiento con seriales escaneados, usuario que guardo el recibo y fecha de confirmacion."
        >
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Serial escaneado</th>
                    <th className="px-4 py-3 font-semibold">CAV</th>
                    <th className="px-4 py-3 font-semibold">Guardo recibo</th>
                    <th className="px-4 py-3 font-semibold">Fecha de confirmacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiptsQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                        Cargando recibos confirmados...
                      </td>
                    </tr>
                  ) : receiptsQuery.data && receiptsQuery.data.length > 0 ? (
                    receiptsQuery.data.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                        <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                        <td className="px-4 py-4">{item.confirmado_por}</td>
                        <td className="px-4 py-4">{formatReceiptDate(item.fecha)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                        Aun no hay recibos confirmados para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
