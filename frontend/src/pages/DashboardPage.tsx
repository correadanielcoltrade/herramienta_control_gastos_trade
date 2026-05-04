import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";

import { cavsApi } from "../api/cavs.api";
import { dashboardApi } from "../api/dashboard.api";
import { serialsApi } from "../api/serials.api";
import { usersApi } from "../api/users.api";
import { Panel } from "../components/Panel";
import { PageTitle } from "../components/PageTitle";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import type { DashboardFilters, DashboardPoint, SerialStatus, SupplyFilters } from "../types";
import { hasGlobalCavAccess } from "../utils/access";

const statusOptions: SerialStatus[] = [
  "enviado",
  "recibido",
  "disponible",
  "gastado",
  "legalizado",
  "duplicado",
  "pendiente",
];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

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

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    totalPages,
    safePage,
    pageRows: rows.slice(startIndex, startIndex + pageSize),
  };
}

function formatDashboardDate(dateValue?: string | null) {
  if (!dateValue) {
    return "Sin fecha registrada";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue));
}

function getPendingDays(dateValue?: string | null) {
  if (!dateValue) {
    return 0;
  }

  const supplyDate = new Date(dateValue);
  if (Number.isNaN(supplyDate.getTime())) {
    return 0;
  }

  const diffInMs = Date.now() - supplyDate.getTime();
  return Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
}

function matchesDateRange(dateValue: string | null | undefined, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const normalizedDate = dateValue.slice(0, 10);

  if (startDate && normalizedDate < startDate) {
    return false;
  }

  if (endDate && normalizedDate > endDate) {
    return false;
  }

  return true;
}

function parseDashboardDate(dateValue?: string | null) {
  if (!dateValue) {
    return null;
  }

  const isoLikeDate = /^\d{4}-\d{2}-\d{2}$/;
  const parsedDate = isoLikeDate.test(dateValue) ? new Date(`${dateValue}T12:00:00`) : new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function buildMonthlyLegalizations(points: DashboardPoint[] = []) {
  const monthlyTotals = new Map<string, { mes: string; legalizados: number }>();

  points.forEach((point) => {
    if (!point.fecha) {
      return;
    }

    const pointDate = parseDashboardDate(point.fecha);
    if (!pointDate) {
      return;
    }

    const monthKey = `${pointDate.getFullYear()}-${String(pointDate.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(pointDate);
    const current = monthlyTotals.get(monthKey);

    if (current) {
      current.legalizados += point.legalizados;
      return;
    }

    monthlyTotals.set(monthKey, {
      mes: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      legalizados: point.legalizados,
    });
  });

  return Array.from(monthlyTotals.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([, value]) => value);
}

interface PaginationFooterProps {
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

function PaginationFooter({
  itemLabel,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  totalItems,
  totalPages,
}: PaginationFooterProps) {
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
      <p>
        Mostrando {startItem}-{endItem} de {totalItems} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} por pagina
            </option>
          ))}
        </select>
        <span className="px-1 text-slate-400">
          Pagina {page} de {totalPages}
        </span>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const hasGlobalAccess = hasGlobalCavAccess(user?.role.name);
  const [filters, setFilters] = useState<DashboardFilters>({
    cav_id: hasGlobalAccess ? undefined : user?.cav_id ?? undefined,
  });
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState<number>(10);
  const [availablePage, setAvailablePage] = useState(1);
  const [availablePageSize, setAvailablePageSize] = useState<number>(10);
  const [legalizedPage, setLegalizedPage] = useState(1);
  const [legalizedPageSize, setLegalizedPageSize] = useState<number>(10);
  const liveRefreshOptions = {
    enabled: Boolean(user),
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: "always" as const,
    refetchOnReconnect: "always" as const,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!hasGlobalAccess) {
      setFilters((current) => ({
        ...current,
        cav_id: user.cav_id ?? undefined,
      }));
    }
  }, [hasGlobalAccess, user]);
  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const usersQuery = useQuery({
    queryKey: ["users", "dashboard"],
    queryFn: usersApi.list,
    enabled: user?.role.name === "SuperAdmin",
  });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => dashboardApi.getSummary(filters),
    ...liveRefreshOptions,
  });
  const pendingSupplyFilters: SupplyFilters = {
    cav_id: filters.cav_id,
    start_date: filters.start_date,
    end_date: filters.end_date,
    status: "enviado",
    user_id: filters.user_id,
  };
  const pendingSuppliesQuery = useQuery({
    queryKey: ["dashboard", "pending-supplies", pendingSupplyFilters],
    queryFn: () => serialsApi.listSupplies(pendingSupplyFilters),
    ...liveRefreshOptions,
  });
  const availableSerialsQuery = useQuery({
    queryKey: [
      "dashboard",
      "available-serials",
      filters.cav_id,
      filters.user_id,
      filters.start_date,
      filters.end_date,
    ],
    queryFn: () =>
      serialsApi.list({
        cav_id: filters.cav_id,
        user_id: filters.user_id,
        status: "disponible",
      }),
    ...liveRefreshOptions,
  });
  const legalizedSerialsQuery = useQuery({
    queryKey: ["dashboard", "legalized-serials", filters],
    queryFn: () => serialsApi.listLegalizations(filters),
    ...liveRefreshOptions,
  });

  const summary = dashboardQuery.data?.summary;
  const pendingSupplies = pendingSuppliesQuery.data ?? [];
  const monthlyLegalizations = buildMonthlyLegalizations(dashboardQuery.data?.series ?? []);
  const availableSerials = (availableSerialsQuery.data ?? []).filter((item) =>
    matchesDateRange(item.last_movement_at, filters.start_date, filters.end_date),
  );
  const legalizedSerials = legalizedSerialsQuery.data ?? [];
  const pendingPagination = paginateRows(pendingSupplies, pendingPage, pendingPageSize);
  const availablePagination = paginateRows(availableSerials, availablePage, availablePageSize);
  const legalizedPagination = paginateRows(legalizedSerials, legalizedPage, legalizedPageSize);

  useEffect(() => {
    setPendingPage(1);
    setAvailablePage(1);
    setLegalizedPage(1);
  }, [filters]);

  function handleExportPendingSupplies() {
    if (pendingSupplies.length === 0) {
      return;
    }

    triggerExcelDownload("seriales-pendientes-por-recibir.xlsx", [
      {
        name: "Pendientes",
        rows: [
          ["serial", "descripcion_producto", "fecha_abastecimiento", "dias_pendiente", "cav", "centro_costos"],
          ...pendingSupplies.map((item) => [
            item.serial,
            item.descripcion_producto,
            formatDashboardDate(item.fecha_envio),
            getPendingDays(item.fecha_envio),
            item.cav?.nombre_cav ?? "",
            item.centro_costos_cav,
          ]),
        ],
      },
    ]);
  }

  function handleExportLegalizedSerials() {
    if (legalizedSerials.length === 0) {
      return;
    }

    triggerExcelDownload("seriales-legalizados-dashboard.xlsx", [
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
          ...legalizedSerials.map((item) => [
            formatDashboardDate(item.fecha),
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

  function handleExportAvailableSerials() {
    if (availableSerials.length === 0) {
      return;
    }

    triggerExcelDownload("seriales-disponibles-por-legalizar.xlsx", [
      {
        name: "Disponibles",
        rows: [
          ["serial", "descripcion_producto", "disponible_desde", "dias_disponible", "cav", "estado"],
          ...availableSerials.map((item) => [
            item.serial,
            item.descripcion_producto ?? "",
            formatDashboardDate(item.last_movement_at),
            getPendingDays(item.last_movement_at),
            item.cav?.nombre_cav ?? "",
            item.current_status,
          ]),
        ],
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard operativo"
        description="Vista consolidada del inventario, recepciones y legalizaciones con alcance por rol y CAV."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Total seriales" value={summary?.total_seriales ?? 0} />
        <StatCard label="CAV visibles" value={cavsQuery.data?.length ?? 0} tone="slate" />
        <StatCard label="Enviados" value={summary?.enviados ?? 0} tone="slate" />
        <StatCard label="Disponibles" value={summary?.disponibles ?? 0} tone="accent" />
        <StatCard label="Legalizados" value={summary?.legalizados ?? 0} tone="slate" />
        <StatCard label="Duplicados" value={summary?.duplicados ?? 0} tone="brand" />
        <StatCard label="Pendientes" value={summary?.pendientes ?? 0} tone="brand" />
      </div>

      <Panel title="Filtros de control" subtitle="Puedes acotar los dashboards por CAV, fecha, estado y usuario.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={filters.cav_id ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                cav_id: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={!hasGlobalAccess}
          >
            <option value="">Todos los CAVs</option>
            {cavsQuery.data?.map((cav) => (
              <option key={cav.id} value={cav.id}>
                {cav.nombre_cav}
              </option>
            ))}
          </select>
          <select
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value ? (event.target.value as SerialStatus) : undefined,
              }))
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">Todos los estados</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={filters.user_id ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                user_id: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={user?.role.name !== "SuperAdmin"}
          >
            <option value="">{user?.role.name === "SuperAdmin" ? "Todos los usuarios" : "Usuario actual"}</option>
            {usersQuery.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre_usuario}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.start_date ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                start_date: event.target.value || undefined,
              }))
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            type="date"
            value={filters.end_date ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                end_date: event.target.value || undefined,
              }))
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
        </div>
      </Panel>

      <Panel title="Abastecimiento vs recibo" subtitle="Comparativo diario para detectar brechas de llegada.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboardQuery.data?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d7e2de" />
              <XAxis dataKey="fecha" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="abastecimientos" fill="#7c3aed" radius={[10, 10, 0, 0]} />
              <Bar dataKey="recepciones" fill="#e91e8c" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Abastecidos pendientes por recibir"
        subtitle="Seriales enviados que aun no tienen recibo confirmado. Esta tabla respeta CAV, rango de fechas y usuario; el estado se fija en enviados."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">Pendientes de recibo</p>
              <p className="mt-1 text-sm text-slate-600">
                {pendingSupplies.length} serial{pendingSupplies.length === 1 ? "" : "es"} abastecido
                {pendingSupplies.length === 1 ? "" : "s"} sin confirmar en recibo.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPendingSupplies}
              disabled={pendingSuppliesQuery.isLoading || pendingSupplies.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Exportar pendientes
            </button>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Serial</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Fecha abastecimiento</th>
                    <th className="px-4 py-3 font-semibold">Dias pendiente</th>
                    <th className="px-4 py-3 font-semibold">CAV</th>
                    <th className="px-4 py-3 font-semibold">Centro de costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingSuppliesQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        Cargando seriales pendientes...
                      </td>
                    </tr>
                  ) : pendingPagination.pageRows.length > 0 ? (
                    pendingPagination.pageRows.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                        <td className="px-4 py-4">{item.descripcion_producto}</td>
                        <td className="px-4 py-4">{formatDashboardDate(item.fecha_envio)}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                            {getPendingDays(item.fecha_envio)} dias
                          </span>
                        </td>
                        <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                        <td className="px-4 py-4">{item.centro_costos_cav}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        No hay seriales abastecidos pendientes por recibir con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationFooter
              itemLabel="seriales"
              onPageChange={setPendingPage}
              onPageSizeChange={(size) => {
                setPendingPageSize(size);
                setPendingPage(1);
              }}
              page={pendingPagination.safePage}
              pageSize={pendingPageSize}
              totalItems={pendingSupplies.length}
              totalPages={pendingPagination.totalPages}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Legalizados por mes"
        subtitle="Suma mensual de seriales legalizados a partir de la serie diaria del dashboard."
      >
        {dashboardQuery.isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
            Cargando legalizaciones mensuales...
          </div>
        ) : monthlyLegalizations.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyLegalizations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e2de" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="legalizados" fill="#6d28d9" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
            No hay legalizaciones para mostrar con los filtros actuales.
          </div>
        )}
      </Panel>

      <Panel
        title="Disponibles por legalizar"
        subtitle="Seriales en estado disponible que aun no han sido legalizados. Esta tabla respeta CAV y usuario; el rango de fechas se aplica sobre la fecha del ultimo movimiento."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">Seriales listos para legalizacion</p>
              <p className="mt-1 text-sm text-slate-600">
                {availableSerials.length} serial{availableSerials.length === 1 ? "" : "es"} disponible
                {availableSerials.length === 1 ? "" : "s"} pendiente{availableSerials.length === 1 ? "" : "s"} por
                legalizar.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAvailableSerials}
              disabled={availableSerialsQuery.isLoading || availableSerials.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Exportar disponibles
            </button>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Serial</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Disponible desde</th>
                    <th className="px-4 py-3 font-semibold">Dias disponible</th>
                    <th className="px-4 py-3 font-semibold">CAV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availableSerialsQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                        Cargando seriales disponibles...
                      </td>
                    </tr>
                  ) : availablePagination.pageRows.length > 0 ? (
                    availablePagination.pageRows.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                        <td className="px-4 py-4">{item.descripcion_producto ?? "Sin descripcion"}</td>
                        <td className="px-4 py-4">{formatDashboardDate(item.last_movement_at)}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            {getPendingDays(item.last_movement_at)} dias
                          </span>
                        </td>
                        <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                        No hay seriales disponibles por legalizar con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationFooter
              itemLabel="seriales"
              onPageChange={setAvailablePage}
              onPageSizeChange={(size) => {
                setAvailablePageSize(size);
                setAvailablePage(1);
              }}
              page={availablePagination.safePage}
              pageSize={availablePageSize}
              totalItems={availableSerials.length}
              totalPages={availablePagination.totalPages}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Seriales legalizados"
        subtitle="Detalle de seriales legalizados segun los filtros activos del dashboard."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">Historial de legalizaciones</p>
              <p className="mt-1 text-sm text-slate-600">
                {legalizedSerials.length} serial{legalizedSerials.length === 1 ? "" : "es"} legalizado
                {legalizedSerials.length === 1 ? "" : "s"} con los filtros actuales.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLegalizedSerials}
              disabled={legalizedSerialsQuery.isLoading || legalizedSerials.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {legalizedSerialsQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                        Cargando seriales legalizados...
                      </td>
                    </tr>
                  ) : legalizedPagination.pageRows.length > 0 ? (
                    legalizedPagination.pageRows.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4">{formatDashboardDate(item.fecha)}</td>
                        <td className="px-4 py-4 font-medium text-slate-900">{item.serial}</td>
                        <td className="px-4 py-4">{item.tipo_inventario}</td>
                        <td className="px-4 py-4">{item.tipo_uso}</td>
                        <td className="px-4 py-4">{item.cliente_asesor}</td>
                        <td className="px-4 py-4">{item.documento_cliente ?? "N/A"}</td>
                        <td className="px-4 py-4">{item.asesor_responsable}</td>
                        <td className="px-4 py-4">{item.registrado_por}</td>
                        <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Sin CAV"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                        No hay seriales legalizados con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationFooter
              itemLabel="seriales"
              onPageChange={setLegalizedPage}
              onPageSizeChange={(size) => {
                setLegalizedPageSize(size);
                setLegalizedPage(1);
              }}
              page={legalizedPagination.safePage}
              pageSize={legalizedPageSize}
              totalItems={legalizedSerials.length}
              totalPages={legalizedPagination.totalPages}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}
