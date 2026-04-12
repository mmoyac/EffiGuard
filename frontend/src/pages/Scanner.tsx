import { useCallback, useRef, useState } from "react";
import { ScanLine, X, CheckCircle, AlertCircle, Keyboard, Camera } from "lucide-react";
import { useHIDScanner } from "../hooks/useHIDScanner";
import { ScanResult } from "../components/scanner/ScanResult";
import { LoanModal } from "../components/scanner/LoanModal";
import { ConsumableModal } from "../components/scanner/ConsumableModal";
import { CameraScanner } from "../components/scanner/CameraScanner";
import { LossModal } from "../components/scanner/LossModal";
import { AdjustModal } from "../components/scanner/AdjustModal";
import { assetsApi, loansApi } from "../services/api";
import type { Asset, Loan } from "../types";

type ModalType = "loan" | "return" | "consumable" | "kit" | "loss" | "adjust" | null;

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export function Scanner() {
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);
  const [kitChildren, setKitChildren] = useState<Asset[]>([]);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFeedback(type: "success" | "error", message: string) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ type, message });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
  }

  function resetScan() {
    setScannedAsset(null);
    setKitChildren([]);
    setActiveLoan(null);
    setModal(null);
  }

  const handleScan = useCallback(async (uid: string) => {
    if (loading) return;
    resetScan();
    setLoading(true);
    try {
      const { data: asset } = await assetsApi.scan(uid);

      // Si es kit padre (tiene hijos dentro), separarlos
      const children: Asset[] = asset.children ?? [];
      setScannedAsset(asset);
      setKitChildren(children);

      // Consultar préstamo activo para herramientas
      if (asset.tipo === "herramienta") {
        const { data: loan } = await loansApi.activeByAsset(asset.id);
        setActiveLoan(loan ?? null);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showFeedback("error", msg ?? "Activo no encontrado");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Captura de lector HID externo
  useHIDScanner({ onScan: handleScan });

  // Input manual (también útil en tests sin lector)
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uid = manualUid.trim();
    if (uid) {
      setManualUid("");
      handleScan(uid);
    }
  }

  // --- Acciones ---

  async function handleLoanConfirm(userId: number, projectId: number | null) {
    if (!scannedAsset) return;
    await loansApi.create({
      asset_id: scannedAsset.id,
      user_id: userId,
      project_id: projectId,
    });
    setModal(null);
    showFeedback("success", "Préstamo registrado correctamente");
    resetScan();
  }

  async function handleReturnConfirm() {
    if (!activeLoan) return;
    await loansApi.return(activeLoan.id);
    setModal(null);
    showFeedback("success", "Devolución registrada correctamente");
    resetScan();
  }

  async function handleConsumableConfirm(cantidad: number, observaciones: string, operarioId: number) {
    if (!scannedAsset) return;
    await loansApi.withdrawConsumable({
      asset_id: scannedAsset.id,
      cantidad,
      operario_id: operarioId,
      observaciones: observaciones || undefined,
    });
    setModal(null);
    showFeedback("success", `${cantidad} unidades retiradas correctamente`);
    resetScan();
  }

  async function handleLossConfirm(cantidad: number, observaciones: string) {
    if (!scannedAsset) return;
    await assetsApi.reportLoss(scannedAsset.id, { cantidad, observaciones: observaciones || undefined });
    setModal(null);
    const msg = scannedAsset.tipo === "herramienta"
      ? "Herramienta marcada como perdida/robada"
      : `${cantidad} unidades registradas como pérdida`;
    showFeedback("success", msg);
    resetScan();
  }

  async function handleAdjustConfirm(stockNuevo: number, observaciones: string) {
    if (!scannedAsset) return;
    await assetsApi.adjustStock(scannedAsset.id, { stock_nuevo: stockNuevo, observaciones: observaciones || undefined });
    setModal(null);
    showFeedback("success", `Stock ajustado a ${stockNuevo} unidades`);
    resetScan();
  }

  function handleAction(type: "loan" | "return" | "consumable" | "kit" | "unavailable" | "loss" | "adjust") {
    if (type === "unavailable") return;
    if (type === "return") {
      handleReturnConfirm();
      return;
    }
    setModal(type);
  }

  return (
    <div className="min-h-full flex flex-col gap-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScanLine size={28} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Escáner</h2>
        <button
          onClick={() => setCameraOpen((v) => !v)}
          className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            cameraOpen
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          <Camera size={16} />
          {cameraOpen ? "Cerrar cámara" : "Usar cámara"}
        </button>
      </div>

      {/* Cámara */}
      {cameraOpen && (
        <CameraScanner
          active={cameraOpen}
          onScan={(uid) => {
            setCameraOpen(false);
            handleScan(uid);
          }}
        />
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-green-900/30 border-green-800 text-green-300"
              : "bg-red-900/30 border-red-800 text-red-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {feedback.message}
        </div>
      )}

      {/* Zona de escaneo / resultado */}
      {loading ? (
        <ScanPlaceholder loading />
      ) : scannedAsset ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Activo identificado</p>
            <button
              onClick={resetScan}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors px-3 py-2 min-h-[48px]"
            >
              <X size={14} /> Limpiar
            </button>
          </div>
          <ScanResult
            asset={scannedAsset}
            kitChildren={kitChildren}
            activeLoan={activeLoan}
            onAction={handleAction}
          />
        </div>
      ) : (
        <ScanPlaceholder loading={false} />
      )}

      {/* Input manual — fallback si no hay lector físico */}
      <div className="mt-auto border-t border-gray-800 pt-4">
        <p className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <Keyboard size={14} />
          El lector RFID/QR escribe directamente. También puedes ingresar manualmente:
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            ref={manualInputRef}
            value={manualUid}
            onChange={(e) => setManualUid(e.target.value)}
            placeholder="UID del activo..."
            className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
          />
          <button
            type="submit"
            disabled={!manualUid.trim()}
            className="px-5 min-h-[48px] bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Modales */}
      {(modal === "loan" || modal === "kit") && scannedAsset && (
        <LoanModal
          asset={scannedAsset}
          kitChildren={modal === "kit" ? kitChildren : []}
          onConfirm={handleLoanConfirm}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "consumable" && scannedAsset && (
        <ConsumableModal
          asset={scannedAsset}
          onConfirm={handleConsumableConfirm}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "loss" && scannedAsset && (
        <LossModal
          asset={scannedAsset}
          onConfirm={handleLossConfirm}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "adjust" && scannedAsset && (
        <AdjustModal
          asset={scannedAsset}
          onConfirm={handleAdjustConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ScanPlaceholder({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-16 gap-4 text-gray-500">
      <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center ${loading ? "border-blue-500 animate-pulse" : "border-gray-700"}`}>
        <ScanLine size={36} className={loading ? "text-blue-400" : "text-gray-600"} />
      </div>
      <p className="text-sm font-medium">
        {loading ? "Identificando activo..." : "Esperando escaneo"}
      </p>
      {!loading && (
        <p className="text-xs text-center max-w-48">
          Escanea un QR o acerca un tag RFID para comenzar
        </p>
      )}
    </div>
  );
}
