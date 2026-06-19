import type { SerialStatus } from "../types";

const statusLabels: Record<SerialStatus, string> = {
  enviado: "En transito",
  recibido: "Recibido",
  disponible: "Disponible",
  gastado: "Gastado",
  legalizado: "Legalizado",
  duplicado: "Duplicado",
  pendiente: "Novedad",
};

export const serialStatusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value: value as SerialStatus,
  label,
}));

export function formatSerialStatus(status?: SerialStatus | null) {
  return status ? statusLabels[status] : "Sin estado";
}
