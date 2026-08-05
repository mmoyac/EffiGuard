import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { catalogoApi } from "../../services/api";
import { SeccionCodigos } from "./SeccionCodigos";
import { BTN, Campo, INPUT, Modal, mensajeError, type Variante } from "./shared";

/**
 * Edición de variante.
 *
 * No expone el stock: las existencias se mueven por compra, ajuste o merma, para
 * que ningún cambio quede sin explicación en la bitácora. Un campo de stock
 * editable es justo la puerta que el registro de movimientos existe para cerrar.
 */
export function ModalEditarVariante({ v, onClose }: { v: Variante; onClose: () => void }) {
  const qc = useQueryClient();
  const esPrestable = v.comportamiento === "prestable";
  const [f, setF] = useState({
    nombre: v.nombre,
    unidad: v.unidad,
    stock_minimo: String(v.stock_minimo ?? 0),
    precio_compra: v.precio_compra != null ? String(v.precio_compra) : "",
    valor_reposicion: "",
  });
  const [error, setError] = useState("");

  const guardar = useMutation(
    () => {
      const num = (s: string) => Number(s.replace(",", ".")) || 0;
      return catalogoApi.updateVariante(v.id, {
        nombre: f.nombre.trim(),
        unidad: f.unidad,
        stock_minimo: num(f.stock_minimo),
        ...(f.precio_compra ? { precio_compra: num(f.precio_compra) } : {}),
        ...(f.valor_reposicion ? { valor_reposicion: num(f.valor_reposicion) } : {}),
      });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries("productos");
        onClose();
      },
      onError: (e) => setError(mensajeError(e, "No se pudo guardar")),
    }
  );

  const conStock = v.stock_efectivo > 0 && !esPrestable;

  return (
    <Modal titulo="Editar variante" subtitulo={v.producto_nombre} onClose={onClose}>
      <Campo label="Nombre de la variante">
        <input
          className={INPUT}
          autoFocus
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
        />
        <p className="text-xs text-gray-500 mt-1">
          Renombrar no afecta la bitácora: los movimientos apuntan a la variante, no
          a su nombre.
        </p>
      </Campo>

      {!esPrestable && (
        <Campo label="Unidad de despacho">
          <select
            className={INPUT}
            value={f.unidad}
            disabled={conStock}
            onChange={(e) => setF({ ...f, unidad: e.target.value })}
          >
            {["unidad", "metro", "kilo", "litro"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {conStock && (
            <p className="text-xs text-amber-400/90 mt-1">
              Bloqueada: hay {v.stock_efectivo} en stock. Convertirlas a otra unidad
              cambiaría lo que dice el inventario.
            </p>
          )}
        </Campo>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Stock mínimo">
          <input
            className={INPUT}
            inputMode="decimal"
            value={f.stock_minimo}
            onChange={(e) => setF({ ...f, stock_minimo: e.target.value })}
          />
        </Campo>
        <Campo label={esPrestable ? "Valor de reposición" : "Precio de compra"}>
          <input
            className={INPUT}
            inputMode="decimal"
            placeholder={esPrestable ? "lo que cuesta reemplazarla" : ""}
            value={esPrestable ? f.valor_reposicion : f.precio_compra}
            onChange={(e) =>
              setF(
                esPrestable
                  ? { ...f, valor_reposicion: e.target.value }
                  : { ...f, precio_compra: e.target.value }
              )
            }
          />
        </Campo>
      </div>

      <p className="text-xs text-gray-500">
        Cambiar el precio no revaloriza los movimientos ya registrados: cada uno
        conserva el costo con que ocurrió.
      </p>

      {/*
        Los códigos van acá porque es donde se los busca: el botón dice editar la
        variante y los códigos son parte de la variante. Se mantienen también en
        el panel, que sirve para verlos de un vistazo sin intención de tocarlos.
        Al final del formulario, después de los campos que se editan más seguido.
      */}
      <div className="border-t border-gray-700 pt-3">
        <SeccionCodigos v={v} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => guardar.mutate()}
          disabled={guardar.isLoading || !f.nombre.trim()}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {guardar.isLoading ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
