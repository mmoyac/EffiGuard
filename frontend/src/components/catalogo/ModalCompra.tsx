import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { catalogoApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

/**
 * Compra de consumible.
 *
 * El contenido lo aporta el código del empaque, no el producto: la caja de un
 * proveedor trae 100 y la del otro 250. Elegir el código acá es el mismo gesto
 * que escanear la caja en el mesón.
 */
export function ModalCompra({
  v,
  onClose,
  codigoPreseleccionado,
}: {
  v: Variante;
  onClose: () => void;
  /** Al llegar desde un escaneo de empaque, ya sabemos qué caja es. */
  codigoPreseleccionado?: number | null;
}) {
  const qc = useQueryClient();
  const empaques = v.codigos.filter((c) => c.tipo === "empaque");
  const inicial =
    codigoPreseleccionado && empaques.some((c) => c.id === codigoPreseleccionado)
      ? codigoPreseleccionado
      : empaques[0]?.id ?? null;

  const [modo, setModo] = useState<"empaque" | "unidad">(empaques.length ? "empaque" : "unidad");
  const [codigoId, setCodigoId] = useState<number | null>(inicial);
  const [cantidad, setCantidad] = useState("1");
  const [precioTotal, setPrecioTotal] = useState("");
  const [actualizarPrecio, setActualizarPrecio] = useState(true);
  const [error, setError] = useState("");

  const codigo = empaques.find((c) => c.id === codigoId) ?? null;
  const n = Number(cantidad.replace(",", ".")) || 0;
  const totalUnidades = modo === "empaque" && codigo ? n * codigo.factor : n;
  const totalFactura = Number(precioTotal.replace(",", ".")) || 0;
  // El precio se paga por la compra entera pero se guarda por unidad de stock.
  // Mostrarlo es lo que hace visible el error de tipear el total de la caja como
  // si fuera el de una unidad — o al revés.
  const unitarioResultante = totalFactura > 0 && totalUnidades > 0 ? totalFactura / totalUnidades : null;
  const saltoDePrecio =
    unitarioResultante !== null &&
    v.precio_compra != null &&
    v.precio_compra > 0 &&
    (unitarioResultante / v.precio_compra > 3 || v.precio_compra / unitarioResultante > 3);

  const comprar = useMutation(
    () =>
      catalogoApi.purchase(v.id, {
        ...(modo === "empaque" ? { empaques: n, codigo_id: codigoId } : { cantidad: n }),
        ...(totalFactura > 0
          ? { precio_total: totalFactura, actualizar_precio: actualizarPrecio }
          : {}),
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        qc.invalidateQueries(["movimientos", v.id]);
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo registrar la compra")),
    }
  );

  return (
    <Modal
      titulo="Registrar compra"
      subtitulo={`${v.producto_nombre} · ${v.nombre}`}
      onClose={onClose}
    >
      {empaques.length > 0 && (
        <div className="flex gap-2">
          {(["empaque", "unidad"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`${BTN} flex-1 ${
                modo === m ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
              }`}
            >
              {m === "empaque" ? "Por empaque" : "Por unidad"}
            </button>
          ))}
        </div>
      )}

      {modo === "empaque" && (
        <Campo label="Empaque">
          <select
            className={INPUT}
            value={codigoId ?? ""}
            onChange={(e) => setCodigoId(Number(e.target.value))}
          >
            {empaques.map((c) => (
              <option key={c.id} value={c.id}>
                {c.proveedor_nombre ?? "Sin proveedor"} — {c.nombre_empaque ?? "empaque"} de{" "}
                {c.factor} {v.unidad} ({c.codigo})
              </option>
            ))}
          </select>
        </Campo>
      )}

      <Campo label={modo === "empaque" ? "Cuántos empaques" : `Cuántas ${v.unidad}`}>
        <input
          className={INPUT}
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </Campo>

      <Campo label="Total de la factura (opcional)">
        <input
          className={INPUT}
          inputMode="decimal"
          placeholder="Lo que pagaste por toda la compra"
          value={precioTotal}
          onChange={(e) => setPrecioTotal(e.target.value)}
        />
      </Campo>

      {unitarioResultante !== null && (
        <div
          className={`rounded-xl px-3 py-2.5 text-sm space-y-2 border ${
            saltoDePrecio
              ? "bg-yellow-500/10 border-yellow-500/40"
              : "bg-gray-900/50 border-transparent"
          }`}
        >
          <div className="flex justify-between">
            <span className="text-gray-400">Queda a</span>
            <span className="text-white font-semibold">
              ${unitarioResultante.toLocaleString("es-CL", { maximumFractionDigits: 2 })} por{" "}
              {v.unidad}
            </span>
          </div>
          {saltoDePrecio && (
            <p className="text-xs text-yellow-300">
              El precio actual es ${v.precio_compra?.toLocaleString("es-CL")}. Revisa que el
              total sea el de la compra completa y no el de una unidad.
            </p>
          )}
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer min-h-[32px]">
            <input
              type="checkbox"
              checked={actualizarPrecio}
              onChange={(e) => setActualizarPrecio(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            {/* Desmarcarlo sirve para la compra de emergencia a sobreprecio, que no
                debería arrastrar la valorización del resto del stock. */}
            Actualizar el precio del producto con este valor
          </label>
        </div>
      )}

      {/* El stock siempre se mueve en la unidad de despacho: el empaque sólo
          traduce al ingresar. Mostrarlo evita la sorpresa de "compré 3 y subió 300". */}
      <div className="bg-gray-900/50 rounded-xl px-3 py-2.5 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Entran</span>
          <span className="text-white font-semibold">
            {totalUnidades} {v.unidad}
          </span>
        </div>
        <div className="flex justify-between text-gray-400 mt-1">
          <span>Stock queda en</span>
          <span className="text-green-400 font-semibold">
            {v.stock_efectivo + totalUnidades} {v.unidad}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => comprar.mutate()}
          disabled={comprar.isLoading || totalUnidades <= 0}
          className={`${BTN} flex-1 bg-green-600 text-white hover:bg-green-500`}
        >
          {comprar.isLoading ? "Registrando…" : "Registrar compra"}
        </button>
      </div>
    </Modal>
  );
}
