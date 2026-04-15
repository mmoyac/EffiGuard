import { Package, Layers, ArrowLeftRight, RotateCcw, AlertTriangle, User, FolderOpen, SlidersHorizontal } from "lucide-react";
import type { Asset, Loan } from "../../types";
import { familyColor } from "../../utils/familyColors";

type ActionType = "loan" | "return" | "consumable" | "kit" | "unavailable" | "loss" | "adjust";

interface Props {
  asset: Asset;
  kitChildren?: Asset[];
  activeLoan: Loan | null;
  onAction: (type: ActionType) => void;
}

const STATE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Disponible", color: "text-green-400 bg-green-900/30 border-green-800" },
  2: { label: "En Terreno", color: "text-blue-400 bg-blue-900/30 border-blue-800" },
  3: { label: "En Reparación", color: "text-yellow-400 bg-yellow-900/30 border-yellow-800" },
  4: { label: "Robado", color: "text-red-400 bg-red-900/30 border-red-800" },
};

export function ScanResult({ asset, kitChildren = [], activeLoan, onAction }: Props) {
  const isKit = kitChildren.length > 0;
  const isConsumable = asset.family.comportamiento === "consumible";
  const isAvailable = asset.estado_id === 1;
  const isOnField = asset.estado_id === 2;
  const lowStock = asset.stock_actual <= asset.stock_minimo;
  const state = STATE_LABELS[asset.estado_id] ?? { label: "Desconocido", color: "text-gray-400 bg-gray-800 border-gray-700" };

  function resolveAction(): ActionType {
    if (!isAvailable && !isOnField) return "unavailable";
    if (isConsumable) return "consumable";
    if (activeLoan) return "return";
    if (isKit) return "kit";
    return "loan";
  }

  const action = resolveAction();

  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Tarjeta activo */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        {/* Estado badge */}
        <div className={`flex items-center gap-2 px-5 py-3 border-b ${state.color}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          <span className="text-sm font-semibold">{state.label}</span>
          {isKit && <span className="ml-auto text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800">KIT</span>}
          {isConsumable && <span className="ml-auto text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded-full border border-orange-800">{asset.family.nombre.toUpperCase()}</span>}
        </div>

        {/* Info principal */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
              {isConsumable
                ? <Layers size={24} className={familyColor(asset.family.color).icon} />
                : <Package size={24} className={familyColor(asset.family.color).icon} />}
            </div>
            <div className="flex-1 min-w-0">
              {asset.nombre && (
                <p className="text-base font-semibold text-white truncate">{asset.nombre}</p>
              )}
              <p className="font-mono text-sm text-gray-400 truncate">{asset.uid_fisico}</p>
            </div>
          </div>

          {/* Stock (solo consumibles) */}
          {isConsumable && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${lowStock ? "bg-yellow-900/30 border border-yellow-800" : "bg-gray-700/50"}`}>
              <div className="flex items-center gap-2">
                {lowStock && <AlertTriangle size={16} className="text-yellow-400" />}
                <span className="text-sm text-gray-300">Stock actual</span>
              </div>
              <span className={`text-2xl font-bold ${lowStock ? "text-yellow-400" : "text-green-400"}`}>
                {asset.stock_actual}
              </span>
            </div>
          )}

          {/* Préstamo activo (solo herramientas en terreno) */}
          {activeLoan && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-3 text-sm space-y-2">
              <p className="text-blue-300 font-semibold">Préstamo activo</p>
              {activeLoan.user_nombre && (
                <div className="flex items-center gap-2">
                  <User size={14} className="text-blue-400 flex-shrink-0" />
                  <span className="text-white font-medium">{activeLoan.user_nombre}</span>
                  {activeLoan.user_rut && (
                    <span className="text-gray-400 text-xs">· {activeLoan.user_rut}</span>
                  )}
                </div>
              )}
              <div className="text-gray-400 text-xs space-y-0.5">
                <p>
                  Entregado el{" "}
                  {new Date(activeLoan.fecha_entrega).toLocaleString("es-CL", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                {activeLoan.fecha_devolucion_prevista && (
                  <p>Devolver antes del {new Date(activeLoan.fecha_devolucion_prevista).toLocaleDateString("es-CL")}</p>
                )}
                {activeLoan.bodeguero_nombre && (
                  <p>Entregó: {activeLoan.bodeguero_nombre}</p>
                )}
              </div>
              {activeLoan.proyecto_nombre && (
                <div className="flex items-center gap-2 pt-1 border-t border-blue-800/50">
                  <FolderOpen size={13} className="text-blue-400 flex-shrink-0" />
                  <span className="text-blue-300 text-xs font-medium">{activeLoan.proyecto_nombre}</span>
                </div>
              )}
            </div>
          )}

          {/* Items del kit */}
          {isKit && (
            <div className="bg-purple-900/20 border border-purple-800 rounded-xl px-4 py-3">
              <p className="text-purple-300 text-sm font-medium mb-2">Ítems del kit ({kitChildren.length + 1})</p>
              <ul className="space-y-1">
                {kitChildren.map((c) => (
                  <li key={c.id} className="text-xs text-gray-400 font-mono">▸ {c.uid_fisico}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Botón de acción principal */}
      <ActionButton action={action as PrimaryAction} activeLoan={activeLoan} onAction={onAction} />

      {/* Acciones secundarias */}
      <div className="flex gap-2">
        {asset.estado_id !== 4 && (
          <button
            onClick={() => onAction("loss")}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-800 text-gray-400 hover:text-red-400 text-sm font-medium rounded-xl py-3 transition-colors"
          >
            <AlertTriangle size={15} />
            Reportar pérdida
          </button>
        )}
        {isConsumable && (
          <button
            onClick={() => onAction("adjust")}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-blue-900/30 border border-gray-700 hover:border-blue-800 text-gray-400 hover:text-blue-400 text-sm font-medium rounded-xl py-3 transition-colors"
          >
            <SlidersHorizontal size={15} />
            Ajustar stock
          </button>
        )}
      </div>
    </div>
  );
}

type PrimaryAction = "loan" | "return" | "consumable" | "kit" | "unavailable";

function ActionButton({
  action, activeLoan: _activeLoan, onAction,
}: {
  action: PrimaryAction;
  activeLoan: Loan | null;
  onAction: (type: ActionType) => void;
}) {
  if (action === "unavailable") {
    return (
      <div className="w-full flex items-center justify-center gap-2 bg-gray-700 text-gray-400 font-semibold rounded-2xl px-6 py-4 min-h-[64px] cursor-not-allowed">
        <AlertTriangle size={20} />
        No disponible para operar
      </div>
    );
  }

  const configs: Record<Exclude<PrimaryAction, "unavailable">, { label: string; icon: React.ReactNode; color: string }> = {
    loan: {
      label: "Registrar Préstamo",
      icon: <ArrowLeftRight size={22} />,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    kit: {
      label: "Prestar Kit Completo",
      icon: <ArrowLeftRight size={22} />,
      color: "bg-purple-600 hover:bg-purple-700",
    },
    return: {
      label: "Registrar Devolución",
      icon: <RotateCcw size={22} />,
      color: "bg-green-600 hover:bg-green-700",
    },
    consumable: {
      label: "Retirar Consumible",
      icon: <Layers size={22} />,
      color: "bg-orange-600 hover:bg-orange-700",
    },
  };

  const cfg = configs[action];

  return (
    <button
      onClick={() => onAction(action)}
      className={`w-full flex items-center justify-center gap-3 ${cfg.color} text-white font-bold rounded-2xl px-6 py-4 min-h-[64px] text-lg transition-colors active:scale-95`}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}
