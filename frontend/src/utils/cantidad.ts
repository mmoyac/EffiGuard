import type { Asset } from "../types";

const UNIDAD_ABREV: Record<string, string> = {
  unidad: "",
  metro: "m",
  kilo: "kg",
  litro: "L",
};

/** 9000 → "9.000", 80.5 → "80,5". Sin decimales cuando no los tiene. */
export function formatCantidad(v: number | string, maxDecimales = 3): string {
  return Number(v).toLocaleString("es-CL", { maximumFractionDigits: maxDecimales });
}

const UNIDAD_PLURAL: Record<string, string> = {
  unidad: "unidades",
  metro: "metros",
  kilo: "kilos",
  litro: "litros",
};

/** Abreviatura de la unidad de stock. Vacía para "unidad", que no se escribe. */
export function abrevUnidad(unidad?: string | null): string {
  return UNIDAD_ABREV[unidad ?? "unidad"] ?? "";
}

/** "metros", "unidades" — para etiquetas de formulario. */
export function unidadPlural(unidad?: string | null): string {
  return UNIDAD_PLURAL[unidad ?? "unidad"] ?? "unidades";
}

/**
 * Las magnitudes continuas admiten decimales; las unidades discretas no.
 * No existe medio tornillo, pero sí medio metro de cable.
 */
export function esMedidaContinua(unidad?: string | null): boolean {
  return (unidad ?? "unidad") !== "unidad";
}

/** "9.000 un." / "80,5 m" */
export function formatStock(v: number | string, unidad?: string | null): string {
  const abrev = abrevUnidad(unidad);
  return abrev ? `${formatCantidad(v)} ${abrev}` : formatCantidad(v);
}

/**
 * Equivalente en empaques, como ayuda de lectura: "90 cajas", "90,5 cajas".
 *
 * Se muestra con un decimal cuando el stock no calza con empaques completos —
 * 9.050 unidades son noventa cajas y media, y redondear a 90 sería mentir.
 * Devuelve null si el activo no tiene empaque configurado.
 */
export function formatEmpaques(
  stock: number | string,
  contenidoPorEmpaque?: number | string | null,
  nombreEmpaque?: string | null,
): string | null {
  const contenido = Number(contenidoPorEmpaque);
  if (!contenido || contenido <= 0) return null;

  const cantidad = Number(stock) / contenido;
  const envase = nombreEmpaque || "empaque";
  const plural = cantidad !== 1 && !envase.endsWith("s") ? `${envase}s` : envase;

  return `${formatCantidad(cantidad, 1)} ${plural}`;
}

/** Atajo para un activo completo. */
export function empaquesDeAsset(asset: Asset): string | null {
  return formatEmpaques(asset.stock_actual, asset.contenido_por_empaque, asset.nombre_empaque);
}
