import { useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { X, Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet, Loader2 } from "lucide-react";
import { assetsApi } from "../../services/api";

interface ImportError {
  fila: number;
  motivo: string;
}

interface ImportResult {
  dry_run: boolean;
  creados: number;
  actualizados: number;
  validados_crear: number;
  validados_actualizar: number;
  errores: ImportError[];
}

interface Props {
  onClose: () => void;
}

type Step = "upload" | "preview" | "done";

export function ImportAssetsModal({ onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownloadTemplate() {
    try {
      const res = await assetsApi.importTemplate();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_activos.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el template");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx") && !f.name.toLowerCase().endsWith(".xls")) {
      setError("Solo se aceptan archivos .xlsx");
      return;
    }
    setFile(f);
    setError("");
  }

  async function handleValidate() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await assetsApi.importValidate(file);
      setResult(res.data);
      setStep("preview");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error al validar el archivo");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await assetsApi.importConfirm(file);
      setResult(res.data);
      qc.invalidateQueries("assets");
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error al importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={20} className="text-green-400" />
            <h3 className="font-semibold text-white">Importar activos desde Excel</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* STEP: upload */}
          {step === "upload" && (
            <>
              {/* Paso 1: descargar template */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-200">1. Descarga el template</p>
                <p className="text-xs text-gray-400">
                  Completa el archivo con tus activos. El campo <span className="text-gray-200 font-medium">familia</span> debe
                  coincidir con las familias ya creadas en el sistema. Si dejas <span className="text-gray-200 font-medium">uid_fisico</span> vacío,
                  el sistema genera un código automático.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors mt-1"
                >
                  <Download size={15} />
                  Descargar template_activos.xlsx
                </button>
              </div>

              {/* Paso 2: subir archivo */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-gray-200">2. Sube el archivo completado</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <FileSpreadsheet size={20} />
                      <span className="text-sm font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload size={24} className="mx-auto text-gray-500" />
                      <p className="text-sm text-gray-400">Haz clic para seleccionar el archivo</p>
                      <p className="text-xs text-gray-600">.xlsx</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <button
                onClick={handleValidate}
                disabled={!file || loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Validar archivo
              </button>
            </>
          )}

          {/* STEP: preview (dry_run result) */}
          {step === "preview" && result && (
            <>
              <div className={`rounded-xl p-4 border ${result.errores.length === 0 ? "bg-green-900/20 border-green-700" : "bg-yellow-900/20 border-yellow-700"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.errores.length === 0
                    ? <CheckCircle size={18} className="text-green-400" />
                    : <AlertCircle size={18} className="text-yellow-400" />
                  }
                  <span className="font-semibold text-sm text-white">Resultado de validación</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-black/20 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-green-400">{result.validados_crear}</p>
                    <p className="text-xs text-gray-400 mt-0.5">a crear</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-blue-400">{result.validados_actualizar}</p>
                    <p className="text-xs text-gray-400 mt-0.5">a actualizar</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-red-400">{result.errores.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">con errores</p>
                  </div>
                </div>
              </div>

              {result.errores.length > 0 && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 border-b border-gray-700">
                    Errores encontrados
                  </p>
                  <ul className="divide-y divide-gray-700/50 max-h-44 overflow-y-auto">
                    {result.errores.map((e, i) => (
                      <li key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                        <span className="text-xs text-gray-500 mt-0.5 shrink-0">Fila {e.fila}</span>
                        <span className="text-xs text-red-300">{e.motivo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep("upload"); setResult(null); setFile(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={(result.validados_crear + result.validados_actualizar) === 0 || loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Confirmar {result.validados_crear + result.validados_actualizar} activos
                </button>
              </div>
            </>
          )}

          {/* STEP: done */}
          {step === "done" && result && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle size={48} className="mx-auto text-green-400" />
              <div className="space-y-1">
                {result.creados > 0 && (
                  <p className="text-lg font-bold text-green-400">{result.creados} activos creados</p>
                )}
                {result.actualizados > 0 && (
                  <p className="text-lg font-bold text-blue-400">{result.actualizados} activos actualizados</p>
                )}
                {result.errores.length > 0 && (
                  <p className="text-sm text-yellow-400 mt-1">
                    {result.errores.length} filas omitidas por errores
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
