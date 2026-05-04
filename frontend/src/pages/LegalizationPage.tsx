import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";

import { serialsApi } from "../api/serials.api";
import { Panel } from "../components/Panel";
import { PageTitle } from "../components/PageTitle";
import { QRScanner } from "../components/QRScanner";
import { SignaturePad } from "../components/SignaturePad";
import { useAuth } from "../hooks/useAuth";

type LegalizationFormState = {
  asesor_responsable: string;
  cliente_asesor: string;
  documento_cliente: string;
  fecha: string;
  firma: string;
  serial: string;
  tipo_inventario: string;
  tipo_uso: string;
};

function buildWorksheet(rows: Array<Array<number | string>>) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const headerRow = rows[0] ?? [];

  worksheet["!cols"] = headerRow.map((header) => ({
    wch: Math.max(String(header).length + 4, 18),
  }));

  return worksheet;
}

function triggerExcelDownload(
  fileName: string,
  sheets: Array<{ name: string; rows: Array<Array<number | string>> }>,
) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(sheet.rows), sheet.name);
  });

  XLSX.writeFile(workbook, fileName, { compression: true });
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { detail?: string } }; message?: string } | null)?.response?.data?.detail ??
    (error as { message?: string } | null)?.message ??
    fallback
  );
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toLegalizationIso(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

function getInitialForm(asesorResponsable?: string | null): LegalizationFormState {
  return {
    asesor_responsable: asesorResponsable ?? "",
    cliente_asesor: "",
    documento_cliente: "",
    fecha: getTodayInputValue(),
    firma: "",
    serial: "",
    tipo_inventario: "",
    tipo_uso: "",
  };
}

export function LegalizationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [serialValidationMessage, setSerialValidationMessage] = useState<string | null>(null);
  const [form, setForm] = useState<LegalizationFormState>(() => getInitialForm(user?.nombre_usuario));

  useEffect(() => {
    setForm((current) =>
      current.asesor_responsable
        ? current
        : {
            ...current,
            asesor_responsable: user?.nombre_usuario ?? "",
          },
    );
  }, [user]);

  const serialsQuery = useQuery({
    queryKey: ["serials", "available", search],
    queryFn: () => serialsApi.list({ status: "disponible", serial: search || undefined }),
  });
  const legalizationsQuery = useQuery({
    queryKey: ["legalizations", "history"],
    queryFn: () => serialsApi.listLegalizations(),
  });
  const serialAvailabilityQuery = useQuery({
    queryKey: ["serials", "available", "legalization", form.serial.trim()],
    queryFn: () => serialsApi.list({ status: "disponible", serial: form.serial.trim() }),
    enabled: form.serial.trim().length > 0,
  });

  const legalizationMutation = useMutation({
    mutationFn: serialsApi.createLegalization,
    onSuccess: async () => {
      setForm(getInitialForm(user?.nombre_usuario));
      setSerialValidationMessage(null);
      setScannerActive(false);
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["legalizations"], refetchType: "all" });
    },
  });

  const normalizedFormSerial = form.serial.trim();
  const exactAvailableSerial =
    serialAvailabilityQuery.data?.find((item) => item.serial.trim() === normalizedFormSerial) ?? null;
  const canSubmit = Boolean(exactAvailableSerial && form.firma);

  function updateForm<Field extends keyof LegalizationFormState>(field: Field, value: LegalizationFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleDetectedSerial(value: string) {
    updateForm("serial", value);
    setSearch(value);
    setScannerActive(false);
    setSerialValidationMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exactAvailableSerial) {
      setSerialValidationMessage("El serial digitado o escaneado no esta disponible para legalizar.");
      return;
    }

    if (!form.firma) {
      setSerialValidationMessage("Debes registrar la firma antes de guardar la legalizacion.");
      return;
    }

    try {
      await legalizationMutation.mutateAsync({
        serial: normalizedFormSerial,
        tipo_inventario: form.tipo_inventario,
        tipo_uso: form.tipo_uso,
        cliente_asesor: form.cliente_asesor,
        documento_cliente: form.documento_cliente.trim() || undefined,
        firma: form.firma,
        asesor_responsable: form.asesor_responsable,
        fecha: toLegalizationIso(form.fecha),
      });
    } catch {
      // React Query conserva el error y lo mostramos en pantalla.
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  function handleExportAvailableSerials() {
    const rows = serialsQuery.data ?? [];
    if (rows.length === 0) {
      return;
    }

    triggerExcelDownload("seriales-disponibles-para-legalizar.xlsx", [
      {
        name: "Disponibles",
        rows: [
          ["serial", "descripcion_producto", "cav", "estado"],
          ...rows.map((item) => [
            item.serial,
            item.descripcion_producto ?? "",
            item.cav?.nombre_cav ?? "",
            item.current_status,
          ]),
        ],
      },
    ]);
  }

  function handleExportLegalizedSerials() {
    const rows = legalizationsQuery.data ?? [];
    if (rows.length === 0) {
      return;
    }

    triggerExcelDownload("seriales-legalizados.xlsx", [
      {
        name: "Legalizados",
        rows: [
          [
            "fecha",
            "serial",
            "tipo_inventario",
            "tipo_uso",
            "cliente_asesor",
            "documento_cliente",
            "asesor_responsable",
            "registrado_por",
            "cav",
          ],
          ...rows.map((item) => [
            formatDate(item.fecha),
            item.serial,
            item.tipo_inventario,
            item.tipo_uso,
            item.cliente_asesor,
            item.documento_cliente ?? "",
            item.asesor_responsable,
            item.registrado_por,
            item.cav?.nombre_cav ?? "",
          ]),
        ],
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Legalizacion"
        description="Convierte seriales disponibles en gastos legalizados con captura operativa, firma y validacion contra inventario disponible."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Registrar legalizacion" subtitle="Escanea o digita el serial y completa los datos operativos del registro.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setScannerActive((current) => !current)}
                className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white"
              >
                {scannerActive ? "Detener camara" : "Escanear con camara"}
              </button>
            </div>

            {scannerActive ? <QRScanner active={scannerActive} onDetected={handleDetectedSerial} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Serial</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Escanea o digita el serial"
                  value={form.serial}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateForm("serial", nextValue);
                    setSearch(nextValue);
                    setSerialValidationMessage(null);
                  }}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Fecha</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  type="date"
                  value={form.fecha}
                  onChange={(event) => updateForm("fecha", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tipo de inventario</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Tipo de inventario"
                  value={form.tipo_inventario}
                  onChange={(event) => updateForm("tipo_inventario", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tipo de uso</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Tipo de uso"
                  value={form.tipo_uso}
                  onChange={(event) => updateForm("tipo_uso", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Cliente</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Cliente o asesor"
                  value={form.cliente_asesor}
                  onChange={(event) => updateForm("cliente_asesor", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Documento de cliente (solo garantias)</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Opcional"
                  value={form.documento_cliente}
                  onChange={(event) => updateForm("documento_cliente", event.target.value)}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Asesor responsable</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Asesor responsable"
                  value={form.asesor_responsable}
                  onChange={(event) => updateForm("asesor_responsable", event.target.value)}
                  required
                />
              </label>
            </div>

            {normalizedFormSerial ? (
              exactAvailableSerial ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <p className="font-medium">Serial disponible para legalizar: {exactAvailableSerial.serial}</p>
                  <p className="mt-1">{exactAvailableSerial.descripcion_producto ?? "Sin descripcion"}</p>
                </div>
              ) : serialAvailabilityQuery.isFetching ? (
                <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Validando serial...</p>
              ) : (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  El serial digitado o escaneado no esta disponible para legalizar.
                </p>
              )
            ) : null}

            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Firma</span>
              <SignaturePad value={form.firma} onChange={(value) => updateForm("firma", value)} />
            </div>

            {serialValidationMessage ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{serialValidationMessage}</p>
            ) : null}
            {legalizationMutation.isError ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {getErrorMessage(legalizationMutation.error, "No fue posible legalizar el serial.")}
              </p>
            ) : null}

            <button
              className="w-full rounded-2xl bg-brand-600 px-4 py-3 font-medium text-white disabled:opacity-60"
              disabled={!canSubmit || legalizationMutation.isPending}
            >
              {legalizationMutation.isPending ? "Guardando..." : "Legalizar serial"}
            </button>
          </form>
        </Panel>

        <Panel title="Disponibles para gastar" subtitle="Busca por serial y usa la lista como apoyo de operacion.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Buscar serial disponible"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                type="button"
                onClick={handleExportAvailableSerials}
                disabled={serialsQuery.isLoading || (serialsQuery.data?.length ?? 0) === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Exportar disponibles
              </button>
            </div>
            <div className="space-y-3">
              {serialsQuery.data?.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearch(item.serial);
                    updateForm("serial", item.serial);
                    setSerialValidationMessage(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <p className="font-semibold text-slate-900">{item.serial}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.descripcion_producto}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-700">{item.cav?.nombre_cav}</p>
                </button>
              ))}
              {serialsQuery.data?.length === 0 ? (
                <p className="text-sm text-slate-500">No hay seriales disponibles con ese filtro.</p>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Seriales legalizados"
        subtitle="Consulta el historial de legalizaciones con los datos completos registrados en el formulario."
      >
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleExportLegalizedSerials}
            disabled={legalizationsQuery.isLoading || (legalizationsQuery.data?.length ?? 0) === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Exportar legalizados
          </button>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] divide-y divide-slate-200 text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Serial</th>
                  <th className="px-4 py-3 font-semibold">Tipo de inventario</th>
                  <th className="px-4 py-3 font-semibold">Tipo de uso</th>
                  <th className="px-4 py-3 font-semibold">Cliente/Asesor</th>
                  <th className="px-4 py-3 font-semibold">Documento cliente</th>
                  <th className="px-4 py-3 font-semibold">Asesor responsable</th>
                  <th className="px-4 py-3 font-semibold">Registrado por</th>
                  <th className="px-4 py-3 font-semibold">CAV</th>
                  <th className="px-4 py-3 font-semibold">Firma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {legalizationsQuery.isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                      Cargando legalizaciones...
                    </td>
                  </tr>
                ) : legalizationsQuery.data && legalizationsQuery.data.length > 0 ? (
                  legalizationsQuery.data.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-4">{formatDate(item.fecha)}</td>
                      <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                      <td className="px-4 py-4">{item.tipo_inventario}</td>
                      <td className="px-4 py-4">{item.tipo_uso}</td>
                      <td className="px-4 py-4">{item.cliente_asesor}</td>
                      <td className="px-4 py-4">{item.documento_cliente ?? "N/A"}</td>
                      <td className="px-4 py-4">{item.asesor_responsable}</td>
                      <td className="px-4 py-4">{item.registrado_por}</td>
                      <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                      <td className="px-4 py-4">
                        <img
                          src={item.firma}
                          alt={`Firma ${item.serial}`}
                          className="h-14 w-28 rounded-xl border border-slate-200 bg-white object-contain"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                      Aun no hay seriales legalizados para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}
