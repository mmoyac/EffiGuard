import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { AlertTriangle, Camera, HardHat, Keyboard, Layers, Link2 as LinkIcon, PackageCheck, ScanLine, Trash2, Undo2, Wifi, Wrench, X } from "lucide-react";
import { useHIDScanner } from "../hooks/useHIDScanner";
import { CameraScanner } from "../components/scanner/CameraScanner";
import { NFCScanner } from "../components/scanner/NFCScanner";
import { TenantGuard } from "../components/layout/TenantGuard";
import { ModalDescuento } from "../components/catalogo/ModalDescuento";
import { ModalEntrega } from "../components/catalogo/ModalEntrega";
import { ModalReintegro } from "../components/catalogo/ModalReintegro";
import { ModalPrestamo } from "../components/catalogo/ModalPrestamo";
import { ModalDevolucion } from "../components/catalogo/ModalDevolucion";
import { ModalAsociarCodigo } from "../components/catalogo/ModalAsociarCodigo";
import {
  BTN,
  INPUT,
  TIPO_ESTILO,
  mensajeError,
  type Codigo,
  type Unidad,
  type Variante,
} from "../components/catalogo/shared";
import { catalogoApi, loansApi } from "../services/api";

type Accion = "entrega" | "merma" | "perdida" | "reintegro" | "prestamo" | "devolucion" | null;

type PrestamoActivo = {
  id: number;
  user_id: number;
  user_nombre: string;
  bodeguero_nombre: string;
  proyecto_nombre: string | null;
  fecha_entrega: string;
  fecha_devolucion_prevista: string | null;
  modalidad: "plazo" | "a_cargo";
  asset_nombre: string | null;
  asset_uid_fisico: string | null;
};

type Resolucion = {
  resolvio: "variante" | "unidad";
  codigo: Codigo;
  variante: Variante;
  unidad?: Unidad;
  factor?: number;
};

const ESTADOS: Record<number, { label: string; clase: string }> = {
  1: { label: "Disponible", clase: "bg-green-500/15 text-green-300" },
  2: { label: "En Terreno", clase: "bg-orange-500/15 text-orange-300" },
  3: { label: "En Reparación", clase: "bg-yellow-500/15 text-yellow-300" },
  4: { label: "Robado", clase: "bg-red-500/15 text-red-300" },
};

export function EscanearCatalogo() {
  const qc = useQueryClient();
  const [r, setR] = useState<Resolucion | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [manual, setManual] = useState("");
  // El código del último escaneo que dio 404, para poder ofrecer asociarlo
  const [sinResolver, setSinResolver] = useState("");
  const [asociando, setAsociando] = useState(false);
  const [camara, setCamara] = useState(false);
  const [nfc, setNfc] = useState(false);
  const [modal, setModal] = useState<Accion>(null);

  // Cuántas entregas admiten reintegro: define si se ofrece el botón
  const { data: despachos = [] } = useQuery<unknown[]>(
    ["despachos-pendientes", r?.variante.id],
    () => catalogoApi.despachosPendientes(r!.variante.id).then((res) => res.data),
    { enabled: !!r && r.variante.comportamiento === "consumible" }
  );
  const despachosAbiertos = despachos.length;

  // Quién tiene el ejemplar ahora mismo: decide si la acción es prestar o devolver
  const { data: prestamoActivo } = useQuery<PrestamoActivo | null>(
    ["prestamo-activo", r?.unidad?.id],
    () => loansApi.activeByUnidad(r!.unidad!.id).then((res) => res.data),
    { enabled: !!r?.unidad }
  );

  function trasOperar() {
    qc.invalidateQueries("productos");
    qc.invalidateQueries(["prestamo-activo", r?.unidad?.id]);
    if (r) resolver(r.codigo.codigo);
  }

  const repararListo = useMutation(
    (unidadId: number) => catalogoApi.repairDone(unidadId, {}),
    { onSuccess: trasOperar, onError: (e) => setError(mensajeError(e, "No se pudo cerrar la reparación")) }
  );

  const reingresar = useMutation(
    (unidadId: number) => catalogoApi.reingresoUnidad(unidadId, {}),
    { onSuccess: trasOperar, onError: (e) => setError(mensajeError(e, "No se pudo reingresar")) }
  );

  const perderUnidad = useMutation(
    (unidadId: number) => catalogoApi.lossUnidad(unidadId, {}),
    { onSuccess: trasOperar, onError: (e) => setError(mensajeError(e, "No se pudo reportar la pérdida")) }
  );

  const resolver = useCallback(
    async (codigo: string) => {
      if (!codigo.trim() || cargando) return; // Serialización: el lector dispara dos veces
      setCargando(true);
      setError("");
      setR(null);
      setSinResolver("");
      try {
        const res = await catalogoApi.scan(codigo.trim());
        setR(res.data);
      } catch (e: any) {
        setError(mensajeError(e, "Código no encontrado"));
        // Un 404 es un código que existe en el mundo físico y no en el catálogo:
        // se ofrece asociarlo en vez de limpiar y dejar al bodeguero sin salida.
        // Cualquier otro error sí se desvanece — no hay nada que asociar.
        if (e?.response?.status === 404) {
          setSinResolver(codigo.trim());
        } else {
          setTimeout(() => setError(""), 4000);
        }
      } finally {
        setCargando(false);
      }
    },
    [cargando]
  );

  // Lector físico que emula teclado: la ráfaga se distingue del tipeo manual
  useHIDScanner({ onScan: resolver });

  function limpiar() {
    setR(null);
    setError("");
    setManual("");
    setSinResolver("");
  }

  /** Tras operar, se vuelve a resolver el mismo código para ver el estado nuevo. */
  function cerrarYRefrescar() {
    setModal(null);
    trasOperar();
  }

  const esConsumible = r?.variante.comportamiento === "consumible";

  return (
    <TenantGuard>
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <ScanLine size={26} className="text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white">Escanear</h1>
            <p className="text-xs text-gray-400">
              Cualquier código del catálogo: propio, de proveedor, de empaque o de fábrica
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolver(manual);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              className={INPUT}
              placeholder="Escanea o escribe el código"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className={`${BTN} bg-blue-600 text-white hover:bg-blue-500`}>
              <Keyboard size={18} /> Buscar
            </button>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => setCamara(true)}
              className={`${BTN} flex-1 bg-gray-700 text-white hover:bg-gray-600`}
            >
              <Camera size={18} /> Cámara
            </button>
            <button
              onClick={() => setNfc(true)}
              className={`${BTN} flex-1 bg-gray-700 text-white hover:bg-gray-600`}
            >
              <Wifi size={18} /> NFC
            </button>
          </div>
        </div>

        {cargando && <p className="text-sm text-gray-400">Resolviendo…</p>}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300 min-w-0 break-all">{error}</p>
            </div>
            {/* El código existe en la caja aunque no en el catálogo: se ofrece
                asociarlo acá mismo en vez de mandar al bodeguero al mantenedor
                con el operario esperando en el mesón. */}
            {sinResolver && (
              <>
                <p className="text-xs text-gray-400 font-mono break-all">{sinResolver}</p>
                <button
                  onClick={() => setAsociando(true)}
                  className={`${BTN} w-full bg-blue-600 text-white hover:bg-blue-500`}
                >
                  <LinkIcon size={16} /> Asociar este código
                </button>
              </>
            )}
          </div>
        )}

        {r && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{r.variante.producto_nombre}</p>
                <p className="text-sm text-gray-400">{r.variante.nombre}</p>
              </div>
              <button onClick={limpiar} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-lg px-2 py-1 font-mono ${
                  TIPO_ESTILO[r.codigo.tipo] ?? "bg-gray-700 text-gray-300"
                }`}
              >
                {r.codigo.codigo} · {r.codigo.tipo}
                {r.codigo.proveedor_nombre && ` · ${r.codigo.proveedor_nombre}`}
              </span>
              {/* Qué resolvió importa: el EAN de un modelo lleva a la variante y
                  hay que elegir ejemplar; el QR pegado lleva a ese ejemplar. */}
              <span className="rounded-lg px-2 py-1 bg-gray-700 text-gray-300 inline-flex items-center gap-1">
                {r.resolvio === "unidad" ? <Wrench size={12} /> : <Layers size={12} />}
                resolvió a {r.resolvio}
              </span>
            </div>

            {esConsumible ? (
              <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm text-gray-400">Stock</span>
                <span
                  className={`text-lg font-semibold ${
                    r.variante.bajo_stock ? "text-yellow-400" : "text-white"
                  }`}
                >
                  {r.variante.stock_efectivo} {r.variante.unidad}
                  {r.variante.bajo_stock && (
                    <span className="text-xs ml-2">bajo el mínimo</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Ejemplares</span>
                  <span className="text-white font-semibold">
                    {r.variante.unidades_disponibles} de {r.variante.unidades_total} disponibles
                  </span>
                </div>
                {r.unidad && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Este ejemplar</span>
                    <span
                      className={`text-xs rounded-lg px-2 py-1 ${
                        ESTADOS[r.unidad.estado_id]?.clase ?? "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {ESTADOS[r.unidad.estado_id]?.label ?? "—"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {esConsumible ? (
              <div className="space-y-2">
                {/* Acción principal: retirar. El escaneo es para despachar, no
                    para recibir mercadería — la compra vive en Catálogo. */}
                <button
                  onClick={() => setModal("entrega")}
                  className={`${BTN} w-full bg-blue-600 text-white hover:bg-blue-500`}
                >
                  <HardHat size={18} /> Retirar consumible
                </button>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setModal("perdida")}
                    className={`${BTN} flex-1 bg-gray-700 text-gray-300 hover:bg-red-900/40 hover:text-red-300`}
                  >
                    <AlertTriangle size={16} /> Reportar pérdida
                  </button>
                  <button
                    onClick={() => setModal("merma")}
                    className={`${BTN} flex-1 bg-gray-700 text-gray-300 hover:bg-amber-900/40 hover:text-amber-300`}
                  >
                    <Trash2 size={16} /> Registrar merma
                  </button>
                </div>

                {/* Sólo si hay material despachado sin devolver: ofrecerlo siempre
                    obligaría a abrir el modal para descubrir que no hay nada. */}
                {despachosAbiertos > 0 && (
                  <button
                    onClick={() => setModal("reintegro")}
                    className={`${BTN} w-full bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 border border-cyan-800`}
                  >
                    <Undo2 size={18} /> Reintegrar sobrante ({despachosAbiertos})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Precedencia: reparación primero, después el préstamo abierto,
                    después prestar. Un estado que no opera no ofrece nada. */}
                {r.unidad?.estado_id === 3 ? (
                  <button
                    onClick={() => repararListo.mutate(r.unidad!.id)}
                    disabled={repararListo.isLoading}
                    className={`${BTN} w-full bg-yellow-600 text-white hover:bg-yellow-500`}
                  >
                    <Wrench size={18} /> Marcar como reparada
                  </button>
                ) : r.unidad && r.unidad.estado_id === 4 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
                      Reportada como perdida — no disponible para operar
                    </p>
                    {/* Reportar una pérdida no puede ser un callejón sin salida:
                        las herramientas aparecen. */}
                    <button
                      onClick={() => reingresar.mutate(r.unidad!.id)}
                      disabled={reingresar.isLoading}
                      className={`${BTN} w-full bg-emerald-700 text-white hover:bg-emerald-600`}
                    >
                      <PackageCheck size={18} /> Apareció — reingresar a bodega
                    </button>
                  </div>
                ) : prestamoActivo ? (
                  <button
                    onClick={() => setModal("devolucion")}
                    className={`${BTN} w-full bg-green-600 text-white hover:bg-green-500`}
                  >
                    <Undo2 size={18} /> Registrar devolución
                  </button>
                ) : (
                  <button
                    onClick={() => setModal("prestamo")}
                    disabled={r.variante.unidades_disponibles === 0}
                    className={`${BTN} w-full bg-blue-600 text-white hover:bg-blue-500`}
                  >
                    <HardHat size={18} />
                    {r.resolvio === "unidad"
                      ? "Registrar préstamo"
                      : `Prestar (${r.variante.unidades_disponibles} disponibles)`}
                  </button>
                )}

                {prestamoActivo && (
                  /* Cómo se entregó cambia lo que hay que leer acá: con plazo importa
                     la fecha y si ya pasó; a cargo importa quién responde. */
                  <div
                    className={`rounded-xl px-3 py-2.5 text-sm border ${
                      prestamoActivo.modalidad === "a_cargo"
                        ? "bg-purple-500/10 border-purple-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                    }`}
                  >
                    <p
                      className={
                        prestamoActivo.modalidad === "a_cargo" ? "text-purple-200" : "text-blue-200"
                      }
                    >
                      {prestamoActivo.modalidad === "a_cargo" ? "A cargo de " : "La tiene "}
                      <span className="font-semibold">{prestamoActivo.user_nombre}</span>
                    </p>
                    <p
                      className={`text-xs ${
                        prestamoActivo.modalidad === "a_cargo"
                          ? "text-purple-300/70"
                          : "text-blue-300/70"
                      }`}
                    >
                      desde {new Date(prestamoActivo.fecha_entrega).toLocaleDateString("es-CL")}
                      {prestamoActivo.proyecto_nombre && ` · ${prestamoActivo.proyecto_nombre}`}
                      {prestamoActivo.bodeguero_nombre && ` · entregó ${prestamoActivo.bodeguero_nombre}`}
                    </p>
                    {prestamoActivo.modalidad === "a_cargo" ? (
                      <p className="text-xs text-purple-300/70">sin plazo de devolución</p>
                    ) : prestamoActivo.fecha_devolucion_prevista ? (
                      <p
                        className={`text-xs ${
                          new Date(prestamoActivo.fecha_devolucion_prevista) < new Date()
                            ? "text-red-400 font-semibold"
                            : "text-blue-300/70"
                        }`}
                      >
                        {new Date(prestamoActivo.fecha_devolucion_prevista) < new Date()
                          ? "atrasada desde "
                          : "debe volver el "}
                        {new Date(prestamoActivo.fecha_devolucion_prevista).toLocaleDateString("es-CL")}
                      </p>
                    ) : null}
                  </div>
                )}

                {r.unidad && r.unidad.estado_id !== 4 && (
                  <button
                    onClick={() => perderUnidad.mutate(r.unidad!.id)}
                    disabled={perderUnidad.isLoading}
                    className={`${BTN} w-full bg-gray-700 text-gray-300 hover:bg-red-900/40 hover:text-red-300`}
                  >
                    <AlertTriangle size={16} /> Reportar pérdida
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {camara && (
          <div className="space-y-2">
            <CameraScanner
              active={camara}
              onScan={(codigo: string) => {
                setCamara(false);
                resolver(codigo);
              }}
            />
            <button onClick={() => setCamara(false)} className={`${BTN} w-full bg-gray-700 text-white`}>
              Cerrar cámara
            </button>
          </div>
        )}
        {nfc && (
          <div className="space-y-2">
            <NFCScanner
              active={nfc}
              onScan={(codigo: string) => {
                setNfc(false);
                resolver(codigo);
              }}
            />
            <button onClick={() => setNfc(false)} className={`${BTN} w-full bg-gray-700 text-white`}>
              Cerrar NFC
            </button>
          </div>
        )}

        {r && modal === "entrega" && <ModalEntrega v={r.variante} onClose={cerrarYRefrescar} />}
        {r && (modal === "merma" || modal === "perdida") && (
          <ModalDescuento v={r.variante} tipo={modal} onClose={cerrarYRefrescar} />
        )}
        {r && modal === "reintegro" && (
          <ModalReintegro v={r.variante} onClose={cerrarYRefrescar} />
        )}
        {r && modal === "prestamo" && (
          <ModalPrestamo
            v={r.variante}
            unidadId={r.resolvio === "unidad" ? r.unidad?.id : null}
            onClose={cerrarYRefrescar}
          />
        )}
        {r && modal === "devolucion" && prestamoActivo && (
          <ModalDevolucion prestamo={prestamoActivo} onClose={cerrarYRefrescar} />
        )}

        {asociando && sinResolver && (
          <ModalAsociarCodigo
            codigo={sinResolver}
            onClose={() => setAsociando(false)}
            // Ya asociado, se vuelve a resolver: el flujo sigue en la acción
            // operativa que corresponda, que es a lo que venía el bodeguero.
            onAsociado={() => {
              const codigo = sinResolver;
              setAsociando(false);
              setSinResolver("");
              setError("");
              resolver(codigo);
            }}
          />
        )}
      </div>
    </TenantGuard>
  );
}
