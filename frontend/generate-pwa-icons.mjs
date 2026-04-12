/**
 * Genera los íconos PNG para la PWA a partir de Effiguard-icon.jpg
 * Uso: npm run generate-icons
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC = resolve(__dirname, "../docs/Effiguard-icon.jpg");
const OUT = resolve(__dirname, "public/icons");

mkdirSync(OUT, { recursive: true });

for (const size of [192, 512]) {
  const dest = resolve(OUT, `icon-${size}.png`);
  await sharp(SRC)
    .resize(size, size, {
      fit: "contain",
      background: { r: 17, g: 24, b: 39, alpha: 1 }, // #111827
    })
    .png()
    .toFile(dest);
  console.log(`✓ icon-${size}.png`);
}

console.log("\nÍconos PWA generados en public/icons/");
