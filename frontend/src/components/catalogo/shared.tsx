/**
 * Piezas compartidas del catálogo producto → variante → unidad.
 *
 * Viven acá y no en `pages/Catalogo.tsx` porque el escáner usa los mismos
 * modales: una página importando de otra página es la forma rápida de que
 * después nadie sepa quién depende de quién.
 */
import type { ReactNode } from "react";

export const INPUT =
  "bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full min-h-[48px]";
export const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-[48px] text-sm font-medium transition-colors disabled:opacity-50";

export type Codigo = {
  id: number;
  codigo: string;
  tipo: string;
  proveedor_nombre: string | null;
  factor: number;
  nombre_empaque: string | null;
  es_principal: boolean;
};

export type Unidad = {
  id: number;
  estado_id: number;
  codigo_principal: string | null;
  codigos: Codigo[];
  ubicacion_id: number | null;
  ubicacion: { rack: string; nivel: string; posicion: string } | null;
  proxima_mantencion: string | null;
};

export type Variante = {
  id: number;
  nombre: string;
  producto_nombre: string;
  comportamiento: string;
  unidad: string;
  stock_efectivo: number;
  stock_minimo: number;
  bajo_stock: boolean;
  unidades_total: number;
  unidades_disponibles: number;
  precio_compra: number | null;
  // Techo de días para prestarla: el de la variante, o el que hereda de su familia.
  dias_max_prestamo: number | null;
  family?: { nombre: string; color: string; dias_max_prestamo: number | null };
  codigos: Codigo[];
  ubicacion: { rack: string; nivel: string; posicion: string } | null;
};

export type Producto = {
  id: number;
  nombre: string;
  comportamiento: string;
  brand_nombre: string | null;
  family: { nombre: string; color: string };
  variantes: Variante[];
};

// Un código dice de dónde viene; el color lo hace legible de un vistazo.
export const TIPO_ESTILO: Record<string, string> = {
  fabricante: "bg-indigo-500/15 text-indigo-300",
  proveedor: "bg-emerald-500/15 text-emerald-300",
  empaque: "bg-amber-500/15 text-amber-300",
  propio: "bg-sky-500/15 text-sky-300",
  serie_fabrica: "bg-fuchsia-500/15 text-fuchsia-300",
};

export const COLORES_FAMILIA: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  green: "bg-green-500/15 text-green-300 border-green-500/30",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  pink: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

export function mensajeError(e: any, porDefecto: string): string {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.msg ?? porDefecto;
  return d?.message ?? porDefecto;
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-3">
      <div className="bg-gray-800 rounded-2xl p-4 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{titulo}</h3>
            {subtitulo && <p className="text-xs text-gray-400 truncate">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
