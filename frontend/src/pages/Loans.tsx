import { useQuery } from "react-query";
import { ArrowLeftRight, User, FolderOpen, Clock } from "lucide-react";
import { loansApi } from "../services/api";
import type { Loan } from "../types";

export function Loans() {
  const { data: loans = [], isLoading } = useQuery<Loan[]>("loans-active", () =>
    loansApi.list(true).then((r) => r.data)
  );

  if (isLoading) return <p className="text-gray-400 p-4">Cargando préstamos...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ArrowLeftRight size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Préstamos Activos</h2>
        {loans.length > 0 && (
          <span className="text-xs font-bold text-blue-400 bg-blue-900/30 border border-blue-800 px-2.5 py-1 rounded-full">
            {loans.length}
          </span>
        )}
      </div>

      {loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <ArrowLeftRight size={40} className="text-gray-700" />
          <p className="text-sm font-medium">Sin préstamos activos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
        </div>
      )}
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const entrega = new Date(loan.fecha_entrega);
  const ahora = new Date();
  const dias = Math.floor((ahora.getTime() - entrega.getTime()) / (1000 * 60 * 60 * 24));
  const vencida = loan.fecha_devolucion_prevista && new Date(loan.fecha_devolucion_prevista) < ahora;

  return (
    <div className={`bg-gray-800 rounded-2xl border p-4 space-y-3 ${vencida ? "border-red-800" : "border-gray-700"}`}>
      {vencida && (
        <p className="text-xs text-red-400 font-semibold bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-800">
          ⚠ Devolución vencida
        </p>
      )}

      {/* Activo */}
      <div className="flex items-center gap-2 min-w-0">
        <ArrowLeftRight size={15} className="text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {loan.asset_nombre && (
            <p className="text-sm text-white font-semibold truncate">{loan.asset_nombre}</p>
          )}
          <p className="font-mono text-xs text-gray-400 truncate">
            {loan.asset_uid_fisico ?? `Activo #${loan.asset_id}`}
          </p>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">· #{loan.id}</span>
      </div>

      {/* Operario */}
      {loan.user_nombre ? (
        <div className="flex items-center gap-2 min-w-0">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-white truncate">{loan.user_nombre}</span>
          {loan.user_rut && <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">· {loan.user_rut}</span>}
        </div>
      ) : null}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-700/50 rounded-xl px-3 py-2">
          <p className="text-xs text-gray-400 mb-0.5">Entregado</p>
          <p className="text-xs text-white font-medium">
            {entrega.toLocaleDateString("es-CL")}
          </p>
          <p className="text-xs text-gray-500">
            {dias === 0 ? "hoy" : `hace ${dias} día${dias !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className={`rounded-xl px-3 py-2 ${vencida ? "bg-red-900/20" : "bg-gray-700/50"}`}>
          <p className="text-xs text-gray-400 mb-0.5">Devolver antes de</p>
          <p className={`text-xs font-medium ${vencida ? "text-red-400" : "text-white"}`}>
            {loan.fecha_devolucion_prevista
              ? new Date(loan.fecha_devolucion_prevista).toLocaleDateString("es-CL")
              : "Sin límite"}
          </p>
        </div>
      </div>

      {/* Proyecto y bodeguero */}
      <div className="flex flex-wrap gap-2">
        {loan.proyecto_nombre && (
          <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-900/20 border border-blue-800/50 px-2.5 py-1 rounded-full">
            <FolderOpen size={12} />
            <span className="truncate max-w-[140px]">{loan.proyecto_nombre}</span>
          </div>
        )}
        {loan.bodeguero_nombre && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700/50 px-2.5 py-1 rounded-full">
            <Clock size={12} />
            <span className="truncate max-w-[140px]">{loan.bodeguero_nombre}</span>
          </div>
        )}
      </div>
    </div>
  );
}
