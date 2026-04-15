import { useState, useMemo } from "react";
import { useQuery } from "react-query";
import {
  ClipboardList,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  Wrench,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { familyColor } from "../utils/familyColors";
import { api } from "../services/api";
import type { InventoryLog } from "../types";

// ─── Config de tipos de movimiento ───────────────────────────────────────────

const MOVIMIENTO: Record<
  string,
  { label: string; color: string; bg: string; Icon: React.ElementType; signo: "+" | "-" | "" }
> = {
  entrega:    { label: "Entrega",    color: "text-blue-400",   bg: "bg-blue-900/30 border-blue-800",   Icon: TrendingDown,  signo: "-" },
  devolucion: { label: "Devolución", color: "text-green-400",  bg: "bg-green-900/30 border-green-800", Icon: RotateCcw,     signo: "+" },
  ajuste:     { label: "Ajuste",     color: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-800", Icon: SlidersHorizontal, signo: "" },
  compra:     { label: "Compra",     color: "text-purple-400", bg: "bg-purple-900/30 border-purple-800", Icon: ShoppingCart, signo: "+" },
  perdida:    { label: "Pérdida",    color: "text-red-400",    bg: "bg-red-900/30 border-red-800",     Icon: TrendingUp,    signo: "-" },
};

const TIPO_MOVIMIENTO_KEYS = ["entrega", "devolucion", "ajuste", "compra", "perdida"] as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export function Inventory() {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<InventoryLog[]>(
    "inventory-logs",
    () => api.get("/inventory/logs").then((r) => r.data)
  );

  // Estadísticas por tipo
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      counts[log.tipo_movimiento] = (counts[log.tipo_movimiento] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  // Filtrado
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((log) => {
      if (filterTipo !== "all" && log.tipo_movimiento !== filterTipo) return false;
      if (!q) return true;
      return (
        log.asset_nombre?.toLowerCase().includes(q) ||
        log.asset_uid?.toLowerCase().includes(q) ||
        log.user_nombre?.toLowerCase().includes(q) ||
        log.operario_nombre?.toLowerCase().includes(q) ||
        log.observaciones?.toLowerCase().includes(q) ||
        String(log.asset_id).includes(q)
      );
    });
  }, [logs, search, filterTipo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <ClipboardList size={22} className="animate-pulse" />
        <span>Cargando movimientos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <ClipboardList size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Movimientos de Inventario</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {logs.length} registro{logs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TIPO_MOVIMIENTO_KEYS.map((tipo) => {
          const m = MOVIMIENTO[tipo];
          return (
            <button
              key={tipo}
              onClick={() => setFilterTipo(filterTipo === tipo ? "all" : tipo)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                filterTipo === tipo
                  ? `${m.bg} ${m.color} border-opacity-100 ring-1 ring-inset ring-current`
                  : "bg-gray-800 border-gray-700 hover:border-gray-600"
              }`}
            >
              <p className={`text-xs font-medium ${filterTipo === tipo ? m.color : "text-gray-400"}`}>
                {m.label}
              </p>
              <p className="text-xl font-bold mt-0.5">{stats[tipo] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Barra de búsqueda y filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por activo, usuario, observación..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        {filterTipo !== "all" && (
          <button
            onClick={() => setFilterTipo("all")}
            className="text-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Lista de logs */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <ClipboardList size={40} className="text-gray-700" />
          <p className="text-sm font-medium">
            {logs.length === 0 ? "Sin movimientos registrados" : "Sin resultados para este filtro"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de log ───────────────────────────────────────────────────────────

function LogCard({ log }: { log: InventoryLog }) {
  const [open, setOpen] = useState(false);

  const m = MOVIMIENTO[log.tipo_movimiento] ?? {
    label: log.tipo_movimiento,
    color: "text-gray-400",
    bg: "bg-gray-800 border-gray-700",
    Icon: ClipboardList,
    signo: "",
  };

  const fecha = new Date(log.fecha_hora);
  const assetLabel = log.asset_nombre ?? `Activo #${log.asset_id}`;
  const cantidadStr = `${m.signo}${log.cantidad}`;
  const isNegative = m.signo === "-";

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Fila principal — siempre visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700/40 transition-colors"
      >
        {/* Tipo badge */}
        <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${m.bg} ${m.color}`}>
          {m.label}
        </span>

        {/* Activo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {log.asset_tipo === "consumible" ? (
              <Package size={13} className={`flex-shrink-0 ${familyColor(log.asset_color ?? "blue").icon}`} />
            ) : (
              <Wrench size={13} className={`flex-shrink-0 ${familyColor(log.asset_color ?? "blue").icon}`} />
            )}
            <p className="text-sm text-white font-medium truncate">{assetLabel}</p>
            <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border hidden sm:block ${familyColor(log.asset_color ?? "blue").badge}`}>
              {log.asset_tipo === "consumible" ? "Consumible" : "Prestable"}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {fecha.toLocaleString("es-CL", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {log.operario_nombre && (
            <p className="text-xs text-gray-400 truncate">
              Operario: <span className="text-white font-medium">{log.operario_nombre}</span>
            </p>
          )}
        </div>

        {/* Cantidad */}
        <span className={`flex-shrink-0 text-lg font-bold ${isNegative ? "text-red-400" : "text-green-400"}`}>
          {cantidadStr}
        </span>

        {/* Expand */}
        <span className="flex-shrink-0 text-gray-600">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-gray-700 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-400">
          <Detail label="ID movimiento" value={`#${log.id}`} />
          <Detail label="Asset ID" value={`#${log.asset_id}`} />
          {log.asset_uid && <Detail label="UID físico" value={log.asset_uid} mono />}
          {log.asset_tipo && <Detail label="Tipo activo" value={log.asset_tipo} />}
          {log.user_nombre && <Detail label="Registrado por" value={log.user_nombre} />}
          {log.operario_nombre && <Detail label="Operario" value={log.operario_nombre} />}
          <Detail
            label="Fecha y hora"
            value={fecha.toLocaleString("es-CL", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          {log.observaciones && (
            <div className="sm:col-span-2">
              <span className="font-medium text-gray-500">Observaciones: </span>
              <span className="text-gray-300">{log.observaciones}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="font-medium text-gray-500">{label}: </span>
      <span className={`text-gray-300 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
