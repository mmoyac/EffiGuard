export interface TokenPayload {
  user_id: number;
  tenant_id: number;
  role_id: number;
}

export interface User {
  id: number;
  nombre: string;
  email: string;
  rut: string;
  role_id: number;
  tenant_id: number;
  tenant_nombre?: string;
  tenant_logo_url?: string | null;
  uid_credencial: string | null;
  is_active?: boolean;
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

export type FamilyColor = "blue" | "orange" | "green" | "purple" | "red" | "yellow" | "pink" | "cyan";

export interface AssetFamily {
  id: number;
  tenant_id: number;
  nombre: string;
  comportamiento: "prestable" | "consumible";
  color: FamilyColor;
  dias_max_prestamo: number | null;
}

export interface Ubicacion {
  id: number;
  tenant_id?: number;
  rack: string;
  nivel: string;
  posicion: string;
  descripcion: string | null;
}

export type UnidadMedida = "unidad" | "metro" | "kilo" | "litro";

export interface Asset {
  id: number;
  tenant_id: number;
  uid_fisico: string;
  /** Código de barras de fábrica: identifica el PRODUCTO, lo comparten las unidades iguales. */
  codigo_fabricante: string | null;
  nombre: string | null;
  parent_asset_id: number | null;
  model_id: number | null;
  family_id: number;
  family: AssetFamily;
  estado_id: number;
  ubicacion_id: number | null;
  ubicacion: Ubicacion | null;
  stock_actual: number;
  stock_minimo: number;
  unidad: UnidadMedida;
  /** Cuántas unidades trae cada caja/rollo. Se compra por empaque, se despacha por unidad. */
  contenido_por_empaque: number | null;
  nombre_empaque: string | null;
  /** Costo de una unidad de stock. Valoriza los movimientos; distinto de valor_reposicion. */
  precio_compra: number | null;
  valor_reposicion: number | null;
  dias_max_prestamo: number | null;
  proxima_mantencion: string | null;
  created_at: string;
  children: Asset[];
}

/** Unidad candidata cuando un código de fábrica resuelve varias. */
export interface AssetCandidato {
  id: number;
  uid_fisico: string;
  nombre: string | null;
  estado_id: number;
  ubicacion: Ubicacion | null;
}

/** Respuesta de /assets/scan: el código puede ser de una unidad o de un producto. */
export interface ScanResolution {
  tipo: "unico" | "multiple";
  asset: Asset | null;
  codigo_fabricante: string | null;
  candidatos: AssetCandidato[];
}

export interface DespachoPendiente {
  despacho_id: number;
  cantidad_despachada: number;
  cantidad_reintegrada: number;
  saldo_pendiente: number;
  fecha_hora: string;
  operario_nombre: string | null;
  proyecto_nombre: string | null;
  observaciones: string | null;
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
  asset_nombre?: string | null;
}

export interface InventoryLog {
  id: number;
  tenant_id: number;
  asset_id: number;
  asset_nombre: string | null;
  asset_uid: string | null;
  asset_tipo: string | null;
  asset_color: string | null;
  user_id: number;
  user_nombre: string | null;
  operario_id: number | null;
  operario_nombre: string | null;
  tipo_movimiento: string;
  cantidad: number;
  /** Precio congelado al ocurrir. null = sin valorizar, distinto de 0. */
  costo_unitario: number | null;
  costo_total: number | null;
  fecha_hora: string;
  observaciones: string | null;
}
