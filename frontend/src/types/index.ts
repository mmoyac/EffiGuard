export interface TokenPayload {
  user_id: number;
  tenant_id: number;
  role_id: number;
}

export interface User {
  id: number;
  nombre: string;
  email: string;
  role_id: number;
  tenant_id: number;
  tenant_nombre: string;
  uid_credencial: string | null;
}

export interface MenuItem {
  id: number;
  module_id: number;
  parent_id: number | null;
  label: string;
  ruta: string;
  icono: string | null;
  orden: number;
  children: MenuItem[];
}

export interface Asset {
  id: number;
  tenant_id: number;
  uid_fisico: string;
  nombre: string | null;
  parent_asset_id: number | null;
  model_id: number | null;
  tipo: "herramienta" | "consumible";
  estado_id: number;
  stock_actual: number;
  stock_minimo: number;
  valor_reposicion: number | null;
  proxima_mantencion: string | null;
  created_at: string;
  children: Asset[];
}

export interface Loan {
  id: number;
  tenant_id: number;
  asset_id: number;
  user_id: number;
  bodeguero_id: number;
  project_id: number | null;
  fecha_entrega: string;
  fecha_devolucion_prevista: string | null;
  fecha_devolucion_real: string | null;
  // Campos enriquecidos (solo en préstamo activo del scanner)
  user_nombre?: string;
  user_rut?: string;
  bodeguero_nombre?: string;
  proyecto_nombre?: string | null;
  asset_uid_fisico?: string | null;
}

export interface InventoryLog {
  id: number;
  tenant_id: number;
  asset_id: number;
  user_id: number;
  tipo_movimiento: string;
  cantidad: number;
  fecha_hora: string;
  observaciones: string | null;
}
