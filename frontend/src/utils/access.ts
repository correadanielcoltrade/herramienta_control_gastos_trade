import type { ModuleName, PermissionAction, RoleName } from "../types";

// Matriz de permisos por rol y modulo
// Cada modulo tiene un array de acciones permitidas
type RolePermissions = {
  [K in ModuleName]?: PermissionAction[];
};

const rolePermissionsMatrix: Record<RoleName, RolePermissions> = {
  SuperAdmin: {
    dashboard: ["read"],
    scan: ["read", "create", "edit", "delete"],
    supply: ["read", "create", "edit", "delete"],
    legalization: ["read", "create", "edit", "delete"],
    admin: ["read", "create", "edit", "delete"],
  },
  OPS: {
    dashboard: ["read"],
    supply: ["read", "create", "edit", "delete"],
  },
  Quality: {
    dashboard: ["read"],
    scan: ["read"],
    legalization: ["read"],
  },
  "Trade Leader": {
    dashboard: ["read"],
    scan: ["read", "create", "edit", "delete"],
    legalization: ["read", "create", "edit", "delete"],
    admin: ["read", "create", "edit", "delete"],
  },
  Trade: {
    dashboard: ["read"],
    scan: ["read", "create", "edit", "delete"],
    legalization: ["read", "create", "edit", "delete"],
    admin: ["read", "create", "edit", "delete"],
  },
  "Trade Manager": {
    dashboard: ["read"],
    scan: ["read", "create", "edit", "delete"],
    legalization: ["read", "create", "edit", "delete"],
    admin: ["read", "create", "edit", "delete"],
  },
  Asesor: {
    dashboard: ["read"],
    scan: ["read", "create"],
    legalization: ["read", "create"],
  },
  Supernumerario: {
    dashboard: ["read"],
    scan: ["read", "create"],
    legalization: ["read", "create"],
  },
};

// Roles que tienen acceso a CAVs globales (sin restriccion de PDV)
const globalCavRoles: RoleName[] = [
  "SuperAdmin",
  "OPS",
  "Quality",
  "Trade",
  "Trade Leader",
  "Trade Manager",
  "Supernumerario",
];

// Roles de solo consulta (no pueden crear, editar ni eliminar)
const readOnlyRoles: RoleName[] = ["Quality"];

function normalizeRoleName(roleName?: string | null) {
  return roleName?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function findRoleName(roleName: RoleName | null | undefined): RoleName | null {
  const normalized = normalizeRoleName(roleName);
  return (Object.keys(rolePermissionsMatrix) as RoleName[]).find((role) => normalizeRoleName(role) === normalized) ?? null;
}

export function hasGlobalCavAccess(roleName?: RoleName | null) {
  const matchedRole = findRoleName(roleName);
  return matchedRole ? globalCavRoles.includes(matchedRole) : false;
}

export function isReadOnlyRole(roleName?: RoleName | null) {
  const matchedRole = findRoleName(roleName);
  return matchedRole ? readOnlyRoles.includes(matchedRole) : false;
}

// Verifica si un rol tiene acceso a un modulo (cualquier accion)
export function canAccessModule(
  roleName: RoleName | null | undefined,
  moduleName: ModuleName,
): boolean {
  const matchedRole = findRoleName(roleName);
  if (!matchedRole) return false;
  const perms = rolePermissionsMatrix[matchedRole];
  if (!perms) return false;
  return Boolean(perms[moduleName] && perms[moduleName]!.length > 0);
}

// Verifica si un rol puede ejecutar una accion especifica en un modulo
export function hasPermission(
  roleName: RoleName | null | undefined,
  moduleName: ModuleName,
  action: PermissionAction,
): boolean {
  const matchedRole = findRoleName(roleName);
  if (!matchedRole) return false;
  const perms = rolePermissionsMatrix[matchedRole];
  if (!perms) return false;
  return perms[moduleName]?.includes(action) ?? false;
}

// Helpers especificos para modulos comunes
export function canAccessDashboard(roleName?: RoleName | null) {
  return canAccessModule(roleName, "dashboard");
}

export function canAccessScan(roleName?: RoleName | null) {
  return canAccessModule(roleName, "scan");
}

export function canAccessSupplyModule(roleName?: RoleName | null) {
  return canAccessModule(roleName, "supply");
}

export function canAccessLegalization(roleName?: RoleName | null) {
  return canAccessModule(roleName, "legalization");
}

export function canAccessAdmin(roleName?: RoleName | null) {
  return canAccessModule(roleName, "admin");
}

// Helpers de accion (crear/editar/eliminar)
export function canManageSupplies(roleName?: RoleName | null) {
  return hasPermission(roleName, "supply", "create");
}

export function canCreateScan(roleName?: RoleName | null) {
  return hasPermission(roleName, "scan", "create");
}

export function canCreateLegalization(roleName?: RoleName | null) {
  return hasPermission(roleName, "legalization", "create");
}

export function canManageUsers(roleName?: RoleName | null) {
  return hasPermission(roleName, "admin", "create");
}

export function canManageRole(
  managerRole: RoleName | null | undefined,
  targetRole: RoleName,
): boolean {
  const manager = findRoleName(managerRole);
  const target = findRoleName(targetRole);
  if (!manager || !target) return false;
  if (manager === "SuperAdmin") return true;
  if (manager === "Trade" || manager === "Trade Leader" || manager === "Trade Manager") {
    return target === "Trade" || target === "Asesor" || target === "Supernumerario";
  }
  return false;
}

// Lista de roles para los que es relevante mantener compatibilidad legacy
export const supplyModuleRoles: RoleName[] = ["SuperAdmin", "OPS"];
