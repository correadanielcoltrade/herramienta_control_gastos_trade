import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";
import { FormEvent, PropsWithChildren, useState } from "react";
import { createPortal } from "react-dom";

import { cavsApi } from "../api/cavs.api";
import { novedadesApi } from "../api/novedades.api";
import { PageTitle } from "../components/PageTitle";
import { SearchableSelect, type SearchableSelectOption } from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";
import type { AprobarNovedadPayload, Novedad, NovedadResolucion } from "../types";

const ESTADO_ENTREGA_OPTIONS = ["Pendiente de Entrega", "Entregado por Transportadora"] as const;

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? fallback
  );
}

interface ModalProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

function Modal({ title, subtitle, onClose, children }: ModalProps) {
  const content = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-3 py-6 backdrop-blur-[3px]">
      <button type="button" className="absolute inset-0" aria-label="Cerrar" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}

function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function NovedadesPage() {
  const { user } = useAuth();
  const role = user?.role.name ?? "";
  const isTradeView = role === "SuperAdmin" || role === "Trade" || role === "Trade Manager";
  const isOpsView = role === "SuperAdmin" || role === "OPS";

  return (
    <div className="space-y-6">
      <PageTitle
        title="Solucion de novedades"
        description="Gestiona los seriales recibidos sin abastecimiento: dales de baja con justificacion o apruebalos para que OPS los ingrese a abastecimiento."
      />
      {isTradeView ? <TradeSection /> : null}
      {isOpsView ? <OpsSection /> : null}
    </div>
  );
}

function TradeSection() {
  const queryClient = useQueryClient();
  const [cavFilter, setCavFilter] = useState<string>("");
  const [regionalFilter, setRegionalFilter] = useState<string>("");
  const [bajaTarget, setBajaTarget] = useState<Novedad | null>(null);
  const [aprobarTarget, setAprobarTarget] = useState<Novedad | null>(null);

  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const novedadesQuery = useQuery({
    queryKey: ["novedades", cavFilter, regionalFilter],
    queryFn: () =>
      novedadesApi.list(cavFilter ? Number(cavFilter) : undefined, regionalFilter || undefined),
  });

  const regionalFilterOptions: SearchableSelectOption[] = [
    { value: "", label: "Todas las regionales" },
    ...Array.from(
      new Set((cavsQuery.data ?? []).map((cav) => cav.regional).filter((value): value is string => Boolean(value))),
    )
      .sort()
      .map((regional) => ({ value: regional, label: regional })),
  ];
  const cavFilterOptions: SearchableSelectOption[] = [
    { value: "", label: "Todos los CAVs" },
    ...(cavsQuery.data ?? []).map((cav) => ({ value: String(cav.id), label: cav.nombre_cav })),
  ];
  const novedades = novedadesQuery.data ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["novedades"] });
    queryClient.invalidateQueries({ queryKey: ["novedades-aprobaciones"] });
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Novedades por CAV</h3>
          <p className="mt-1 text-sm text-slate-600">Filtra por regional o CAV y resuelve cada novedad.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:items-center">
          <div className="sm:w-48">
            <SearchableSelect
              options={regionalFilterOptions}
              value={regionalFilter}
              onChange={setRegionalFilter}
              className={inputClassName}
              placeholder="Todas las regionales"
              searchPlaceholder="Buscar regional..."
              ariaLabel="Filtrar por regional"
            />
          </div>
          <div className="sm:w-56">
            <SearchableSelect
              options={cavFilterOptions}
              value={cavFilter}
              onChange={setCavFilter}
              className={inputClassName}
              placeholder="Todos los CAVs"
              searchPlaceholder="Buscar CAV..."
              ariaLabel="Filtrar por CAV"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] divide-y divide-slate-100">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Serial</th>
              <th className="px-4 py-3 font-semibold">CAV</th>
              <th className="px-4 py-3 font-semibold">Ultimo movimiento</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {novedadesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  Cargando novedades...
                </td>
              </tr>
            ) : novedades.length > 0 ? (
              novedades.map((item) => {
                const enAprobacion = item.estado_resolucion === "en_aprobacion";
                return (
                  <tr key={item.serial_id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {item.serial}
                      {item.observacion_ops ? (
                        <p className="mt-1 text-xs font-normal text-rose-600">
                          Rechazada por OPS: {item.observacion_ops}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                    <td className="px-4 py-4">{formatDate(item.last_movement_at)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          enAprobacion ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {enAprobacion ? "En aprobacion OPS" : "Nueva"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={enAprobacion}
                          onClick={() => setAprobarTarget(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircle2 size={15} />
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={enAprobacion}
                          onClick={() => setBajaTarget(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                          Dar de baja
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  No hay novedades con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {bajaTarget ? (
        <DarDeBajaModal
          novedad={bajaTarget}
          onClose={() => setBajaTarget(null)}
          onDone={() => {
            setBajaTarget(null);
            refresh();
          }}
        />
      ) : null}
      {aprobarTarget ? (
        <AprobarModal
          novedad={aprobarTarget}
          onClose={() => setAprobarTarget(null)}
          onDone={() => {
            setAprobarTarget(null);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function DarDeBajaModal({
  novedad,
  onClose,
  onDone,
}: {
  novedad: Novedad;
  onClose: () => void;
  onDone: () => void;
}) {
  const [observacion, setObservacion] = useState("");
  const mutation = useMutation({
    mutationFn: () => novedadesApi.darDeBaja(novedad.serial_id, observacion.trim()),
    onSuccess: onDone,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Dar de baja la novedad" subtitle={`Serial ${novedad.serial}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>Esta accion elimina el serial y todo su historial de la base de datos. No se puede deshacer.</span>
        </div>
        <Field label="Observacion (obligatoria)">
          <textarea
            className={`${inputClassName} min-h-[96px]`}
            placeholder="Justifica por que se da de baja esta novedad"
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            minLength={3}
            required
          />
        </Field>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible dar de baja la novedad.")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || observacion.trim().length < 3}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Eliminando..." : "Dar de baja"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AprobarModal({
  novedad,
  onClose,
  onDone,
}: {
  novedad: Novedad;
  onClose: () => void;
  onDone: () => void;
}) {
  const placeholderDescripciones = ["Novedad", "Pendiente de conciliacion"];
  const initialDescripcion =
    novedad.descripcion_producto && !placeholderDescripciones.includes(novedad.descripcion_producto)
      ? novedad.descripcion_producto
      : "";

  const [form, setForm] = useState({
    observacion: "",
    descripcion_producto: initialDescripcion,
    numero_guia: "",
    centro_costos_cav: novedad.cav?.centro_costos ?? "",
    fecha_envio: todayISO(),
    fecha_entrega_pdv: "",
    estado_entrega: "Pendiente de Entrega",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: AprobarNovedadPayload = {
        observacion: form.observacion.trim(),
        descripcion_producto: form.descripcion_producto.trim(),
        numero_guia: form.numero_guia.trim(),
        centro_costos_cav: form.centro_costos_cav.trim() || null,
        fecha_envio: `${form.fecha_envio}T00:00:00`,
        fecha_entrega_pdv: form.fecha_entrega_pdv ? `${form.fecha_entrega_pdv}T00:00:00` : null,
        estado_entrega: form.estado_entrega || null,
      };
      return novedadesApi.aprobar(novedad.serial_id, payload);
    },
    onSuccess: onDone,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal
      title="Aprobar e ingresar a abastecimiento"
      subtitle={`Serial ${novedad.serial} - ${novedad.cav?.nombre_cav ?? "Sin CAV"}`}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Al aprobar, se enviara a OPS para que confirme el ingreso a Abastecimiento.
        </div>
        <Field label="Observacion (obligatoria)">
          <textarea
            className={`${inputClassName} min-h-[80px]`}
            placeholder="Justifica la aprobacion de esta novedad"
            value={form.observacion}
            onChange={(event) => update("observacion", event.target.value)}
            minLength={3}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Descripcion del producto">
              <input
                className={inputClassName}
                placeholder="Descripcion del producto"
                value={form.descripcion_producto}
                onChange={(event) => update("descripcion_producto", event.target.value)}
                minLength={2}
                required
              />
            </Field>
          </div>
          <Field label="Numero de guia">
            <input
              className={inputClassName}
              placeholder="Numero de guia"
              value={form.numero_guia}
              onChange={(event) => update("numero_guia", event.target.value)}
              required
            />
          </Field>
          <Field label="Centro de costos">
            <input
              className={inputClassName}
              placeholder={novedad.cav?.centro_costos ?? "Centro de costos"}
              value={form.centro_costos_cav}
              onChange={(event) => update("centro_costos_cav", event.target.value)}
            />
          </Field>
          <Field label="Fecha de envio">
            <input
              type="date"
              className={inputClassName}
              value={form.fecha_envio}
              onChange={(event) => update("fecha_envio", event.target.value)}
              required
            />
          </Field>
          <Field label="Fecha entrega PDV (opcional)">
            <input
              type="date"
              className={inputClassName}
              value={form.fecha_entrega_pdv}
              onChange={(event) => update("fecha_entrega_pdv", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Estado de entrega">
              <select
                className={inputClassName}
                value={form.estado_entrega}
                onChange={(event) => update("estado_entrega", event.target.value)}
              >
                {ESTADO_ENTREGA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible aprobar la novedad.")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Enviando..." : "Aprobar y enviar a OPS"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OpsSection() {
  const queryClient = useQueryClient();
  const [rechazarTarget, setRechazarTarget] = useState<NovedadResolucion | null>(null);

  const aprobacionesQuery = useQuery({
    queryKey: ["novedades-aprobaciones"],
    queryFn: novedadesApi.listAprobaciones,
  });

  const aprobarMutation = useMutation({
    mutationFn: (resolucionId: number) => novedadesApi.opsAprobar(resolucionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novedades-aprobaciones"] });
      queryClient.invalidateQueries({ queryKey: ["novedades"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const aprobaciones = aprobacionesQuery.data ?? [];

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Pendientes de aprobacion (OPS)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Novedades aprobadas por Trade que esperan tu confirmacion para ingresar a Abastecimiento.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] divide-y divide-slate-100">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Serial</th>
              <th className="px-4 py-3 font-semibold">CAV</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Guia</th>
              <th className="px-4 py-3 font-semibold">Aprobado por</th>
              <th className="px-4 py-3 font-semibold">Observacion Trade</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {aprobacionesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                  Cargando pendientes...
                </td>
              </tr>
            ) : aprobaciones.length > 0 ? (
              aprobaciones.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                  <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                  <td className="px-4 py-4">{item.descripcion_producto}</td>
                  <td className="px-4 py-4">{item.numero_guia}</td>
                  <td className="px-4 py-4">{item.creado_por ?? "-"}</td>
                  <td className="px-4 py-4 max-w-[240px] text-slate-600">{item.observacion_trade}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={aprobarMutation.isPending}
                        onClick={() => aprobarMutation.mutate(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        Aprobar ingreso
                      </button>
                      <button
                        type="button"
                        onClick={() => setRechazarTarget(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        <X size={15} />
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                  No hay novedades pendientes de aprobacion.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aprobarMutation.error ? (
        <p className="px-5 py-3 text-sm text-rose-600">
          {getErrorMessage(aprobarMutation.error, "No fue posible aprobar el ingreso.")}
        </p>
      ) : null}

      {rechazarTarget ? (
        <RechazarModal
          resolucion={rechazarTarget}
          onClose={() => setRechazarTarget(null)}
          onDone={() => {
            setRechazarTarget(null);
            queryClient.invalidateQueries({ queryKey: ["novedades-aprobaciones"] });
            queryClient.invalidateQueries({ queryKey: ["novedades"] });
          }}
        />
      ) : null}
    </section>
  );
}

function RechazarModal({
  resolucion,
  onClose,
  onDone,
}: {
  resolucion: NovedadResolucion;
  onClose: () => void;
  onDone: () => void;
}) {
  const [observacion, setObservacion] = useState("");
  const mutation = useMutation({
    mutationFn: () => novedadesApi.opsRechazar(resolucion.id, observacion.trim()),
    onSuccess: onDone,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Rechazar ingreso" subtitle={`Serial ${resolucion.serial}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-slate-600">
          La novedad volvera a quedar disponible para que Trade la corrija o la de de baja.
        </p>
        <Field label="Motivo del rechazo (obligatorio)">
          <textarea
            className={`${inputClassName} min-h-[96px]`}
            placeholder="Explica por que se rechaza el ingreso"
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            minLength={3}
            required
          />
        </Field>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible rechazar el ingreso.")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || observacion.trim().length < 3}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Rechazando..." : "Rechazar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
