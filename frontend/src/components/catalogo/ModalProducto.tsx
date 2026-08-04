import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { catalogApi, catalogoApi } from "../../services/api";
import { BTN, Campo, INPUT, Modal, mensajeError, type Producto } from "./shared";

type Familia = { id: number; nombre: string; comportamiento: string };
type Marca = { id: number; nombre: string };

/**
 * Alta y edición de producto.
 *
 * El alta crea producto + variante homónima en una sola operación: la mayoría de
 * los consumibles no tiene variantes reales, y exigir dos pasos cobraría el costo
 * del modelo en el caso más común. Las variantes se agregan después si aparecen.
 */
export function ModalProducto({
  producto,
  onClose,
}: {
  /** Sin producto es alta; con producto es edición. */
  producto?: Producto;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editando = !!producto;

  const [f, setF] = useState({
    nombre: producto?.nombre ?? "",
    family_id: producto ? String((producto as any).family_id ?? "") : "",
    brand_id: "",
    unidad: "unidad",
    stock_minimo: "0",
    precio_compra: "",
    valor_reposicion: "",
    dias_max_prestamo: "",
    cantidad_unidades: "0",
  });
  const [error, setError] = useState("");

  const { data: familias = [] } = useQuery<Familia[]>("familias", () =>
    catalogoApi.familias().then((r) => r.data)
  );
  const { data: marcas = [] } = useQuery<Marca[]>("marcas", () =>
    catalogApi.brands().then((r) => r.data)
  );

  const familia = familias.find((x) => String(x.id) === f.family_id);
  const esPrestable = familia?.comportamiento === "prestable";

  const guardar = useMutation(
    () => {
      const num = (v: string) => Number(v.replace(",", ".")) || 0;
      if (editando) {
        return catalogoApi.updateProducto(producto!.id, {
          nombre: f.nombre.trim(),
          ...(f.family_id ? { family_id: Number(f.family_id) } : {}),
          ...(f.brand_id ? { brand_id: Number(f.brand_id) } : {}),
        });
      }
      return catalogoApi.createProducto({
        nombre: f.nombre.trim(),
        family_id: Number(f.family_id),
        ...(f.brand_id ? { brand_id: Number(f.brand_id) } : {}),
        unidad: f.unidad,
        stock_minimo: num(f.stock_minimo),
        ...(f.precio_compra ? { precio_compra: num(f.precio_compra) } : {}),
        ...(f.valor_reposicion ? { valor_reposicion: num(f.valor_reposicion) } : {}),
        ...(esPrestable && f.dias_max_prestamo
          ? { dias_max_prestamo: Number(f.dias_max_prestamo) }
          : {}),
        ...(esPrestable ? { cantidad_unidades: Number(f.cantidad_unidades) || 0 } : {}),
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

  return (
    <Modal
      titulo={editando ? "Editar producto" : "Nuevo producto"}
      subtitulo={editando ? producto!.nombre : undefined}
      onClose={onClose}
    >
      <Campo label="Nombre">
        <input
          className={INPUT}
          placeholder="Tornillo autoperforante"
          autoFocus
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
        />
      </Campo>

      <Campo label="Familia">
        <select
          className={INPUT}
          value={f.family_id}
          onChange={(e) => setF({ ...f, family_id: e.target.value })}
        >
          <option value="">— elegir —</option>
          {familias.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre} ({x.comportamiento})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Define si se presta o se consume. Sus variantes y ejemplares lo heredan.
        </p>
      </Campo>

      <Campo label="Marca (opcional)">
        <select
          className={INPUT}
          value={f.brand_id}
          onChange={(e) => setF({ ...f, brand_id: e.target.value })}
        >
          <option value="">— sin marca —</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </Campo>

      {/* En edición no se tocan los datos de stock: pertenecen a cada variante,
          y el producto puede tener varias con valores distintos. */}
      {!editando && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {!esPrestable && (
              <Campo label="Unidad de despacho">
                <select
                  className={INPUT}
                  value={f.unidad}
                  onChange={(e) => setF({ ...f, unidad: e.target.value })}
                >
                  {["unidad", "metro", "kilo", "litro"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
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

          {esPrestable && (
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Días máx. préstamo">
                <input
                  className={INPUT}
                  inputMode="numeric"
                  placeholder="hereda familia"
                  value={f.dias_max_prestamo}
                  onChange={(e) => setF({ ...f, dias_max_prestamo: e.target.value })}
                />
              </Campo>
              <Campo label="Ejemplares a crear">
                <input
                  className={INPUT}
                  inputMode="numeric"
                  value={f.cantidad_unidades}
                  onChange={(e) => setF({ ...f, cantidad_unidades: e.target.value })}
                />
              </Campo>
            </div>
          )}

          <p className="text-xs text-gray-500">
            El stock inicial se carga con una compra o un ajuste, no acá: así queda en
            la bitácora.
          </p>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className={`${BTN} flex-1 bg-gray-700 text-white`}>
          Cancelar
        </button>
        <button
          onClick={() => guardar.mutate()}
          disabled={guardar.isLoading || !f.nombre.trim() || (!editando && !f.family_id)}
          className={`${BTN} flex-1 bg-blue-600 text-white hover:bg-blue-500`}
        >
          {guardar.isLoading ? "Guardando…" : editando ? "Guardar" : "Crear producto"}
        </button>
      </div>
    </Modal>
  );
}
