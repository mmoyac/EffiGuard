/**
 * Genera los íconos PNG para la PWA a partir de Effiguard-icon.jpg
 *
 * Uso:
 *   cd frontend && npm run generate-icons
 *
 * Requiere: npm install --save-dev sharp  (solo en frontend, ya declarado en package.json)
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC = resolve(__dirname, "../docs/Effiguard-icon.jpg");
const OUT = resolve(__dirname, "../frontend/public/icons");

mkdirSync(OUT, { recursive: true });

const SIZES = [192, 512];

for (const size of SIZES) {
  const dest = resolve(OUT, `icon-${size}.png`);
  await sharp(SRC)
    .resize(size, size, {
      fit: "contain",
      background: { r: 17, g: 24, b: 39, alpha: 1 }, // #111827 — mismo que background_color del manifest
    })
    .png()
    .toFile(dest);
  console.log(`✓ ${dest}`);
}

console.log("\nÍconos PWA generados correctamente.");
