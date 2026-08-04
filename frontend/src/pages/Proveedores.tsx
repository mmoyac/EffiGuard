import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Check, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { catalogoApi } from "../services/api";
import { TenantGuard } from "../components/layout/TenantGuard";

const INPUT =
  "bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full min-h-[48px]";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-[48px] text-sm font-medium transition-colors disabled:opacity-50";

type Proveedor = {
  id: number;
  nombre: string;
  rut: string | null;
  contacto: string | null;
};

const VACIO = { nombre: "", rut: "", contacto: "" };

export function Proveedores() {
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState(VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [error, setError] = useState("");

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>("proveedores", () =>
    catalogoApi.listProveedores().then((r) => r.data)
  );

  function refrescar() {
    qc.invalidateQueries("proveedores");
    // Los códigos muestran el nombre del proveedor embebido: renombrar acá lo cambia allá
    qc.invalidateQueries("productos");
  }

  function fallo(e: any, porDefecto: string) {
    const d = e?.response?.data?.detail;
    setError(typeof d === "string" ? d : d?.[0]?.msg ?? porDefecto);
  }

  const crear = useMutation(
    () =>
      catalogoApi.createProveedor({
        nombre: nuevo.nombre.trim(),
        ...(nuevo.rut.trim() ? { rut: nuevo.rut.trim() } : {}),
        ...(nuevo.contacto.trim() ? { contacto: nuevo.contacto.trim() } : {}),
      }),
    {
      onSuccess: () => {
        refrescar();
        setNuevo(VACIO);
        setMostrarForm(false);
        setError("");
      },
      onError: (e) => fallo(e, "No se pudo crear el proveedor"),
    }
  );

  const actualizar = useMutation(
    (p: Proveedor) =>
      catalogoApi.updateProveedor(p.id, {
        nombre: p.nombre.trim(),
        rut: p.rut?.trim() || null,
        contacto: p.contacto?.trim() || null,
      }),
    {
      onSuccess: () => {
        refrescar();
        setEditando(null);
        setError("");
      },
      onError: (e) => fallo(e, "No se pudo actualizar"),
    }
  );

  const eliminar = useMutation((id: number) => catalogoApi.deleteProveedor(id), {
    onSuccess: () => {
      refrescar();
      setError("");
    },
    // El backend bloquea si tiene códigos asociados y dice cuántos son. Las
    // compras ya registradas no bloquean: conservan su cantidad y su costo.
    onError: (e) => fallo(e, "No se puede eliminar"),
  });

  return (
    <TenantGuard>
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <Truck size={26} className="text-blue-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white">Proveedores</h1>
            <p className="text-xs text-gray-400">Quién te vende cada código</p>
          </div>
          <button
            onClick={() => {
              setMostrarForm((v) => !v);
              setError("");
            }}
            className={`${BTN} bg-blue-600 text-white hover:bg-blue-500`}
          >
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Cancelar" : "Nuevo"}
          </button>
        </div>

        {mostrarForm && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
            <input
              className={INPUT}
              placeholder="Nombre (obligatorio)"
              autoFocus
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className={INPUT}
                placeholder="RUT (opcional)"
                value={nuevo.rut}
                onChange={(e) => setNuevo({ ...nuevo, rut: e.target.value })}
              />
              <input
                className={INPUT}
                placeholder="Contacto (opcional)"
                value={nuevo.contacto}
                onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })}
              />
            </div>
            <button
              onClick={() => crear.mutate()}
              disabled={crear.isLoading || !nuevo.nombre.trim()}
              className={`${BTN} w-full bg-green-600 text-white hover:bg-green-500`}
            >
              {crear.isLoading ? "Creando…" : "Crear proveedor"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}

        {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

        {!isLoading && proveedores.length === 0 && (
          <div className="bg-gray-800 rounded-2xl p-6 text-center">
            <Truck size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Todavía no hay proveedores. También se crean solos al cargar un código con
              su nombre, desde el Excel o desde el catálogo.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {proveedores.map((p) =>
            editando?.id === p.id ? (
              <div key={p.id} className="bg-gray-800 rounded-2xl p-3 space-y-3">
                <input
                  className={INPUT}
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={INPUT}
                    placeholder="RUT"
                    value={editando.rut ?? ""}
                    onChange={(e) => setEditando({ ...editando, rut: e.target.value })}
                  />
                  <input
                    className={INPUT}
                    placeholder="Contacto"
                    value={editando.contacto ?? ""}
                    onChange={(e) => setEditando({ ...editando, contacto: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditando(null)}
                    className={`${BTN} flex-1 bg-gray-700 text-white`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => actualizar.mutate(editando)}
                    disabled={!editando.nombre.trim()}
                    className={`${BTN} flex-1 bg-green-600 text-white hover:bg-green-500`}
                  >
                    <Check size={18} /> Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="bg-gray-800 rounded-2xl px-3 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white truncate">{p.nombre}</p>
                  {(p.rut || p.contacto) && (
                    <p className="text-xs text-gray-400 truncate">
                      {[p.rut, p.contacto].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditando(p);
                    setError("");
                  }}
                  title="Editar"
                  className="text-gray-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => eliminar.mutate(p.id)}
                  title="Eliminar"
                  className="text-gray-400 hover:text-red-400 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </TenantGuard>
  );
}
