import { useQuery } from "react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Package, ArrowLeftRight, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { familyColor } from "../utils/familyColors";

// ── Colores dark-mode ───────────────────────────────────────────────────────
const STATE_COLORS: Record<string, string> = {
  "Disponible":    "#22c55e",
  "En Terreno":    "#3b82f6",
  "En Reparación": "#eab308",
  "Robado":        "#ef4444",
};
const FALLBACK_COLORS = ["#6366f1", "#f97316", "#06b6d4", "#ec4899"];
const AXIS_COLOR = "#6b7280";
const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: 12,
  color: "#f9fafb",
  fontSize: 12,
};

// ── Types ────────────────────────────────────────────────────────────────────
interface LowStockItem {
  id: number; uid_fisico: string; nombre: string | null;
  stock_actual: number; stock_minimo: number;
  family_nombre: string; family_color: string;
}
interface OverdueLoan {
  loan_id: number; asset_id: number; uid_fisico: string; asset_nombre: string | null;
  family_nombre: string; family_color: string;
  user_nombre: string; dias_transcurridos: number; dias_max: number; dias_excedido: number;
  fecha_entrega: string;
}

// ── API calls ───────────────────────────────────────────────────────────────
const dashApi = {
  stats:         () => api.get("/dashboard/stats").then((r: { data: { total_assets: number; active_loans: number; low_stock: number } }) => r.data),
  byState:       () => api.get("/dashboard/assets-by-state").then((r: { data: { estado: string; count: number }[] }) => r.data),
  loansLastDays: () => api.get("/dashboard/loans-last-days?days=7").then((r: { data: { dia: string; prestamos: number }[] }) => r.data),
  inventoryDays: () => api.get("/dashboard/inventory-last-days?days=30").then((r: { data: { dia: string; cantidad: number }[] }) => r.data),
  lowStockDetail: () => api.get("/dashboard/low-stock-detail").then((r: { data: LowStockItem[] }) => r.data),
  overdueLoans:   () => api.get("/dashboard/overdue-loans").then((r: { data: OverdueLoan[] }) => r.data),
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ── Componentes ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string;
  color: "blue" | "yellow" | "green" | "purple";
}) {
  const colors = {
    blue:   "text-blue-400 bg-blue-900/20 border-blue-900",
    yellow: "text-yellow-400 bg-yellow-900/20 border-yellow-900",
    green:  "text-green-400 bg-green-900/20 border-green-900",
    purple: "text-purple-400 bg-purple-900/20 border-purple-900",
  };
  return (
    <div className={`rounded-2xl p-5 border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-3 opacity-80">{icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-4xl font-bold">{value ?? "—"}</p>
    </div>
  );
}

function ChartCard({ title, children, minH = "h-52" }: {
  title: string; children: React.ReactNode; minH?: string;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      <div className={`${minH} w-full`}>{children}</div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();

  const STATE_ROUTES: Record<string, string> = {
    "En Terreno":    "/loans",
    "Disponible":    "/assets",
    "En Reparación": "/assets",
    "Robado":        "/assets",
  };

  const { data: stats } = useQuery("dash-stats", dashApi.stats, { refetchInterval: 30000 });
  const { data: byStateRaw = [] } = useQuery("dash-by-state", dashApi.byState);
  const { data: loansData = [] } = useQuery("dash-loans", dashApi.loansLastDays);
  const { data: invData = [] } = useQuery("dash-inventory", dashApi.inventoryDays);
  const { data: lowStockItems = [] } = useQuery<LowStockItem[]>("dash-low-stock", dashApi.lowStockDetail, { refetchInterval: 60000 });
  const { data: overdueItems = [] } = useQuery<OverdueLoan[]>("dash-overdue", dashApi.overdueLoans, { refetchInterval: 60000 });

  // Inyectar color en los datos del donut para no necesitar <Cell>
  const byState = byStateRaw.map((d, i) => ({
    ...d,
    fill: STATE_COLORS[d.estado] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp size={26} className="text-blue-400" />
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard icon={<Package size={18} />}       label="Activos totales"   value={stats?.total_assets ?? "—"} color="green" />
        <KpiCard icon={<ArrowLeftRight size={18} />} label="En terreno"        value={stats?.active_loans ?? "—"} color="blue" />
        <KpiCard icon={<AlertTriangle size={18} />}  label="Stock bajo mínimo" value={stats?.low_stock ?? "—"}    color="yellow" />
      </div>

      {/* Fila de gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Barras — préstamos últimos 7 días */}
        <ChartCard title="Préstamos — últimos 7 días">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={loansData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dia" tickFormatter={shortDate} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [v, "Préstamos"]}
                labelFormatter={(l) => shortDate(String(l))}
              />
              <Bar dataKey="prestamos" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Donut — activos por estado */}
        <ChartCard title="Activos por estado" minH="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byState}
                dataKey="count"
                nameKey="estado"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
                cursor="pointer"
                onClick={(d) => { const route = STATE_ROUTES[(d as unknown as { estado: string }).estado]; if (route) navigate(route); }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [v]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ color: "#d1d5db", fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Línea — movimientos de inventario 30 días */}
      <ChartCard title="Movimientos de inventario — últimos 30 días" minH="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={invData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="dia"
              tickFormatter={shortDate}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [v, "Unidades"]}
              labelFormatter={(l) => shortDate(String(l))}
            />
            <Line
              type="monotone"
              dataKey="cantidad"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#22c55e" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Fila: stock bajo + préstamos vencidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Stock bajo mínimo */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            <p className="text-sm font-semibold text-gray-300">Stock bajo mínimo</p>
            {lowStockItems.length > 0 && (
              <span className="ml-auto text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Todo el stock está en orden</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {lowStockItems.map((item) => (
                <div key={item.id}
                  className="flex items-center gap-2 bg-gray-700/50 border border-gray-600 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => navigate(`/assets/${item.id}/edit`)}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${familyColor(item.family_color).swatch}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.nombre ?? item.uid_fisico}</p>
                    <p className="text-xs text-gray-500">{item.family_nombre}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-yellow-400">{item.stock_actual}</p>
                    <p className="text-xs text-gray-500">mín {item.stock_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Préstamos vencidos */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-red-400" />
            <p className="text-sm font-semibold text-gray-300">Préstamos vencidos</p>
            {overdueItems.length > 0 && (
              <span className="ml-auto text-xs bg-red-900/40 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
                {overdueItems.length}
              </span>
            )}
          </div>
          {overdueItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Sin préstamos fuera de plazo</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {overdueItems.map((item) => (
                <div key={item.loan_id}
                  className="flex items-center gap-2 bg-gray-700/50 border border-gray-600 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => navigate("/loans")}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${familyColor(item.family_color).swatch}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.asset_nombre ?? item.uid_fisico}</p>
                    <p className="text-xs text-gray-500 truncate">{item.user_nombre}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-400">+{item.dias_excedido}d</p>
                    <p className="text-xs text-gray-500">{item.dias_transcurridos}/{item.dias_max}d</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
