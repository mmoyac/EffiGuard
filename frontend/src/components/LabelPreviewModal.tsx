import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Printer } from "lucide-react";
import { printLabel } from "../utils/printLabel";

interface Props {
  title: string;
  subtitle?: string;
  uid: string;
  onClose: () => void;
}

export function LabelPreviewModal({ title, subtitle, uid, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(uid, {
      errorCorrectionLevel: "M",
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [uid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Vista previa</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Label preview */}
        <div className="flex justify-center">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-5 w-56 text-center shadow-sm">
            <p className="text-[9px] text-gray-400 tracking-[3px] uppercase mb-3">EffiGuard</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">{title}</p>
            {subtitle && <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>}
            <div className="my-3 flex justify-center">
              {qrDataUrl
                ? <img src={qrDataUrl} alt={`QR ${uid}`} className="w-36 h-36" />
                : <div className="w-36 h-36 bg-gray-100 rounded animate-pulse" />
              }
            </div>
            <p className="text-[9px] text-gray-400 font-mono tracking-wide">{uid}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { printLabel({ title, subtitle, uid }); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
          >
            <Printer size={16} />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
