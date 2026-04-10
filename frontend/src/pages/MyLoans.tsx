import { useQuery } from "react-query";
import { ClipboardCheck, Package, FolderOpen, Clock } from "lucide-react";
import { api } from "../services/api";
import type { Loan } from "../types";

export function MyLoans() {
  const { data: loans = [], isLoading } = useQuery<Loan[]>("my-loans", () =>
    api.get("/loans/my").then((r) => r.data)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardCheck size={26} className="text-green-400" />
        <h2 className="text-2xl font-bold">Mis Préstamos</h2>
        {loans.length > 0 && (
          <span className="bg-green-900/40 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-800">
            {loans.length} activo{loans.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-3 text-gray-500">
          <ClipboardCheck size={40} className="text-gray-700" />
          <p className="text-sm font-medium">No tienes herramientas en tu poder</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>
      )}
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const entrega = new Date(loan.fecha_entrega);
  const ahora = new Date();
  const diasTranscurridos = Math.floor((ahora.getTime() - entrega.getTime()) / (1000 * 60 * 60 * 24));
  const vencida = loan.fecha_devolucion_prevista && new Date(loan.fecha_devolucion_prevista) < ahora;

  return (
    <div className={`bg-gray-800 rounded-2xl border p-4 space-y-3 ${vencida ? "border-red-800" : "border-gray-700"}`}>
      {vencida && (
        <div className="text-xs text-red-400 font-semibold bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-800">
          ⚠ Devolución vencida
        </div>
      )}

      {/* UID del activo */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <Package size={20} className="text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm text-white font-semibold truncate">
            {loan.asset_uid_fisico ?? `#${loan.asset_id}`}
          </p>
          <p className="text-xs text-gray-500">En tu poder</p>
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-700/50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-400 mb-0.5">Recibido</p>
          <p className="text-sm font-medium text-white">
            {entrega.toLocaleString("es-CL", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            hace {diasTranscurridos === 0 ? "hoy" : `${diasTranscurridos} día${diasTranscurridos !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className={`rounded-xl px-3 py-2.5 ${vencida ? "bg-red-900/20" : "bg-gray-700/50"}`}>
          <p className="text-xs text-gray-400 mb-0.5">Devolver antes de</p>
          {loan.fecha_devolucion_prevista ? (
            <p className={`text-sm font-medium ${vencida ? "text-red-400" : "text-white"}`}>
              {new Date(loan.fecha_devolucion_prevista).toLocaleDateString("es-CL")}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Sin fecha límite</p>
          )}
        </div>
      </div>

      {/* Proyecto */}
      {loan.proyecto_nombre && (
        <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-900/20 px-3 py-2 rounded-xl border border-blue-800/50">
          <FolderOpen size={15} className="flex-shrink-0" />
          {loan.proyecto_nombre}
        </div>
      )}

      {/* Entregó */}
      {loan.bodeguero_nombre && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={13} className="flex-shrink-0" />
          Entregado por <span className="text-gray-300 font-medium">{loan.bodeguero_nombre}</span>
        </div>
      )}
    </div>
  );
}
