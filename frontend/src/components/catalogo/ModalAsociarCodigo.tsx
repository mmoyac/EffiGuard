/**
 * Asociar a una variante un código que el escaneo no resolvió.
 *
 * Existe porque el callejón sin salida estaba en el peor momento: llega un lote
 * con un código de proveedor nuevo, el bodeguero lo escanea en el mesón y la
 * pantalla decía "Código no encontrado" durante cuatro segundos y se limpiaba.
 * La única salida era irse al mantenedor de catálogo con el operario esperando.
 *
 * Dos pasos: a qué variante, y qué es este código. El segundo reusa `ModalCodigo`
 * tal cual — un formulario propio sería una segunda implementación del mismo
 * alta, divergiendo desde el día uno.
 */
import { useState } from "react";
import { useQuery } from "react-query";
import { Search } from "lucide-react";
import { catalogoApi } from "../../services/api";
import { ModalCodigo } from "./SeccionCodigos";
import { BTN, INPUT, Modal, type Producto, type Variante } from "./shared";

export function ModalAsociarCodigo({
  codigo,
  onClose,
  onAsociado,
}: {
  codigo: string;
  onClose: () => void;
  /** Reintenta la resolución: el flujo sigue en la acción operativa que corresponda */
  onAsociado: () => void;
}) {
  const [buscar, setBuscar] = useState("");
  const [elegida, setElegida] = useState<Variante | null>(null);

  // La misma búsqueda del catálogo, no una nueva
  const { data: productos = [], isLoading } = useQuery<Producto[]>(
    ["productos", "asociar", buscar],
    () => catalogoApi.listProductos(buscar ? { buscar } : undefined).then((r) => r.data),
    { keepPreviousData: true }
  );

  // La pregunta es "¿a qué variante?", así que la jerarquía se aplana acá
  const variantes = productos.flatMap((p) =>
    p.variantes.map((v) => ({ ...v, producto_nombre: v.producto_nombre ?? p.nombre }))
  );

  if (elegida) {
    return (
      <ModalCodigo
        v={elegida}
        codigoInicial={codigo}
        onClose={onClose}
        onCreado={onAsociado}
      />
    );
  }

  return (
    <Modal titulo="Asociar código" subtitulo={codigo} onClose={onClose}>
      <p className="text-sm text-gray-400">
        Ese código no está registrado. Elige a qué variante pertenece y queda
        asociado sin salir del escaneo.
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Buscar producto o variante…"
          autoFocus
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 min-w-0">
        {isLoading && <p className="text-sm text-gray-500">Buscando…</p>}
        {!isLoading && !variantes.length && (
          <p className="text-sm text-gray-500">
            Sin resultados. Si el producto todavía no existe, créalo desde Catálogo.
          </p>
        )}
        {variantes.map((v) => (
          <button
            key={v.id}
            onClick={() => setElegida(v)}
            className="w-full text-left bg-gray-700/60 hover:bg-gray-700 rounded-xl px-3 py-2.5 min-h-[48px] transition-colors min-w-0"
          >
            <p className="text-sm text-white truncate">{v.producto_nombre}</p>
            <p className="text-xs text-gray-400 truncate">
              {v.nombre}
              {v.codigos.length ? ` · ${v.codigos.length} código(s)` : " · sin códigos"}
            </p>
          </button>
        ))}
      </div>

      <button onClick={onClose} className={`${BTN} w-full bg-gray-700 text-white`}>
        Cancelar
      </button>
    </Modal>
  );
}
