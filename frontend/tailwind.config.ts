import type { Config } from "tailwindcss";

export default {
  // Dark mode siempre activo — modo industrial
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tamaño mínimo táctil: 48px para uso en fábrica
      minHeight: { touch: "48px" },
      minWidth: { touch: "48px" },
    },
  },
  plugins: [],
} satisfies Config;
