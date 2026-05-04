import type { RoleName } from "../types";

const globalCavRoles: RoleName[] = ["SuperAdmin", "OPS", "Quality", "Trade", "Supernumerario"];
export const supplyModuleRoles: RoleName[] = ["SuperAdmin", "OPS", "Quality", "Trade"];
const supplyManagerRoles: RoleName[] = ["SuperAdmin", "OPS", "Trade"];

export function hasGlobalCavAccess(roleName?: RoleName | null) {
  return roleName ? globalCavRoles.includes(roleName) : false;
}

export function canAccessSupplyModule(roleName?: RoleName | null) {
  return roleName ? supplyModuleRoles.includes(roleName) : false;
}

export function canManageSupplies(roleName?: RoleName | null) {
  return roleName ? supplyManagerRoles.includes(roleName) : false;
}
