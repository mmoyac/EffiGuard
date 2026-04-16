import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Building2, Plus, ChevronDown, ChevronUp, ImagePlus, Key, Copy, Trash2, Check } from "lucide-react";
import { adminApi, getMediaUrl } from "../../services/api";

interface ApiKeyItem {
  id: number;
  description: string;
  key?: string;
  is_active: boolean;
  created_at: string;
}

function TenantApiKeys({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [] } = useQuery<ApiKeyItem[]>(
    ["api-keys", tenantId],
    () => adminApi.listApiKeys(tenantId).then((r) => r.data),
  );

  const createMutation = useMutation(
    () => adminApi.createApiKey(tenantId, description),
    {
      onSuccess: (r) => {
        qc.invalidateQueries(["api-keys", tenantId]);
        setNewKey(r.data.key);
        setDescription("");
        setShowForm(false);
      },
    },
  );

  const revokeMutation = useMutation(
    (keyId: number) => adminApi.revokeApiKey(tenantId, keyId),
    { onSuccess: () => qc.invalidateQueries(["api-keys", tenantId]) },
  );

  function copyKey(k: string) {
    navigator.clipboard.writeText(k);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-gray-700 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Key size={14} className="text-yellow-400" />
        <span className="text-xs font-semibold text-gray-300">API Keys</span>
        <button
          onClick={() => { setShowForm((v) => !v); setNewKey(null); }}
          className="ml-auto flex items-center gap-1.5 text-xs bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-700/50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Plus size={12} /> Nueva key
        </button>
      </div>

      {newKey && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-xl px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-green-400 font-semibold">Key generada — cópiala ahora, no se volverá a mostrar</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-green-300 bg-gray-900 px-2 py-1.5 rounded-lg font-mono break-all">{newKey}</code>
            <button onClick={() => copyKey(newKey)} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors">
              {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="flex gap-2">
          <input
            autoFocus required placeholder="Descripción (ej: n8n producción)"
            value={description} onChange={(e) => setDescription(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
          <button type="submit" disabled={createMutation.isLoading}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-xl transition-colors">
            Generar
          </button>
        </form>
      )}

      {keys.length === 0 && !showForm && (
        <p className="text-xs text-gray-500">Sin API keys.</p>
      )}

      <div className="space-y-1.5">
        {keys.map((k) => (
          <div key={k.id} className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-gray-700/40 ${!k.is_active ? "opacity-40" : ""}`}>
            <Key size={12} className={k.is_active ? "text-yellow-400" : "text-gray-500"} />
            <span className="flex-1 text-gray-300 truncate">{k.description}</span>
            <span className="text-gray-500 flex-shrink-0">{k.created_at.slice(0, 10)}</span>
            {k.is_active && (
              <button onClick={() => revokeMutation.mutate(k.id)}
                className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors" title="Revocar">
                <Trash2 size={13} />
              </button>
            )}
            {!k.is_active && <span className="text-gray-600 flex-shrink-0">Revocada</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Tenant {
  id: number;
  nombre_empresa: string;
  rut_empresa: string;
  slug: string;
  plan_type: string;
  is_active: boolean;
  logo_url: string | null;
}

interface Summary {
  tenant: Tenant;
  usuarios: number;
  activos: number;
  prestamos_activos: number;
}

const EMPTY = { nombre_empresa: "", rut_empresa: "", slug: "", plan_type: "basic" };
const PLANS = ["basic", "pro", "enterprise"];

export function AdminTenants() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tenant>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<number, Summary>>({});
  const [error, setError] = useState("");
  const [logoUploading, setLogoUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingLogoTenantId, setPendingLogoTenantId] = useState<number | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>("admin-tenants", () =>
    adminApi.listTenants().then((r) => r.data)
  );

  const createMutation = useMutation(
    (d: typeof EMPTY) => adminApi.createTenant(d),
    {
      onSuccess: () => { qc.invalidateQueries("admin-tenants"); setShowForm(false); setForm(EMPTY); setError(""); },
      onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear"),
    }
  );

  const updateMutation = useMutation(
    ({ id, d }: { id: number; d: object }) => adminApi.updateTenant(id, d),
    {
      onSuccess: () => { qc.invalidateQueries("admin-tenants"); setEditId(null); },
    }
  );

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!summary[id]) {
      const { data } = await adminApi.tenantSummary(id);
      setSummary((s) => ({ ...s, [id]: data }));
    }
  }

  function handleLogoClick(tenantId: number) {
    setPendingLogoTenantId(tenantId);
    fileInputRef.current?.click();
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingLogoTenantId) return;
    setLogoUploading(pendingLogoTenantId);
    try {
      await adminApi.uploadTenantLogo(pendingLogoTenantId, file);
      qc.invalidateQueries("admin-tenants");
    } finally {
      setLogoUploading(null);
      setPendingLogoTenantId(null);
      e.target.value = "";
    }
  }

  if (isLoading) return <p className="text-gray-400 p-4">Cargando tenants...</p>;

  return (
    <div className="space-y-4">
      {/* Input de archivo oculto para upload de logo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleLogoChange}
      />

      <div className="flex items-center gap-3">
        <Building2 size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Tenants</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">{tenants.length}</span>
        <button onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[44px] transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuevo tenant</p>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Nombre empresa" value={form.nombre_empresa}
              onChange={(e) => setForm({ ...form, nombre_empresa: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required placeholder="RUT empresa" value={form.rut_empresa}
              onChange={(e) => setForm({ ...form, rut_empresa: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <input required placeholder="Slug (ej: empresa-abc)" value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full" />
            <select value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full">
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors min-h-[44px]">
              {createMutation.isLoading ? "Guardando..." : "Crear tenant"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); setForm(EMPTY); }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-700 transition-colors min-h-[44px]">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className={`bg-gray-800 rounded-xl border ${t.is_active ? "border-gray-700" : "border-gray-700/40 opacity-60"}`}>
            <div className="px-4 py-3 flex items-center gap-3 min-w-0">
              {/* Logo o ícono */}
              <div className="flex-shrink-0 relative group w-9 h-9">
                {t.logo_url ? (
                  <img
                    src={getMediaUrl(t.logo_url) ?? ""}
                    alt={t.nombre_empresa}
                    className="w-9 h-9 rounded-lg object-contain bg-gray-700 border border-gray-600"
                  />
                ) : (
                  <Building2 size={18} className="text-blue-400 mt-1.5 ml-1.5" />
                )}
                <button
                  onClick={() => handleLogoClick(t.id)}
                  disabled={logoUploading === t.id}
                  title="Subir logo"
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {logoUploading === t.id
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <ImagePlus size={14} className="text-white" />}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {editId === t.id ? (
                  <input autoFocus value={editForm.nombre_empresa ?? t.nombre_empresa}
                    onChange={(e) => setEditForm({ ...editForm, nombre_empresa: e.target.value })}
                    className="bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm text-white w-full focus:outline-none" />
                ) : (
                  <p className="text-sm font-semibold text-white truncate">{t.nombre_empresa}</p>
                )}
                <p className="text-xs text-gray-500 truncate">{t.slug} · {t.rut_empresa}</p>
              </div>
              <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                t.plan_type === "enterprise" ? "text-purple-400 bg-purple-900/30 border-purple-800" :
                t.plan_type === "pro" ? "text-blue-400 bg-blue-900/30 border-blue-800" :
                "text-gray-400 bg-gray-700 border-gray-600"}`}>
                {t.plan_type}
              </span>
              {editId === t.id ? (
                <>
                  <button onClick={() => updateMutation.mutate({ id: t.id, d: editForm })}
                    className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors">Guardar</button>
                  <button onClick={() => setEditId(null)}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(t.id); setEditForm({ nombre_empresa: t.nombre_empresa, plan_type: t.plan_type }); }}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0">Editar</button>
                  <button onClick={() => toggleExpand(t.id)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    {expanded === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </>
              )}
            </div>

            {expanded === t.id && summary[t.id] && (
              <>
                <div className="border-t border-gray-700 px-4 py-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Usuarios", val: summary[t.id].usuarios },
                    { label: "Activos", val: summary[t.id].activos },
                    { label: "Préstamos activos", val: summary[t.id].prestamos_activos },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-gray-700/50 rounded-xl px-3 py-2 text-center">
                      <p className="text-lg font-bold text-white">{val}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
                <TenantApiKeys tenantId={t.id} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
