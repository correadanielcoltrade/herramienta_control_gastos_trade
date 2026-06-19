import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Plus, Search, Users, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { cavsApi } from "../api/cavs.api";
import { usersApi } from "../api/users.api";
import { PageTitle } from "../components/PageTitle";
import { useAuth } from "../hooks/useAuth";
import type { Cav, Role, RoleName, User } from "../types";
import { canManageRole } from "../utils/access";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const REGIONAL_OPTIONS = ["Todos", "Zona Norte", "Zona Sur", "Plaza Claro", "Fuera de Coltrade"] as const;
const TRADE_CREATABLE_ROLES: RoleName[] = ["Asesor", "Trade"];
const TRADE_CREATABLE_ROLE_KEYS = new Set(TRADE_CREATABLE_ROLES.map((role) => normalizeRoleLabel(role)));

const VALIDATION_FIELD_MESSAGES: Record<string, string> = {
  nombre_usuario: "El nombre debe tener al menos 2 caracteres.",
  correo: "El correo no tiene un formato valido.",
  password: "La contrasena debe tener al menos 8 caracteres.",
  role_id: "Debes seleccionar un rol valido.",
  cav_id: "El CAV seleccionado no es valido.",
};

type ValidationDetail = { loc?: Array<string | number>; msg?: string };

function formatValidationError(detail: ValidationDetail): string {
  const field = detail.loc?.[detail.loc.length - 1];
  if (typeof field === "string" && VALIDATION_FIELD_MESSAGES[field]) {
    return VALIDATION_FIELD_MESSAGES[field];
  }
  return detail.msg ?? "Hay un campo con un valor invalido.";
}

function getErrorMessage(error: unknown, fallback: string) {
  const data = (
    error as { response?: { data?: { detail?: string; errors?: ValidationDetail[] } } } | null
  )?.response?.data;

  if (data?.errors && data.errors.length > 0) {
    return Array.from(new Set(data.errors.map(formatValidationError))).join(" ");
  }

  return data?.detail ?? fallback;
}

function normalizeRoleLabel(roleName: string) {
  return roleName.trim().replace(/\s+/g, " ").toLowerCase();
}

function RegionalCheckboxes({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const selected = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function toggle(option: string) {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(next.join(","));
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {REGIONAL_OPTIONS.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
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

interface AdminModuleProps extends PropsWithChildren {
  count: number;
  icon: typeof Building2;
  isOpen: boolean;
  subtitle: string;
  title: string;
  onToggle: () => void;
}

function AdminModule({ count, icon: Icon, isOpen, subtitle, title, onToggle, children }: AdminModuleProps) {
  const ToggleIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-panel">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-50/80 xl:px-6"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {count}
          </span>
          <ToggleIcon size={18} className="text-slate-400" />
        </div>
      </button>
      {isOpen ? <div className="border-t border-slate-100 px-5 py-5 xl:px-6 xl:py-6">{children}</div> : null}
    </section>
  );
}

interface ModalShellProps extends PropsWithChildren {
  accentColor?: "brand" | "accent";
  badge?: string;
  icon?: typeof Building2;
  isOpen: boolean;
  onClose: () => void;
  size?: "compact" | "regular";
  subtitle: string;
  title: string;
}

interface ModalFieldProps extends PropsWithChildren {
  label: string;
}

const modalSizeClasses = {
  compact: {
    body: "max-w-[15rem]",
    shell: "max-w-[16.5rem]",
  },
  regular: {
    body: "max-w-[18rem]",
    shell: "max-w-[20rem]",
  },
} as const;

const modalInputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70";

function ModalField({ label, children }: ModalFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({
  accentColor = "brand",
  badge = "Edición",
  icon: Icon,
  isOpen,
  onClose,
  size = "regular",
  subtitle,
  title,
  children,
}: ModalShellProps) {
  if (!isOpen) {
    return null;
  }

  const sizeClasses = modalSizeClasses[size];
  const accentColorClasses = {
    brand: "bg-brand-600",
    accent: "bg-accent-500",
  };

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-3 py-6 backdrop-blur-[3px] transition sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Cerrar modal" onClick={onClose} />
      <div
        className={`relative z-10 w-full overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] ${sizeClasses.shell} transition`}
      >
        <div className={`h-0.5 ${accentColorClasses[accentColor]}`} />
        <div className="border-b border-slate-100/90 px-2.5 py-2">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex min-w-0 items-start gap-3">
              {Icon ? (
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    accentColor === "brand" ? "bg-brand-50 text-brand-700" : "bg-accent-100 text-accent-700"
                  }`}
                >
                  <Icon size={18} />
                </div>
              ) : null}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{badge}</p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-0.5 text-xs leading-4 text-slate-500">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Cerrar modal"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto px-2.5 py-2">
          <div className={`mx-auto w-full ${sizeClasses.body}`}>{children}</div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

interface SearchBarProps {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

function SearchBar({ onChange, placeholder, value }: SearchBarProps) {
  return (
    <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Search size={16} />
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent pr-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
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

function filterCavs(cavs: Cav[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return cavs;
  }

  return cavs.filter((cav) =>
    [cav.nombre_cav, cav.centro_costos, cav.regional ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );
}

function filterUsers(users: User[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return users;
  }

  return users.filter((user) =>
    [
      user.nombre_usuario,
      user.correo,
      user.role.name,
      user.cav?.nombre_cav ?? "Global",
      user.is_active ? "activo" : "inactivo",
    ].some((value) => value.toLowerCase().includes(normalizedSearch)),
  );
}

function filterCreatableRoles(roles: Role[], managerRole?: RoleName | null) {
  if (managerRole === "SuperAdmin") {
    return roles;
  }
  return roles.filter((role) => TRADE_CREATABLE_ROLE_KEYS.has(normalizeRoleLabel(role.name)));
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const currentRole = currentUser?.role.name;
  const isSuperAdmin = currentRole === "SuperAdmin";
  const cavsQuery = useQuery({ queryKey: ["cavs"], queryFn: cavsApi.list });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: usersApi.listRoles });

  const [isCavsOpen, setIsCavsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isCreatingCav, setIsCreatingCav] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingCavId, setEditingCavId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [cavSearch, setCavSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [cavPageSize, setCavPageSize] = useState<number>(10);
  const [userPageSize, setUserPageSize] = useState<number>(10);
  const [cavPage, setCavPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [cavForm, setCavForm] = useState({ nombre_cav: "", centro_costos: "", regional: "" });
  const [cavEditForm, setCavEditForm] = useState({ nombre_cav: "", centro_costos: "", regional: "" });
  const [userForm, setUserForm] = useState({
    nombre_usuario: "",
    correo: "",
    password: "",
    role_id: "",
    cav_id: "",
    regional: "",
    is_active: true,
  });
  const [userEditForm, setUserEditForm] = useState({
    nombre_usuario: "",
    correo: "",
    password: "",
    role_id: "",
    cav_id: "",
    regional: "",
    is_active: true,
  });

  const cavMutation = useMutation({
    mutationFn: cavsApi.create,
    onSuccess: () => {
      setCavForm({ nombre_cav: "", centro_costos: "", regional: "" });
      setIsCreatingCav(false);
      queryClient.invalidateQueries({ queryKey: ["cavs"] });
    },
  });

  const updateCavMutation = useMutation({
    mutationFn: ({
      cavId,
      payload,
    }: {
      cavId: number;
      payload: { nombre_cav: string; centro_costos: string; regional: string | null };
    }) =>
      cavsApi.update(cavId, payload),
    onSuccess: () => {
      closeCavEditModal();
      queryClient.invalidateQueries({ queryKey: ["cavs"] });
    },
  });

  const deleteCavMutation = useMutation({
    mutationFn: (cavId: number) => cavsApi.remove(cavId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cavs"] });
    },
  });

  const userMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      setUserForm({
        nombre_usuario: "",
        correo: "",
        password: "",
        role_id: "",
        cav_id: "",
        regional: "",
        is_active: true,
      });
      setIsCreatingUser(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: Partial<{
        nombre_usuario: string;
        correo: string;
        password: string;
        role_id: number;
        cav_id: number | null;
        regional: string | null;
        is_active: boolean;
      }>;
    }) => usersApi.update(userId, payload),
    onSuccess: () => {
      closeUserEditModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const cavErrorMessage = getErrorMessage(cavMutation.error ?? deleteCavMutation.error, "No fue posible guardar el CAV.");
  const cavUpdateErrorMessage = getErrorMessage(updateCavMutation.error, "No fue posible actualizar el CAV.");
  const userErrorMessage = getErrorMessage(userMutation.error, "No fue posible guardar el usuario.");
  const userUpdateErrorMessage = getErrorMessage(updateUserMutation.error, "No fue posible actualizar el usuario.");

  const filteredCavs = filterCavs(cavsQuery.data ?? [], cavSearch);
  const cavPagination = paginateRows(filteredCavs, cavPage, cavPageSize);
  const filteredUsers = filterUsers(usersQuery.data ?? [], userSearch);
  const userPagination = paginateRows(filteredUsers, userPage, userPageSize);
  const editableRoles = (rolesQuery.data ?? []).filter((role) => canManageRole(currentRole, role.name));
  const creatableRoles = filterCreatableRoles(editableRoles, currentRole);

  function isTradeRoleId(roleId: string) {
    const role = (rolesQuery.data ?? []).find((item) => String(item.id) === roleId);
    return role ? normalizeRoleLabel(role.name) === "trade" : false;
  }

  const showCreateRegional = isTradeRoleId(userForm.role_id);
  const showEditRegional = isTradeRoleId(userEditForm.role_id);

  function closeCavEditModal() {
    setEditingCavId(null);
    setCavEditForm({ nombre_cav: "", centro_costos: "", regional: "" });
  }

  function closeUserEditModal() {
    setEditingUserId(null);
    setUserEditForm({
      nombre_usuario: "",
      correo: "",
      password: "",
      role_id: "",
      cav_id: "",
      regional: "",
      is_active: true,
    });
  }

  function openCavCreateModal() {
    setIsCreatingCav(true);
    setCavForm({ nombre_cav: "", centro_costos: "", regional: "" });
  }

  function closeCavCreateModal() {
    setIsCreatingCav(false);
    setCavForm({ nombre_cav: "", centro_costos: "", regional: "" });
  }

  function openUserCreateModal() {
    setIsCreatingUser(true);
    setUserForm({
      nombre_usuario: "",
      correo: "",
      password: "",
      role_id: creatableRoles.length === 1 ? String(creatableRoles[0].id) : "",
      cav_id: "",
      regional: "",
      is_active: true,
    });
  }

  function closeUserCreateModal() {
    setIsCreatingUser(false);
    setUserForm({
      nombre_usuario: "",
      correo: "",
      password: "",
      role_id: "",
      cav_id: "",
      regional: "",
      is_active: true,
    });
  }

  function openCavEditModal(cav: Cav) {
    setEditingCavId(cav.id);
    setCavEditForm({
      nombre_cav: cav.nombre_cav,
      centro_costos: cav.centro_costos,
      regional: cav.regional ?? "",
    });
  }

  function openUserEditModal(user: User) {
    setEditingUserId(user.id);
    setUserEditForm({
      nombre_usuario: user.nombre_usuario,
      correo: user.correo,
      password: "",
      role_id: String(user.role_id),
      cav_id: user.cav_id ? String(user.cav_id) : "",
      regional: user.regional ?? "",
      is_active: user.is_active,
    });
  }

  async function handleCreateCav(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await cavMutation.mutateAsync({
        nombre_cav: cavForm.nombre_cav,
        centro_costos: cavForm.centro_costos,
        regional: cavForm.regional.trim() ? cavForm.regional.trim() : null,
      });
    } catch {
      // El error se muestra en el modulo.
    }
  }

  async function handleUpdateCav(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCavId) {
      return;
    }

    try {
      await updateCavMutation.mutateAsync({
        cavId: editingCavId,
        payload: {
          nombre_cav: cavEditForm.nombre_cav,
          centro_costos: cavEditForm.centro_costos,
          regional: cavEditForm.regional.trim() ? cavEditForm.regional.trim() : null,
        },
      });
    } catch {
      // El error se muestra en el modal.
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      ...userForm,
      role_id: Number(userForm.role_id),
      cav_id: userForm.cav_id ? Number(userForm.cav_id) : null,
      regional: showCreateRegional ? userForm.regional || null : null,
    };

    try {
      await userMutation.mutateAsync(payload);
    } catch {
      // El error se muestra en el modulo.
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUserId) {
      return;
    }

    const payload = {
      ...userEditForm,
      role_id: Number(userEditForm.role_id),
      cav_id: userEditForm.cav_id ? Number(userEditForm.cav_id) : null,
      regional: showEditRegional ? userEditForm.regional || null : null,
      password: userEditForm.password || undefined,
    };

    try {
      await updateUserMutation.mutateAsync({
        userId: editingUserId,
        payload,
      });
    } catch {
      // El error se muestra en el modal.
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Administracion"
        description="Gestion central de CAVs y usuarios con modulos desplegables, tablas operativas, filtros y paginacion."
      />

      <div className="space-y-6">
        {isSuperAdmin ? (
          <AdminModule
            count={cavsQuery.data?.length ?? 0}
            icon={Building2}
            isOpen={isCavsOpen}
            subtitle="Crea, edita y consulta centros de atencion desde una sola vista."
            title="Gestion de CAVs"
            onToggle={() => setIsCavsOpen((current) => !current)}
          >
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">Tabla de CAVs</h4>
                  <p className="mt-1 text-sm text-slate-600">Consulta y filtra los CAVs registrados.</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                  <div className="w-full md:max-w-sm">
                    <SearchBar
                      placeholder="Buscar por nombre o centro de costos"
                      value={cavSearch}
                      onChange={(value) => {
                        setCavSearch(value);
                        setCavPage(1);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openCavCreateModal}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700"
                  >
                    <Plus size={16} />
                    Nuevo CAV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[720px] divide-y divide-slate-100">
                  <thead className="bg-slate-50/80">
                    <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-3 font-semibold">Nombre CAV</th>
                      <th className="px-4 py-3 font-semibold">Centro de costos</th>
                      <th className="px-4 py-3 font-semibold">Regional</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {cavsQuery.isLoading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                          Cargando CAVs...
                        </td>
                      </tr>
                    ) : cavPagination.pageRows.length > 0 ? (
                      cavPagination.pageRows.map((cav) => (
                        <tr key={cav.id} className="transition hover:bg-slate-50/70">
                          <td className="px-4 py-4 font-medium text-slate-900">{cav.nombre_cav}</td>
                          <td className="px-4 py-4">{cav.centro_costos}</td>
                          <td className="px-4 py-4">{cav.regional ?? "Sin asignar"}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openCavEditModal(cav)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCavMutation.mutate(cav.id)}
                                className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                          No hay CAVs que coincidan con la busqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
              </div>

              <PaginationFooter
                itemLabel="CAVs"
                page={cavPagination.safePage}
                pageSize={cavPageSize}
                totalItems={filteredCavs.length}
                totalPages={cavPagination.totalPages}
                onPageChange={setCavPage}
                onPageSizeChange={(size) => {
                  setCavPageSize(size);
                  setCavPage(1);
                }}
              />
            </div>
          </AdminModule>
        ) : null}

        <AdminModule
          count={usersQuery.data?.length ?? 0}
          icon={Users}
          isOpen={isUsersOpen}
          subtitle="Administra operadores, roles y asignacion de CAV con una tabla de trabajo."
          title="Gestion de Usuarios"
          onToggle={() => setIsUsersOpen((current) => !current)}
        >
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Tabla de usuarios</h4>
                <p className="mt-1 text-sm text-slate-600">Filtra por nombre, correo, rol, CAV o estado.</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                <div className="w-full md:max-w-sm">
                  <SearchBar
                    placeholder="Buscar usuario, correo, rol o CAV"
                    value={userSearch}
                    onChange={(value) => {
                      setUserSearch(value);
                      setUserPage(1);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={openUserCreateModal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-4 py-2.5 font-medium text-white transition hover:brightness-95"
                >
                  <Plus size={16} />
                  Nuevo Usuario
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="min-w-[980px] divide-y divide-slate-100">
                  <thead className="bg-slate-50/80">
                    <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-3 font-semibold">Usuario</th>
                      <th className="px-4 py-3 font-semibold">Correo</th>
                      <th className="px-4 py-3 font-semibold">Rol</th>
                      <th className="px-4 py-3 font-semibold">CAV</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {usersQuery.isLoading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          Cargando usuarios...
                        </td>
                      </tr>
                    ) : userPagination.pageRows.length > 0 ? (
                      userPagination.pageRows.map((item) => {
                        const canManageThisUser = canManageRole(currentRole, item.role.name);

                        return (
                          <tr key={item.id} className="transition hover:bg-slate-50/70">
                          <td className="px-4 py-4">
                            <p className="font-medium text-slate-900">{item.nombre_usuario}</p>
                          </td>
                          <td className="px-4 py-4">{item.correo}</td>
                          <td className="px-4 py-4">{item.role.name}</td>
                          <td className="px-4 py-4">{item.cav?.nombre_cav ?? "Global"}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                                item.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {item.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openUserEditModal(item)}
                                disabled={!canManageThisUser}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateUserMutation.mutate({
                                    userId: item.id,
                                    payload: { is_active: !item.is_active },
                                  })
                                }
                                disabled={!canManageThisUser}
                                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                  item.is_active
                                    ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                    : "border-brand-200 text-brand-700 hover:bg-brand-50"
                                }`}
                              >
                                {item.is_active ? "Desactivar" : "Reactivar"}
                              </button>
                            </div>
                          </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          No hay usuarios que coincidan con la busqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>

            <PaginationFooter
              itemLabel="usuarios"
              page={userPagination.safePage}
              pageSize={userPageSize}
              totalItems={filteredUsers.length}
              totalPages={userPagination.totalPages}
              onPageChange={setUserPage}
              onPageSizeChange={(size) => {
                setUserPageSize(size);
                setUserPage(1);
              }}
            />
          </div>
        </AdminModule>
      </div>

      <ModalShell
        accentColor="brand"
        badge="Edición"
        icon={Building2}
        isOpen={editingCavId !== null}
        size="compact"
        title="Editar CAV"
        subtitle="Actualiza los datos del CAV sin salir de la tabla."
        onClose={closeCavEditModal}
      >
        <form className="space-y-1.5" onSubmit={handleUpdateCav}>
          <ModalField label="Nombre CAV">
            <input
              className={modalInputClassName}
              placeholder="Ingresa el nombre del CAV"
              value={cavEditForm.nombre_cav}
              onChange={(event) => setCavEditForm((current) => ({ ...current, nombre_cav: event.target.value }))}
              required
            />
          </ModalField>
          <ModalField label="Centro de costos">
            <input
              className={modalInputClassName}
              placeholder="Ingresa el centro de costos"
              value={cavEditForm.centro_costos}
              onChange={(event) => setCavEditForm((current) => ({ ...current, centro_costos: event.target.value }))}
              required
            />
          </ModalField>
          <ModalField label="Regional">
            <select
              className={modalInputClassName}
              value={cavEditForm.regional}
              onChange={(event) => setCavEditForm((current) => ({ ...current, regional: event.target.value }))}
            >
              <option value="">Sin asignar</option>
              {REGIONAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </ModalField>
          {updateCavMutation.error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{cavUpdateErrorMessage}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-1.5 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={closeCavEditModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              disabled={updateCavMutation.isPending}
            >
              {updateCavMutation.isPending ? "Actualizando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        accentColor="accent"
        badge="Edición"
        icon={Users}
        isOpen={editingUserId !== null}
        size="regular"
        title="Editar usuario"
        subtitle="Modifica los datos del usuario desde un modal dedicado."
        onClose={closeUserEditModal}
      >
        <form className="space-y-3.5" onSubmit={handleUpdateUser}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ModalField label="Nombre">
                <input
                  className={modalInputClassName}
                  placeholder="Nombre completo"
                  value={userEditForm.nombre_usuario}
                  onChange={(event) => setUserEditForm((current) => ({ ...current, nombre_usuario: event.target.value }))}
                  minLength={2}
                  required
                />
              </ModalField>
            </div>
            <div className="sm:col-span-2">
              <ModalField label="Correo">
                <input
                  className={modalInputClassName}
                  placeholder="correo@empresa.com"
                  type="email"
                  value={userEditForm.correo}
                  onChange={(event) => setUserEditForm((current) => ({ ...current, correo: event.target.value }))}
                  required
                />
              </ModalField>
            </div>
            <div className="sm:col-span-2">
              <ModalField label="Nueva contrasena">
                <input
                  className={modalInputClassName}
                  placeholder="Opcional (minimo 8 caracteres)"
                  type="password"
                  value={userEditForm.password}
                  onChange={(event) => setUserEditForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={8}
                />
                <p className="mt-1 text-xs text-slate-400">Dejala en blanco para conservar la actual.</p>
              </ModalField>
            </div>
            <ModalField label="Rol">
              <select
                className={modalInputClassName}
                value={userEditForm.role_id}
                onChange={(event) => setUserEditForm((current) => ({ ...current, role_id: event.target.value }))}
                required
              >
                <option value="">Selecciona rol</option>
                {editableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="CAV asignado">
              <select
                className={modalInputClassName}
                value={userEditForm.cav_id}
                onChange={(event) => setUserEditForm((current) => ({ ...current, cav_id: event.target.value }))}
              >
                <option value="">Sin CAV</option>
                {cavsQuery.data?.map((cav) => (
                  <option key={cav.id} value={cav.id}>
                    {cav.nombre_cav}
                  </option>
                ))}
              </select>
            </ModalField>
            {showEditRegional ? (
              <div className="sm:col-span-2">
                <ModalField label="Regionales">
                  <RegionalCheckboxes
                    value={userEditForm.regional}
                    onChange={(next) => setUserEditForm((current) => ({ ...current, regional: next }))}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Solo aplica a usuarios con rol Trade. Puedes seleccionar varias.
                  </p>
                </ModalField>
              </div>
            ) : null}
          </div>
          {updateUserMutation.error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{userUpdateErrorMessage}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-1.5 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={closeUserEditModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent-500 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-60"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Actualizando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        accentColor="brand"
        badge="Nuevo"
        icon={Building2}
        isOpen={isCreatingCav}
        size="compact"
        title="Crear CAV"
        subtitle="Registra el CAV y su centro de costos para dejarlo disponible en la operación."
        onClose={closeCavCreateModal}
      >
        <form className="space-y-3.5" onSubmit={handleCreateCav}>
          <ModalField label="Nombre CAV">
            <input
              className={modalInputClassName}
              placeholder="Ingresa el nombre del CAV"
              value={cavForm.nombre_cav}
              onChange={(event) => setCavForm((current) => ({ ...current, nombre_cav: event.target.value }))}
              required
            />
          </ModalField>
          <ModalField label="Centro de costos">
            <input
              className={modalInputClassName}
              placeholder="Ingresa el centro de costos"
              value={cavForm.centro_costos}
              onChange={(event) => setCavForm((current) => ({ ...current, centro_costos: event.target.value }))}
              required
            />
          </ModalField>
          <ModalField label="Regional">
            <select
              className={modalInputClassName}
              value={cavForm.regional}
              onChange={(event) => setCavForm((current) => ({ ...current, regional: event.target.value }))}
            >
              <option value="">Sin asignar</option>
              {REGIONAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </ModalField>
          {cavMutation.error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{cavErrorMessage}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-1.5 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={closeCavCreateModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              disabled={cavMutation.isPending}
            >
              {cavMutation.isPending ? "Creando..." : "Crear CAV"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        accentColor="accent"
        badge="Nuevo"
        icon={Users}
        isOpen={isCreatingUser}
        size="regular"
        title="Crear Usuario"
        subtitle="Configura acceso, rol y CAV para cada usuario operativo."
        onClose={closeUserCreateModal}
      >
        <form className="space-y-3.5" onSubmit={handleCreateUser}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ModalField label="Nombre">
                <input
                  className={modalInputClassName}
                  placeholder="Nombre completo"
                  value={userForm.nombre_usuario}
                  onChange={(event) => setUserForm((current) => ({ ...current, nombre_usuario: event.target.value }))}
                  minLength={2}
                  required
                />
              </ModalField>
            </div>
            <div className="sm:col-span-2">
              <ModalField label="Correo">
                <input
                  className={modalInputClassName}
                  placeholder="correo@empresa.com"
                  type="email"
                  value={userForm.correo}
                  onChange={(event) => setUserForm((current) => ({ ...current, correo: event.target.value }))}
                  required
                />
              </ModalField>
            </div>
            <div className="sm:col-span-2">
              <ModalField label="Contrasena">
                <input
                  className={modalInputClassName}
                  placeholder="Minimo 8 caracteres"
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={8}
                  required
                />
                <p className="mt-1 text-xs text-slate-400">La contraseña debe tener al menos 8 caracteres.</p>
              </ModalField>
            </div>
            <ModalField label="Rol">
              <select
                className={modalInputClassName}
                value={userForm.role_id}
                onChange={(event) => setUserForm((current) => ({ ...current, role_id: event.target.value }))}
                required
              >
                <option value="">Selecciona rol</option>
                {creatableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="CAV asignado">
              <select
                className={modalInputClassName}
                value={userForm.cav_id}
                onChange={(event) => setUserForm((current) => ({ ...current, cav_id: event.target.value }))}
              >
                <option value="">Sin CAV</option>
                {cavsQuery.data?.map((cav) => (
                  <option key={cav.id} value={cav.id}>
                    {cav.nombre_cav}
                  </option>
                ))}
              </select>
            </ModalField>
            {showCreateRegional ? (
              <div className="sm:col-span-2">
                <ModalField label="Regionales">
                  <RegionalCheckboxes
                    value={userForm.regional}
                    onChange={(next) => setUserForm((current) => ({ ...current, regional: next }))}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Solo aplica a usuarios con rol Trade. Puedes seleccionar varias.
                  </p>
                </ModalField>
              </div>
            ) : null}
          </div>
          {userMutation.error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{userErrorMessage}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-1.5 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={closeUserCreateModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent-500 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-60"
              disabled={userMutation.isPending}
            >
              {userMutation.isPending ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
