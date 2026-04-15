import type { FamilyColor } from "../types";

interface ColorTokens {
  badge: string;       // badge de texto pequeño
  icon: string;        // color del icono
  border: string;      // borde destacado (selección activa)
  bg: string;          // fondo suave
  swatch: string;      // círculo del selector de color
}

export const FAMILY_COLORS: Record<FamilyColor, ColorTokens> = {
  blue:   { badge: "text-blue-400 bg-blue-900/30 border-blue-800",   icon: "text-blue-400",   border: "border-blue-500",   bg: "bg-blue-900/20",   swatch: "bg-blue-500" },
  orange: { badge: "text-orange-400 bg-orange-900/30 border-orange-800", icon: "text-orange-400", border: "border-orange-500", bg: "bg-orange-900/20", swatch: "bg-orange-500" },
  green:  { badge: "text-green-400 bg-green-900/30 border-green-800",  icon: "text-green-400",  border: "border-green-500",  bg: "bg-green-900/20",  swatch: "bg-green-500" },
  purple: { badge: "text-purple-400 bg-purple-900/30 border-purple-800", icon: "text-purple-400", border: "border-purple-500", bg: "bg-purple-900/20", swatch: "bg-purple-500" },
  red:    { badge: "text-red-400 bg-red-900/30 border-red-800",       icon: "text-red-400",    border: "border-red-500",    bg: "bg-red-900/20",    swatch: "bg-red-500" },
  yellow: { badge: "text-yellow-400 bg-yellow-900/30 border-yellow-800", icon: "text-yellow-400", border: "border-yellow-500", bg: "bg-yellow-900/20", swatch: "bg-yellow-500" },
  pink:   { badge: "text-pink-400 bg-pink-900/30 border-pink-800",    icon: "text-pink-400",   border: "border-pink-500",   bg: "bg-pink-900/20",   swatch: "bg-pink-500" },
  cyan:   { badge: "text-cyan-400 bg-cyan-900/30 border-cyan-800",    icon: "text-cyan-400",   border: "border-cyan-500",   bg: "bg-cyan-900/20",   swatch: "bg-cyan-500" },
};

export const COLOR_OPTIONS: FamilyColor[] = ["blue", "orange", "green", "purple", "red", "yellow", "pink", "cyan"];

export function familyColor(color: FamilyColor | string): ColorTokens {
  return FAMILY_COLORS[color as FamilyColor] ?? FAMILY_COLORS.blue;
}
