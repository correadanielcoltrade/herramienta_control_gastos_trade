import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

import { cavsApi } from "../api/cavs.api";
import { serialsApi } from "../api/serials.api";
import { Panel } from "../components/Panel";
import { PageTitle } from "../components/PageTitle";
import { useAuth } from "../hooks/useAuth";
import type { SupplyFilters, SupplyPayload, SupplyRecord, User } from "../types";
import { canManageSupplies, hasGlobalCavAccess } from "../utils/access";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70";

const modalInputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70";

type SupplyFormState = {
  serial: string;
  descripcion_producto: string;
  centro_costos_cav: string;
  cav_id: string;
  fecha_envio: string;
};

type SupplyFilterState = {
  cav_id: string;
  end_date: string;
  producto: string;
  serial: string;
  start_date: string;
};

type BulkImportSummary = {
  errorLines: string[];
  failureCount: number;
  fileName: string;
  successCount: number;
};

interface SupplyModalProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  subtitle: string;
  title: string;
}

interface SupplyModalFieldProps extends PropsWithChildren {
  label: string;
}

const importTemplateHeaders = ["serial", "descripcion_producto", "fecha_envio", "nombre_cav"];

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { detail?: string } }; message?: string } | null)?.response?.data?.detail ??
    (error as { message?: string } | null)?.message ??
    fallback
  );
}

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

function parseExcelRows(rows: unknown[][]) {
  const [rawHeaders, ...dataRows] = rows;

  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error("El archivo esta vacio.");
  }

  const headers = rawHeaders.map((header) => String(header ?? "").trim().toLowerCase());
  const missingHeaders = importTemplateHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(", ")}.`);
  }

  return {
    headers,
    rows: dataRows,
  };
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toSupplyIso(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

function fromSupplyIso(dateValue?: string | null) {
  if (!dateValue) {
    return getTodayInputValue();
  }

  return dateValue.slice(0, 10);
}

function formatSupplyDate(dateValue?: string | null) {
  if (!dateValue) {
    return "Sin fecha registrada";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue));
}

function normalizeImportDate(dateValue: string) {
  const trimmedValue = dateValue.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return toSupplyIso(trimmedValue);
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Fecha invalida. Usa formato YYYY-MM-DD.");
  }

  return parsedDate.toISOString();
}

function normalizeCavName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getInitialForm(user?: User | null): SupplyFormState {
  return {
    serial: "",
    descripcion_producto: "",
    centro_costos_cav: "",
    cav_id: hasGlobalCavAccess(user?.role.name) ? "" : String(user?.cav_id ?? ""),
    fecha_envio: getTodayInputValue(),
  };
}

function getInitialFilters(user?: User | null): SupplyFilterState {
  return {
    cav_id: hasGlobalCavAccess(user?.role.name) ? "" : String(user?.cav_id ?? ""),
    end_date: "",
    producto: "",
    serial: "",
    start_date: "",
  };
}

function toPayload(form: SupplyFormState): SupplyPayload {
  return {
    serial: form.serial,
    descripcion_producto: form.descripcion_producto,
    cav_id: Number(form.cav_id),
    centro_costos_cav: form.centro_costos_cav,
    fecha_envio: toSupplyIso(form.fecha_envio),
  };
}

function toSupplyFilters(filters: SupplyFilterState): SupplyFilters {
  return {
    cav_id: filters.cav_id ? Number(filters.cav_id) : undefined,
    end_date: filters.end_date || undefined,
    producto: filters.producto.trim() || undefined,
    serial: filters.serial.trim() || undefined,
    start_date: filters.start_date || undefined,
  };
}

function toEditForm(record: SupplyRecord): SupplyFormState {
  return {
    serial: record.serial,
    descripcion_producto: record.descripcion_producto,
    centro_costos_cav: record.centro_costos_cav,
    cav_id: String(record.cav_id),
    fecha_envio: fromSupplyIso(record.fecha_envio),
  };
}

function SupplyModalField({ label, children }: SupplyModalFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SupplyModal({ isOpen, onClose, subtitle, title, children }: SupplyModalProps) {
  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-3 py-6 backdrop-blur-[3px] sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Cerrar modal" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-100/90 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-[30rem]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Abastecimiento</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Cerrar modal"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

interface SupplyFormProps {
  actionLabel: string;
  cavDisabled: boolean;
  cavs: Array<{ id: number; nombre_cav: string }>;
  errorMessage: string | null;
  form: SupplyFormState;
  isPending: boolean;
  onCavChange: (value: string) => void;
  onClose: () => void;
  onFieldChange: (field: keyof SupplyFormState, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function SupplyForm({
  actionLabel,
  cavDisabled,
  cavs,
  errorMessage,
  form,
  isPending,
  onCavChange,
  onClose,
  onFieldChange,
  onSubmit,
}: SupplyFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <SupplyModalField label="Serial">
            <input
              className={modalInputClassName}
              placeholder="Ingresa el serial"
              value={form.serial}
              onChange={(event) => onFieldChange("serial", event.target.value)}
              required
            />
          </SupplyModalField>
        </div>

        <div className="md:col-span-2">
          <SupplyModalField label="Descripcion del producto">
            <input
              className={modalInputClassName}
              placeholder="Describe el producto"
              value={form.descripcion_producto}
              onChange={(event) => onFieldChange("descripcion_producto", event.target.value)}
              required
            />
          </SupplyModalField>
        </div>

        <SupplyModalField label="Fecha">
          <input
            className={modalInputClassName}
            type="date"
            value={form.fecha_envio}
            onChange={(event) => onFieldChange("fecha_envio", event.target.value)}
            required
          />
        </SupplyModalField>

        <SupplyModalField label="CAV">
          <select
            className={modalInputClassName}
            value={form.cav_id}
            onChange={(event) => onCavChange(event.target.value)}
            required
            disabled={cavDisabled}
          >
            <option value="">Selecciona CAV</option>
            {cavs.map((cav) => (
              <option key={cav.id} value={cav.id}>
                {cav.nombre_cav}
              </option>
            ))}
          </select>
        </SupplyModalField>

        <div className="md:col-span-2">
          <SupplyModalField label="Centro de costo del CAV">
            <input
              className={`${modalInputClassName} bg-slate-50`}
              placeholder="Se completa segun el CAV seleccionado"
              value={form.centro_costos_cav}
              readOnly
              required
            />
          </SupplyModalField>
        </div>
      </div>

      {errorMessage ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-2xl bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          disabled={isPending}
        >
          {isPending ? "Guardando..." : actionLabel}
        </button>
      </div>
    </form>
  );
}

export function SupplyPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const [filters, setFilters] = useState<SupplyFilterState>(() => getInitialFilters(user));
  const suppliesQuery = useQuery({
    queryKey: ["supplies", "history", filters],
    queryFn: () => serialsApi.listSupplies(toSupplyFilters(filters)),
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyRecord | null>(null);
  const [createForm, setCreateForm] = useState<SupplyFormState>(() => getInitialForm(user));
  const [editForm, setEditForm] = useState<SupplyFormState>(() => getInitialForm(user));
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<number[]>([]);
  const [importSummary, setImportSummary] = useState<BulkImportSummary | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const cavOptions = cavsQuery.data ?? [];
  const hasGlobalAccess = hasGlobalCavAccess(user?.role.name);
  const supplyManagementEnabled = canManageSupplies(user?.role.name);
  const cavLocked = !hasGlobalAccess;

  useEffect(() => {
    if (!user) {
      return;
    }

    if (cavLocked) {
      setCreateForm((current) => ({ ...current, cav_id: String(user.cav_id ?? "") }));
      setFilters((current) => ({ ...current, cav_id: String(user.cav_id ?? "") }));
    }
  }, [cavLocked, user]);

  useEffect(() => {
    if (!editingSupply) {
      return;
    }

    setEditForm(toEditForm(editingSupply));
  }, [editingSupply]);

  useEffect(() => {
    const availableIds = new Set((suppliesQuery.data ?? []).map((item) => item.id));
    setSelectedSupplyIds((current) => current.filter((id) => availableIds.has(id)));
  }, [suppliesQuery.data]);

  function syncCentroCostos(form: SupplyFormState, cavId: string): SupplyFormState {
    const selectedCav = cavOptions.find((cav) => String(cav.id) === cavId);

    return {
      ...form,
      cav_id: cavId,
      centro_costos_cav: selectedCav?.centro_costos ?? "",
    };
  }

  function openCreateModal() {
    setImportSummary(null);
    setImportErrorMessage(null);
    setCreateForm(syncCentroCostos(getInitialForm(user), cavLocked ? String(user?.cav_id ?? "") : ""));
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setCreateForm(getInitialForm(user));
  }

  function closeEditModal() {
    setEditingSupply(null);
    setEditForm(getInitialForm(user));
  }

  const createSupplyMutation = useMutation({
    mutationFn: serialsApi.createSupply,
    onSuccess: async () => {
      closeCreateModal();
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["supplies"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
    },
  });

  const updateSupplyMutation = useMutation({
    mutationFn: ({ supplyId, payload }: { supplyId: number; payload: SupplyPayload }) =>
      serialsApi.updateSupply(supplyId, payload),
    onSuccess: async () => {
      closeEditModal();
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["supplies"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
    },
  });

  const deleteSupplyMutation = useMutation({
    mutationFn: (supplyId: number) => serialsApi.deleteSupply(supplyId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["supplies"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
    },
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: (supplyIds: number[]) => serialsApi.deleteSupplies(supplyIds),
    onSuccess: async () => {
      setSelectedSupplyIds([]);
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["supplies"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
    },
  });

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createSupplyMutation.mutateAsync(toPayload(createForm));
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSupply) {
      return;
    }

    await updateSupplyMutation.mutateAsync({
      supplyId: editingSupply.id,
      payload: toPayload(editForm),
    });
  }

  const createErrorMessage = createSupplyMutation.isError
    ? getErrorMessage(createSupplyMutation.error, "No fue posible crear el abastecimiento.")
    : null;

  const updateErrorMessage = updateSupplyMutation.isError
    ? getErrorMessage(updateSupplyMutation.error, "No fue posible actualizar el abastecimiento.")
    : null;

  const supplies = suppliesQuery.data ?? [];
  const allVisibleSelected = supplies.length > 0 && supplies.every((item) => selectedSupplyIds.includes(item.id));
  const hasSelectedRows = selectedSupplyIds.length > 0;

  function toggleSupplySelection(supplyId: number) {
    setSelectedSupplyIds((current) =>
      current.includes(supplyId) ? current.filter((id) => id !== supplyId) : [...current, supplyId],
    );
  }

  function toggleAllVisibleRows() {
    setSelectedSupplyIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !supplies.some((item) => item.id === id));
      }

      const next = new Set(current);
      supplies.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  }

  async function handleDeleteSupply(supplyId: number, serial: string) {
    if (!window.confirm(`Vas a eliminar el abastecimiento del serial ${serial}. Esta accion no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteSupplyMutation.mutateAsync(supplyId);
      setSelectedSupplyIds((current) => current.filter((id) => id !== supplyId));
    } catch {
      // React Query conserva el error; evitamos dejar la promesa sin manejar en UI.
    }
  }

  async function handleDeleteSelected() {
    if (!hasSelectedRows) {
      return;
    }

    if (
      !window.confirm(
        `Vas a eliminar ${selectedSupplyIds.length} abastecimiento(s) seleccionado(s). Esta accion no se puede deshacer.`,
      )
    ) {
      return;
    }

    try {
      await deleteSelectedMutation.mutateAsync(selectedSupplyIds);
    } catch {
      // React Query conserva el error; evitamos dejar la promesa sin manejar en UI.
    }
  }

  function handleTemplateDownload() {
    triggerExcelDownload("plantilla-abastecimientos.xlsx", [
      {
        name: "Abastecimientos",
        rows: [importTemplateHeaders],
      },
      {
        name: "CAVs",
        rows: [
          ["nombre_cav", "centro_costos"],
          ...cavOptions.map((cav) => [cav.nombre_cav, cav.centro_costos]),
        ],
      },
    ]);
  }

  function handleExportSupplies() {
    triggerExcelDownload("abastecimientos-export.xlsx", [
      {
        name: "Abastecimientos",
        rows: [
          importTemplateHeaders,
          ...supplies.map((item) => [
            item.serial,
            item.descripcion_producto,
            fromSupplyIso(item.fecha_envio),
            item.cav?.nombre_cav ?? "",
          ]),
        ],
      },
    ]);
  }

  function openImportDialog() {
    setImportSummary(null);
    setImportErrorMessage(null);
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const [selectedFile] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    setImportErrorMessage(null);
    setImportSummary(null);
    setIsImporting(true);

    try {
      const workbook = XLSX.read(await selectedFile.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("El archivo de Excel no contiene hojas.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const { headers, rows } = parseExcelRows(rawRows);
      const cavNameIndex = headers.indexOf("nombre_cav");
      const descriptionIndex = headers.indexOf("descripcion_producto");
      const dateIndex = headers.indexOf("fecha_envio");
      const serialIndex = headers.indexOf("serial");
      const errorLines: string[] = [];
      let successCount = 0;
      const cavByName = new Map(cavOptions.map((cav) => [normalizeCavName(cav.nombre_cav), cav]));

      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 2;
        const serial = String(row[serialIndex] ?? "").trim();
        const descripcionProducto = String(row[descriptionIndex] ?? "").trim();
        const fechaEnvio = String(row[dateIndex] ?? "").trim();
        const cavName = String(row[cavNameIndex] ?? "").trim();

        if (![serial, descripcionProducto, fechaEnvio, cavName].some(Boolean)) {
          continue;
        }

        try {
          if (!serial || !descripcionProducto || !fechaEnvio || !cavName) {
            throw new Error("Debes completar serial, descripcion_producto, fecha_envio y nombre_cav.");
          }

          const selectedCav = cavByName.get(normalizeCavName(cavName));
          if (!selectedCav) {
            throw new Error(`El nombre del CAV "${cavName}" no existe en la tabla de CAVs.`);
          }

          await serialsApi.createSupply({
            serial,
            descripcion_producto: descripcionProducto,
            cav_id: selectedCav.id,
            centro_costos_cav: selectedCav.centro_costos,
            fecha_envio: normalizeImportDate(fechaEnvio),
          });
          successCount += 1;
        } catch (error) {
          errorLines.push(`Fila ${lineNumber}: ${getErrorMessage(error, "No fue posible importar el registro.")}`);
        }
      }

      setImportSummary({
        errorLines,
        failureCount: errorLines.length,
        fileName: selectedFile.name,
        successCount,
      });

      if (successCount > 0) {
        queryClient.removeQueries({ queryKey: ["dashboard"] });
        await queryClient.invalidateQueries({ queryKey: ["supplies"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["serials"], refetchType: "all" });
      }
    } catch (error) {
      setImportErrorMessage(getErrorMessage(error, "No fue posible procesar el archivo de Excel."));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Abastecimiento"
        description="Gestiona abastecimientos con una tabla operativa que conserva el historial aunque los seriales ya hayan sido recibidos o legalizados."
      />

      <Panel
        title="Historial de abastecimientos"
        subtitle="Consulta todos los abastecimientos registrados y sigue su estado aunque el serial ya haya avanzado en el flujo."
      >
        <div className="space-y-4">
          <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha inicial</span>
              <input
                className={inputClassName}
                type="date"
                value={filters.start_date}
                onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha final</span>
              <input
                className={inputClassName}
                type="date"
                value={filters.end_date}
                onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">CAV</span>
              <select
                className={inputClassName}
                value={filters.cav_id}
                onChange={(event) => setFilters((current) => ({ ...current, cav_id: event.target.value }))}
                disabled={cavLocked}
              >
                <option value="">Todos los CAV</option>
                {cavOptions.map((cav) => (
                  <option key={cav.id} value={cav.id}>
                    {cav.nombre_cav}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Producto</span>
              <input
                className={inputClassName}
                placeholder="Buscar producto"
                value={filters.producto}
                onChange={(event) => setFilters((current) => ({ ...current, producto: event.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Serial</span>
              <input
                className={inputClassName}
                placeholder="Buscar serial"
                value={filters.serial}
                onChange={(event) => setFilters((current) => ({ ...current, serial: event.target.value }))}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Tabla de abastecimientos</h4>
              <p className="mt-1 text-sm text-slate-600">Cada fila muestra serial, producto, fecha, CAV y centro de costo.</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {selectedSupplyIds.length} seleccionados de {supplies.length} visibles
              </p>
            </div>
            {supplyManagementEnabled ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={openImportDialog}
                  disabled={isImporting}
                >
                  <Upload size={16} />
                  {isImporting ? "Importando..." : "Import Masivo"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={handleExportSupplies}
                  disabled={supplies.length === 0}
                >
                  <Download size={16} />
                  Export Masivo
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={handleTemplateDownload}
                >
                  <FileSpreadsheet size={16} />
                  Plantilla para Import
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleDeleteSelected}
                  disabled={!hasSelectedRows || deleteSelectedMutation.isPending}
                >
                  <Trash2 size={16} />
                  {deleteSelectedMutation.isPending
                    ? "Eliminando..."
                    : `Eliminar Seleccionados${hasSelectedRows ? ` (${selectedSupplyIds.length})` : ""}`}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                  onClick={openCreateModal}
                >
                  <Plus size={16} />
                  Nuevo
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={handleExportSupplies}
                  disabled={supplies.length === 0}
                >
                  <Download size={16} />
                  Export Masivo
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={handleTemplateDownload}
                >
                  <FileSpreadsheet size={16} />
                  Plantilla para Import
                </button>
              </div>
            )}
          </div>

          {importErrorMessage ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{importErrorMessage}</p>
          ) : null}

          {importSummary ? (
            <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Resultado de importacion: {importSummary.fileName}</p>
              <p className="mt-1 text-sm text-slate-600">
                {importSummary.successCount} exitosos y {importSummary.failureCount} con error.
              </p>
              {importSummary.errorLines.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 text-sm text-rose-700">
                  {importSummary.errorLines.slice(0, 6).map((errorLine) => (
                    <p key={errorLine}>{errorLine}</p>
                  ))}
                  {importSummary.errorLines.length > 6 ? (
                    <p className="text-slate-500">Y {importSummary.errorLines.length - 6} error(es) mas.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    {supplyManagementEnabled ? (
                      <th className="px-4 py-3 font-semibold">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisibleRows}
                          aria-label="Seleccionar todos los abastecimientos visibles"
                        />
                      </th>
                    ) : null}
                    <th className="px-4 py-3 font-semibold">Serial</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">CAV</th>
                    <th className="px-4 py-3 font-semibold">Centro de costo</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    {supplyManagementEnabled ? <th className="px-4 py-3 font-semibold text-right">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliesQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={supplyManagementEnabled ? 8 : 6}>
                        Cargando abastecimientos...
                      </td>
                    </tr>
                  ) : suppliesQuery.data && suppliesQuery.data.length > 0 ? (
                    suppliesQuery.data.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/70">
                        {supplyManagementEnabled ? (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                              checked={selectedSupplyIds.includes(item.id)}
                              onChange={() => toggleSupplySelection(item.id)}
                              aria-label={`Seleccionar abastecimiento ${item.serial}`}
                            />
                          </td>
                        ) : null}
                        <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                        <td className="px-4 py-4">{item.descripcion_producto}</td>
                        <td className="px-4 py-4">{formatSupplyDate(item.fecha_envio)}</td>
                        <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                        <td className="px-4 py-4">{item.centro_costos_cav}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                            {item.current_status}
                          </span>
                        </td>
                        {supplyManagementEnabled ? (
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                                onClick={() => setEditingSupply(item)}
                              >
                                <Pencil size={14} />
                                Editar
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => handleDeleteSupply(item.id, item.serial)}
                                disabled={deleteSupplyMutation.isPending}
                              >
                                <Trash2 size={14} />
                                Eliminar
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={supplyManagementEnabled ? 8 : 6}>
                        No hay abastecimientos que coincidan con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>

      <SupplyModal
        isOpen={isCreateModalOpen}
        title="Nuevo abastecimiento"
        subtitle="Crea un nuevo registro desde un modal dedicado y deja el serial listo para seguimiento."
        onClose={closeCreateModal}
      >
        <SupplyForm
          actionLabel="Crear abastecimiento"
          cavDisabled={cavLocked}
          cavs={cavOptions}
          errorMessage={createErrorMessage}
          form={createForm}
          isPending={createSupplyMutation.isPending}
          onCavChange={(value) => setCreateForm((current) => syncCentroCostos(current, value))}
          onClose={closeCreateModal}
          onFieldChange={(field, value) => setCreateForm((current) => ({ ...current, [field]: value }))}
          onSubmit={handleCreateSubmit}
        />
      </SupplyModal>

      <SupplyModal
        isOpen={editingSupply !== null}
        title="Editar abastecimiento"
        subtitle="Ajusta los datos del registro sin salir de la tabla operativa."
        onClose={closeEditModal}
      >
        <SupplyForm
          actionLabel="Guardar cambios"
          cavDisabled={cavLocked}
          cavs={cavOptions}
          errorMessage={updateErrorMessage}
          form={editForm}
          isPending={updateSupplyMutation.isPending}
          onCavChange={(value) => setEditForm((current) => syncCentroCostos(current, value))}
          onClose={closeEditModal}
          onFieldChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))}
          onSubmit={handleEditSubmit}
        />
      </SupplyModal>
    </div>
  );
}
