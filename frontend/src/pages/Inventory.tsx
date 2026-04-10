import { useQuery } from "react-query";
import { ClipboardList } from "lucide-react";
import { api } from "../services/api";
import type { InventoryLog } from "../types";

const MOVIMIENTO: Record<string, { label: string; color: string }> = {
  entrega:   { label: "Entrega",    color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  devolucion:{ label: "Devolución", color: "text-green-400 bg-green-900/30 border-green-800" },
  ajuste:    { label: "Ajuste",     color: "text-yellow-400 bg-yellow-900/30 border-yellow-800" },
  compra:    { label: "Compra",     color: "text-purple-400 bg-purple-900/30 border-purple-800" },
  perdida:   { label: "Pérdida",    color: "text-red-400 bg-red-900/30 border-red-800" },
};

export function Inventory() {
  const { data: logs = [], isLoading } = useQuery<InventoryLog[]>("inventory-logs", () =>
    api.get("/inventory/logs").then((r) => r.data)
  );

  if (isLoading) return <p className="text-gray-400 p-4">Cargando movimientos...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Movimientos</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {logs.length} registro{logs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <ClipboardList size={40} className="text-gray-700" />
          <p className="text-sm font-medium">Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => <LogCard key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

function LogCard({ log }: { log: InventoryLog }) {
  const tipo = MOVIMIENTO[log.tipo_movimiento] ?? {
    label: log.tipo_movimiento,
    color: "text-gray-400 bg-gray-800 border-gray-700",
  };

  const fecha = new Date(log.fecha_hora);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center gap-3 min-w-0">
      {/* Tipo badge */}
      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${tipo.color}`}>
        {tipo.label}
      </span>

      {/* Info central */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono truncate">Activo #{log.asset_id}</p>
        <p className="text-xs text-gray-500 truncate">
          {fecha.toLocaleString("es-CL", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>

      {/* Cantidad */}
      <span className="flex-shrink-0 text-lg font-bold text-white">
        {log.tipo_movimiento === "entrega" || log.tipo_movimiento === "perdida" ? "-" : "+"}{log.cantidad}
      </span>
    </div>
  );
}
