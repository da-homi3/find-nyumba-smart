import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destDir = join(root, "public", "ffmpeg");

mkdirSync(destDir, { recursive: true });

for (const name of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const from = join(srcDir, name);
  const to = join(destDir, name);
  if (!existsSync(from)) {
    console.error(`[copy-ffmpeg-core] Missing ${from}`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log(`[copy-ffmpeg-core] ${name}`);
}
