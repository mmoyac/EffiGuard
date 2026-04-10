import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { useMenu } from "../../hooks/useMenu";
import type { MenuItem } from "../../types";

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function NavItem({
  item,
  collapsed,
  onClose,
}: {
  item: MenuItem;
  collapsed: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const isGroup = !item.ruta && item.children.length > 0;
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[
    item.icono ?? "Circle"
  ];

  // Ítem grupo (sin ruta): colapsable con toggle
  if (isGroup) {
    return (
      <li>
        {!collapsed ? (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-colors min-h-[48px] px-4 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              {Icon && <Icon size={20} />}
              <span className="flex-1 text-left truncate">{item.label}</span>
              <Icons.ChevronDown
                size={14}
                className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <ul className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => (
                  <NavItem key={child.id} item={child} collapsed={false} onClose={onClose} />
                ))}
              </ul>
            )}
          </>
        ) : (
          // Colapsado: mostrar hijos directamente como iconos
          <ul className="space-y-1">
            {item.children.map((child) => (
              <NavItem key={child.id} item={child} collapsed={true} onClose={onClose} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Ítem normal (con ruta)
  return (
    <li>
      <NavLink
        to={item.ruta}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors min-h-[48px]
           ${collapsed ? "justify-center px-0" : "px-4"}
           ${isActive
             ? "bg-blue-600 text-white"
             : "text-gray-300 hover:bg-gray-800 hover:text-white"
           }`
        }
      >
        {Icon && <Icon size={20} />}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
      {!collapsed && item.children.length > 0 && (
        <ul className="ml-6 mt-1 space-y-1">
          {item.children.map((child) => (
            <NavItem key={child.id} item={child} collapsed={false} onClose={onClose} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ isOpen, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { data: menu = [], isLoading } = useMenu();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 bg-gray-950 flex flex-col border-r border-gray-800
        transform transition-all duration-200 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:z-auto
        ${collapsed ? "md:w-16" : "md:w-64"}
        w-64
      `}
    >
      {/* Header: logo + botón colapsar */}
      <div className="p-4 border-b border-gray-800 flex-shrink-0 flex items-center justify-between min-h-[60px]">
        {!collapsed && <h1 className="text-xl font-bold text-blue-400">EffiGuard</h1>}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ml-auto"
        >
          {collapsed
            ? <Icons.ChevronsRight size={18} />
            : <Icons.ChevronsLeft size={18} />}
        </button>
      </div>

      {/* Menú */}
      <nav className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          !collapsed && <p className="text-gray-500 text-sm p-4">Cargando...</p>
        ) : (
          <ul className="space-y-1">
            {menu.map((item) => (
              <NavItem key={item.id} item={item} collapsed={collapsed} onClose={onClose} />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
