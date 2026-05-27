export type RoleName =
  | "SuperAdmin"
  | "OPS"
  | "Quality"
  | "Trade"
  | "Trade Leader"
  | "Asesor"
  | "Supernumerario";

export type ModuleName =
  | "dashboard"
  | "scan"
  | "supply"
  | "legalization"
  | "admin";

export type PermissionAction = "read" | "create" | "edit" | "delete";

export type SerialStatus =
  | "enviado"
  | "recibido"
  | "disponible"
  | "gastado"
  | "legalizado"
  | "duplicado"
  | "pendiente";

export interface Role {
  id: number;
  name: RoleName;
  description?: string | null;
}

export interface Cav {
  id: number;
  nombre_cav: string;
  centro_costos: string;
  regional?: string | null;
}

export interface User {
  id: number;
  nombre_usuario: string;
  correo: string;
  role_id: number;
  cav_id: number | null;
  is_active: boolean;
  role: Role;
  cav?: Cav | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SerialRecord {
  id: number;
  serial: string;
  descripcion_producto?: string | null;
  cav_id?: number | null;
  current_status: SerialStatus;
  last_movement_at?: string | null;
  cav?: Cav | null;
}

export interface SerialMovement {
  id: number;
  movement_type: string;
  previous_status?: SerialStatus | null;
  new_status: SerialStatus;
  source_table: string;
  source_id?: number | null;
  notes?: string | null;
  cav_id?: number | null;
  user_id?: number | null;
  created_at: string;
}

export interface BlockedSerial {
  serial: string;
  cav_asignado_id: number;
  cav_asignado_nombre: string;
}

export interface ReceptionResult {
  procesados: SerialRecord[];
  pendientes: SerialRecord[];
  duplicados: string[];
  bloqueados: BlockedSerial[];
}

export interface ReceptionRecord {
  id: number;
  serial_id: number;
  serial: string;
  cav_id: number;
  fecha: string;
  confirmado_por: string;
  cav?: Cav | null;
}

export interface DashboardSummary {
  total_seriales: number;
  enviados: number;
  disponibles: number;
  legalizados: number;
  pendientes: number;
  duplicados: number;
}

export interface DashboardPoint {
  fecha: string;
  abastecimientos: number;
  recepciones: number;
  disponibles: number;
  legalizados: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  series: DashboardPoint[];
}

export type EstadoEntrega = "Pendiente de Entrega" | "Entregado por Transportadora";

export interface SupplyPayload {
  serial: string;
  descripcion_producto: string;
  material?: string | null;
  numero_guia: string;
  cav_id: number;
  centro_costos_cav: string;
  fecha_envio: string;
  fecha_entrega_pdv?: string | null;
  estado_entrega?: EstadoEntrega | null;
}

export interface SupplyRecord {
  id: number;
  serial_id: number;
  serial: string;
  descripcion_producto: string;
  material?: string | null;
  numero_guia?: string | null;
  cav_id: number;
  centro_costos_cav: string;
  fecha_envio: string;
  fecha_entrega_pdv?: string | null;
  estado_entrega: EstadoEntrega;
  current_status: SerialStatus;
  cav?: Cav | null;
}

export interface SupplyFilters {
  cav_id?: number;
  end_date?: string;
  producto?: string;
  serial?: string;
  start_date?: string;
  status?: SerialStatus;
  user_id?: number;
}

export interface ReceiptPayload {
  seriales: string[];
  cav_id: number;
  fecha: string;
}

export interface LegalizationPayload {
  serial: string;
  tipo_inventario: string;
  tipo_uso: string;
  cliente_asesor: string;
  documento_cliente?: string;
  numero_factura: string;
  firma: string;
  asesor_responsable: string;
  fecha: string;
}

export interface LegalizationRecord {
  id: number;
  serial_id: number;
  serial: string;
  fecha: string;
  tipo_inventario: string;
  tipo_uso: string;
  cliente_asesor: string;
  documento_cliente?: string | null;
  numero_factura?: string | null;
  firma: string;
  asesor_responsable: string;
  registrado_por: string;
  cav?: Cav | null;
}

export interface SerialFilters {
  cav_id?: number;
  status?: SerialStatus;
  user_id?: number;
  serial?: string;
}

export interface DashboardFilters {
  cav_id?: number;
  status?: SerialStatus;
  user_id?: number;
  start_date?: string;
  end_date?: string;
}

export interface ForgotPasswordPayload {
  correo: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}
