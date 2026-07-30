import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Paperclip, Trash2, X } from "lucide-react";
import { FormEvent, PropsWithChildren, useState } from "react";
import { createPortal } from "react-dom";

import { cavsApi } from "../api/cavs.api";
import { novedadesApi } from "../api/novedades.api";
import { PageTitle } from "../components/PageTitle";
import { PaginationFooter, paginateRows } from "../components/PaginationFooter";
import { SearchableSelect, type SearchableSelectOption } from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";
import type {
  AprobarNovedadPayload,
  Novedad,
  NovedadCerrada,
  NovedadResolucion,
  NovedadSoporte,
} from "../types";
import {
  normalizeProductoOption,
  productoOptions,
  productoOptionsByNormalized,
} from "../utils/productos";

/** En Solucion de novedades el serial ya fue recibido en el CAV, asi que el estado
 *  de entrega es siempre este y no se deja editar. */
const ESTADO_ENTREGA_FIJO = "Entregado por Transportadora";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
        description="Gestiona los seriales recibidos sin abastecimiento: Trade solicita el ingreso a abastecimiento o la solucion del serial, y OPS aprueba o rechaza como filtro final."
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const novedadesQuery = useQuery({
    queryKey: ["novedades", cavFilter, regionalFilter],
    queryFn: () =>
      novedadesApi.list(cavFilter ? Number(cavFilter) : undefined, regionalFilter || undefined),
  });
  const cerradasQuery = useQuery({
    queryKey: ["novedades-cerradas", cavFilter, regionalFilter],
    queryFn: () =>
      novedadesApi.listCerradas(
        cavFilter ? Number(cavFilter) : undefined,
        regionalFilter || undefined,
      ),
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
  const cerradas = cerradasQuery.data ?? [];
  const novedadesPagination = paginateRows(novedades, page, pageSize);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["novedades"] });
    queryClient.invalidateQueries({ queryKey: ["novedades-cerradas"] });
    queryClient.invalidateQueries({ queryKey: ["novedades-aprobaciones"] });
  }

  return (
    <div className="space-y-6">
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
              onChange={(value) => {
                setRegionalFilter(value);
                setPage(1);
              }}
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
              onChange={(value) => {
                setCavFilter(value);
                setPage(1);
              }}
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
              <th className="px-4 py-3 font-semibold">Recepcion</th>
              <th className="px-4 py-3 font-semibold">Ultimo movimiento</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {novedadesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  Cargando novedades...
                </td>
              </tr>
            ) : novedadesPagination.pageRows.length > 0 ? (
              novedadesPagination.pageRows.map((item) => {
                const enAprobacion = item.estado_resolucion === "en_aprobacion";
                const devuelta = item.estado_resolucion === "devuelta";
                const esSolucion = item.tipo_resolucion === "baja";
                return (
                  <tr key={item.serial_id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {item.serial}
                      {devuelta && item.observacion_ops ? (
                        <p className="mt-1 text-xs font-normal text-rose-600">
                          OPS rechazo la {esSolucion ? "solucion" : "solicitud de ingreso"}:{" "}
                          {item.observacion_ops}
                          {item.devuelta_por ? (
                            <span className="text-slate-500">
                              {" "}
                              ({item.devuelta_por}, {formatDateTime(item.devuelta_at)})
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.recibido_por ? (
                        <>
                          {item.recibido_por}
                          <span className="block text-xs text-slate-400">
                            {formatDate(item.fecha_recepcion)}
                          </span>
                        </>
                      ) : (
                        "Sin recepcion"
                      )}
                    </td>
                    <td className="px-4 py-4">{formatDate(item.last_movement_at)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          enAprobacion
                            ? "bg-amber-50 text-amber-700"
                            : devuelta
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {enAprobacion
                          ? esSolucion
                            ? "Solucion en aprobacion OPS"
                            : "Ingreso en aprobacion OPS"
                          : devuelta
                            ? "Devuelta a Trade"
                            : "Nueva"}
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
                          Solucionar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No hay novedades con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        itemLabel="novedades"
        page={novedadesPagination.safePage}
        pageSize={pageSize}
        totalItems={novedades.length}
        totalPages={novedadesPagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      </section>

      <CerradasTable cerradas={cerradas} isLoading={cerradasQuery.isLoading} />

      {bajaTarget ? (
        <SolucionarModal
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
    </div>
  );
}

function SoporteLink({ soporte }: { soporte?: NovedadSoporte | null }) {
  const mutation = useMutation({ mutationFn: () => novedadesApi.abrirSoporte(soporte!.id) });
  if (!soporte) return <span className="text-slate-400">Sin soporte</span>;
  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      title={soporte.nombre_archivo}
    >
      <Paperclip size={13} />
      {mutation.isPending ? "Abriendo..." : "Ver soporte"}
    </button>
  );
}

function CerradasTable({
  cerradas,
  isLoading,
}: {
  cerradas: NovedadCerrada[];
  isLoading: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pagination = paginateRows(cerradas, page, pageSize);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Novedades cerradas</h3>
        <p className="mt-1 text-sm text-slate-600">
          Novedades con visto bueno final de OPS, por las dos ramas: las que ingresaron a
          abastecimiento y los seriales rechazados (dados de baja).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] divide-y divide-slate-100">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Serial</th>
              <th className="px-4 py-3 font-semibold">CAV</th>
              <th className="px-4 py-3 font-semibold">Resultado</th>
              <th className="px-4 py-3 font-semibold">Motivo / Observacion</th>
              <th className="px-4 py-3 font-semibold">Solicitado por</th>
              <th className="px-4 py-3 font-semibold">Aprobado por (OPS)</th>
              <th className="px-4 py-3 font-semibold">Soporte</th>
              <th className="px-4 py-3 font-semibold">Fecha y hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                  Cargando novedades cerradas...
                </td>
              </tr>
            ) : pagination.pageRows.length > 0 ? (
              pagination.pageRows.map((item) => {
                const esBaja = item.resultado === "baja";
                return (
                  <tr key={item.key} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                    <td className="px-4 py-4">{item.cav_nombre ?? "Sin CAV"}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          esBaja ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {esBaja ? "Rechazado (baja)" : "Ingreso a abastecimiento"}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-[320px] text-slate-600">
                      {item.observacion_trade}
                      {item.observacion_ops ? (
                        <p className="mt-1 text-xs text-slate-500">Nota OPS: {item.observacion_ops}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">{item.solicitado_por ?? "-"}</td>
                    <td className="px-4 py-4">{item.aprobado_por ?? "-"}</td>
                    <td className="px-4 py-4">
                      <SoporteLink soporte={item.soporte} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.cerrada_at)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                  No hay novedades cerradas con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        itemLabel="novedades cerradas"
        page={pagination.safePage}
        pageSize={pageSize}
        totalItems={cerradas.length}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </section>
  );
}

function SolucionarModal({
  novedad,
  onClose,
  onDone,
}: {
  novedad: Novedad;
  onClose: () => void;
  onDone: () => void;
}) {
  const [observacion, setObservacion] = useState("");
  const [soporte, setSoporte] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!soporte) throw new Error("Adjunta el soporte de la solucion.");
      // El archivo se sube primero y la solicitud viaja con el id del soporte.
      const subido = await novedadesApi.subirSoporte(soporte);
      return novedadesApi.solicitarBaja(novedad.serial_id, observacion.trim(), subido.id);
    },
    onSuccess: onDone,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Solucionar la novedad" subtitle={`Serial ${novedad.serial}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            La solicitud pasa a aprobacion de OPS. Si OPS la aprueba, el serial y todo su historial se
            eliminan de la base de datos y no se puede deshacer.
          </span>
        </div>
        <Field label="Observacion (obligatoria)">
          <textarea
            className={`${inputClassName} min-h-[96px]`}
            placeholder="Justifica la solucion de esta novedad"
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            minLength={3}
            required
          />
        </Field>
        <Field label="Soporte (obligatorio)">
          <input
            type="file"
            className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700`}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) => setSoporte(event.target.files?.[0] ?? null)}
            required
          />
          <span className="mt-1 block text-xs text-slate-500">
            PDF o imagen (JPG, PNG, WEBP), maximo 5 MB. OPS lo revisa antes de aprobar.
          </span>
        </Field>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible enviar la solicitud a OPS.")}
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
            disabled={mutation.isPending || observacion.trim().length < 3 || !soporte}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Enviando..." : "Enviar a OPS"}
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
  // La descripcion solo puede ser uno de los productos del catalogo; si la novedad
  // trae un placeholder o un texto libre viejo, se obliga a elegir de nuevo.
  const initialDescripcion = novedad.descripcion_producto
    ? productoOptionsByNormalized.get(normalizeProductoOption(novedad.descripcion_producto)) ?? ""
    : "";

  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const cavs = cavsQuery.data ?? [];

  const [form, setForm] = useState({
    observacion: "",
    descripcion_producto: initialDescripcion as string,
    numero_guia: "",
    cav_id: novedad.cav?.id ? String(novedad.cav.id) : "",
    fecha_entrega_pdv: "",
    estado_entrega: ESTADO_ENTREGA_FIJO,
  });

  const cavOptions: SearchableSelectOption[] = cavs.map((cav) => ({
    value: String(cav.id),
    label: cav.nombre_cav,
  }));
  const selectedCav = cavs.find((cav) => String(cav.id) === form.cav_id);
  const centroCostos = selectedCav?.centro_costos ?? novedad.cav?.centro_costos ?? "";

  const [soporte, setSoporte] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const subido = soporte ? await novedadesApi.subirSoporte(soporte) : null;
      const payload: AprobarNovedadPayload = {
        observacion: form.observacion.trim(),
        descripcion_producto: form.descripcion_producto,
        numero_guia: form.numero_guia.trim(),
        cav_id: form.cav_id ? Number(form.cav_id) : null,
        soporte_id: subido?.id ?? null,
        centro_costos_cav: centroCostos || null,
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
              <select
                className={inputClassName}
                value={form.descripcion_producto}
                onChange={(event) => update("descripcion_producto", event.target.value)}
                required
              >
                <option value="">Selecciona producto</option>
                {productoOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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
          <Field label="CAV de origen">
            <SearchableSelect
              options={cavOptions}
              value={form.cav_id}
              onChange={(value) => update("cav_id", value)}
              className={inputClassName}
              placeholder={cavsQuery.isLoading ? "Cargando CAVs..." : "Selecciona CAV"}
              searchPlaceholder="Buscar CAV..."
              ariaLabel="CAV de origen de la novedad"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Centro de costos (segun el CAV)">
              <input
                className={`${inputClassName} bg-slate-50`}
                placeholder="Se completa segun el CAV"
                value={centroCostos}
                readOnly
              />
            </Field>
          </div>
          <Field label="Fecha de creacion de la novedad">
            <input
              className={`${inputClassName} bg-slate-50 text-slate-500`}
              value={formatDateTime(novedad.creada_at)}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
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
              <input
                className={`${inputClassName} bg-slate-50 text-slate-500`}
                value={ESTADO_ENTREGA_FIJO}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Soporte (opcional)">
              <input
                type="file"
                className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700`}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setSoporte(event.target.files?.[0] ?? null)}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Adjunta evidencia si la tienes. PDF o imagen, maximo 5 MB.
              </span>
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
            disabled={mutation.isPending || !form.descripcion_producto || !form.cav_id}
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
  const [aprobarBajaTarget, setAprobarBajaTarget] = useState<NovedadResolucion | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const aprobacionesQuery = useQuery({
    queryKey: ["novedades-aprobaciones"],
    queryFn: novedadesApi.listAprobaciones,
  });

  function refreshOps() {
    queryClient.invalidateQueries({ queryKey: ["novedades-aprobaciones"] });
    queryClient.invalidateQueries({ queryKey: ["novedades"] });
    queryClient.invalidateQueries({ queryKey: ["novedades-bajas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const aprobarMutation = useMutation({
    mutationFn: (resolucionId: number) => novedadesApi.opsAprobar(resolucionId),
    onSuccess: refreshOps,
  });

  const aprobaciones = aprobacionesQuery.data ?? [];
  const pagination = paginateRows(aprobaciones, page, pageSize);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Pendientes de aprobacion (OPS)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Solicitudes de Trade que esperan tu confirmacion: ingresos a Abastecimiento y soluciones
          (baja del serial).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] divide-y divide-slate-100">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Serial</th>
              <th className="px-4 py-3 font-semibold">Solicitud</th>
              <th className="px-4 py-3 font-semibold">CAV</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Guia</th>
              <th className="px-4 py-3 font-semibold">Solicitado por</th>
              <th className="px-4 py-3 font-semibold">Observacion Trade</th>
              <th className="px-4 py-3 font-semibold">Soporte</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {aprobacionesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                  Cargando pendientes...
                </td>
              </tr>
            ) : pagination.pageRows.length > 0 ? (
              pagination.pageRows.map((item) => {
                const esBaja = item.tipo === "baja";
                return (
                  <tr key={item.id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          esBaja ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {esBaja ? "Solucion (baja)" : "Ingreso"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                    <td className="px-4 py-4">{item.descripcion_producto ?? "-"}</td>
                    <td className="px-4 py-4">{item.numero_guia ?? "-"}</td>
                    <td className="px-4 py-4">{item.creado_por ?? "-"}</td>
                    <td className="px-4 py-4 max-w-[240px] text-slate-600">{item.observacion_trade}</td>
                    <td className="px-4 py-4">
                      <SoporteLink soporte={item.soporte} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={aprobarMutation.isPending}
                          onClick={() =>
                            esBaja ? setAprobarBajaTarget(item) : aprobarMutation.mutate(item.id)
                          }
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} />
                          {esBaja ? "Aprobar solucion" : "Aprobar ingreso"}
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
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                  No hay novedades pendientes de aprobacion.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        itemLabel="solicitudes"
        page={pagination.safePage}
        pageSize={pageSize}
        totalItems={aprobaciones.length}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {aprobarMutation.error ? (
        <p className="px-5 py-3 text-sm text-rose-600">
          {getErrorMessage(aprobarMutation.error, "No fue posible aprobar la solicitud.")}
        </p>
      ) : null}

      {rechazarTarget ? (
        <RechazarModal
          resolucion={rechazarTarget}
          onClose={() => setRechazarTarget(null)}
          onDone={() => {
            setRechazarTarget(null);
            refreshOps();
          }}
        />
      ) : null}
      {aprobarBajaTarget ? (
        <AprobarBajaModal
          resolucion={aprobarBajaTarget}
          onClose={() => setAprobarBajaTarget(null)}
          onDone={() => {
            setAprobarBajaTarget(null);
            refreshOps();
          }}
        />
      ) : null}
    </section>
  );
}

function AprobarBajaModal({
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
    mutationFn: () => novedadesApi.opsAprobar(resolucion.id, observacion.trim() || undefined),
    onSuccess: onDone,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      title="Aprobar solucion (baja del serial)"
      subtitle={`Serial ${resolucion.serial}`}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            Al aprobar, el serial y todo su historial se eliminan de la base de datos y pasan a la
            tabla de seriales rechazados. No se puede deshacer.
          </span>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Motivo de Trade
          </p>
          <p className="mt-1">{resolucion.observacion_trade}</p>
          <p className="mt-2 text-xs text-slate-500">
            Solicitado por {resolucion.creado_por ?? "-"} - {resolucion.cav?.nombre_cav ?? "Sin CAV"}
          </p>
          <div className="mt-2">
            <SoporteLink soporte={resolucion.soporte} />
          </div>
        </div>
        <Field label="Observacion OPS (opcional)">
          <textarea
            className={`${inputClassName} min-h-[80px]`}
            placeholder="Nota interna sobre la aprobacion"
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            maxLength={2000}
          />
        </Field>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible aprobar la solucion.")}
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
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Aprobando..." : "Aprobar y dar de baja"}
          </button>
        </div>
      </form>
    </Modal>
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
    <Modal
      title={resolucion.tipo === "baja" ? "Rechazar solucion" : "Rechazar ingreso"}
      subtitle={`Serial ${resolucion.serial}`}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-slate-600">
          La novedad volvera a quedar disponible para que Trade la corrija o la vuelva a enviar.
        </p>
        <Field label="Motivo del rechazo (obligatorio)">
          <textarea
            className={`${inputClassName} min-h-[96px]`}
            placeholder="Explica por que se rechaza la solicitud"
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            minLength={3}
            required
          />
        </Field>
        {mutation.error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getErrorMessage(mutation.error, "No fue posible rechazar la solicitud.")}
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
