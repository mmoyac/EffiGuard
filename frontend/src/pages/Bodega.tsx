/**
 * Consulta de bodega.
 *
 * Responde una sola pregunta —¿hay, y dónde está?— y está diseñada para leerse a
 * una mano y caminando: el operario la consulta de camino al mesón, no sentado.
 * Por eso no hay filtros, ni pestañas, ni tarjetas que haya que abrir: cantidad y
 * ubicación se ven en el primer golpe de vista.
 */
import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { MapPin, PackageSearch, Search, X } from "lucide-react";
import { bodegaApi } from "../services/api";
import { COLORES_FAMILIA, INPUT } from "../components/catalogo/shared";
import type { ItemBodega } from "../types";

const MINIMO = 2;

export function Bodega() {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");

  // El operario tipea con guantes: sin debounce, cada roce dispara una búsqueda.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const buscando = consulta.length >= MINIMO;
  const { data: items = [], isLoading } = useQuery<ItemBodega[]>(
    ["bodega", consulta],
    () => bodegaApi.buscar(consulta).then((r) => r.data),
    { enabled: buscando, keepPreviousData: true }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PackageSearch size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Bodega</h2>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Qué necesitas: nombre o código de la caja"
          className={`${INPUT} pl-10 pr-10 text-base`}
        />
        {texto && (
          <button
            onClick={() => setTexto("")}
            aria-label="Limpiar"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-[48px] w-[48px] flex items-center justify-center text-gray-500 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {!buscando ? (
        <Vacio
          titulo="Busca lo que necesitas"
          detalle="Escribe el nombre del material o el código impreso en la caja."
        />
      ) : isLoading ? (
        <p className="text-gray-400">Buscando...</p>
      ) : items.length === 0 ? (
        // "No está en catálogo" y "existe pero no hay" son cosas distintas, y
        // confundirlas manda al operario a pedir algo que nadie compró nunca.
        <Vacio
          titulo="No está en el catálogo"
          detalle={`Nada coincide con "${consulta}". Puede estar cargado con otro nombre, o no existir todavía.`}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Tarjeta key={item.variante_id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl py-14 px-6 gap-2 text-center">
      <PackageSearch size={40} className="text-gray-700" />
      <p className="text-sm font-medium text-gray-400">{titulo}</p>
      <p className="text-xs text-gray-500 max-w-xs">{detalle}</p>
    </div>
  );
}

function Tarjeta({ item }: { item: ItemBodega }) {
  const color = COLORES_FAMILIA[item.familia_color ?? "blue"] ?? COLORES_FAMILIA.blue;

  return (
    <div
      className={`bg-gray-800 rounded-2xl border p-4 space-y-3 ${
        item.hay_stock ? "border-gray-700" : "border-gray-800 opacity-60"
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold text-white break-words">{item.producto_nombre}</p>
        <p className="text-sm text-gray-400 break-words">{item.variante_nombre}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-base font-bold px-3 py-1.5 rounded-xl border ${
            item.hay_stock
              ? "bg-green-900/30 text-green-300 border-green-800"
              : "bg-gray-900/60 text-gray-500 border-gray-700"
          }`}
        >
          {item.hay_stock ? item.disponibilidad_texto : "Sin stock"}
        </span>
        {!item.hay_stock && item.comportamiento === "prestable" && (
          <span className="text-xs text-gray-500">{item.disponibilidad_texto}</span>
        )}
        <span className={`text-xs rounded-lg border px-2 py-0.5 ${color}`}>
          {item.familia_nombre}
        </span>
      </div>

      <div className="space-y-1.5">
        {item.ubicaciones.map((u, i) => (
          <div key={i} className="flex items-center gap-2 text-sm min-w-0">
            <MapPin
              size={16}
              className={u.rack ? "text-blue-400 flex-shrink-0" : "text-gray-600 flex-shrink-0"}
            />
            <span className={`truncate ${u.rack ? "text-gray-200" : "text-gray-500 italic"}`}>
              {u.texto}
            </span>
            {/* Con ejemplares repartidos en varios racks, saber cuántos hay en
                cada uno evita el segundo viaje. */}
            {u.ejemplares !== null && item.ubicaciones.length > 1 && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                ({u.ejemplares})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
