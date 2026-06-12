import { writeFile, access, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "..", "demos", "screenshots");
const OUT = path.join(__dirname, "..", "demos", "nyumbasearch-full-walkthrough.webm");

const DURATIONS = {
  "01-landing": 5,
  "02-tenant-search": 5,
};

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

async function findFfmpeg() {
  const base = path.join(homedir(), "AppData", "Local", "ms-playwright");
  const dirs = await readdir(base).catch(() => []);
  const ff = dirs.find((d) => d.startsWith("ffmpeg-"));
  if (!ff) throw new Error("Playwright ffmpeg not found. Run: npx playwright install ffmpeg");
  return path.join(base, ff, "ffmpeg-win64.exe");
}

async function main() {
  const files = (await readdir(SHOT_DIR)).filter((f) => f.endsWith(".png")).sort();
  if (!files.length) {
    throw new Error("No screenshots in demos/screenshots. Run: npm run demo:capture");
  }

  const lines = [];
  for (const file of files) {
    const key = file.replace(/\.png$/, "");
    const dur = DURATIONS[key] ?? 4;
    const p = toPosix(path.join(SHOT_DIR, file));
    lines.push(`file '${p}'`, `duration ${dur}`);
  }
  const last = toPosix(path.join(SHOT_DIR, files.at(-1)));
  lines.push(`file '${last}'`);

  const listPath = path.join(SHOT_DIR, "concat.txt");
  await writeFile(listPath, lines.join("\n"), "utf8");

  const ffmpeg = await findFfmpeg();
  await new Promise((resolve, reject) => {
    const proc = spawn(
      ffmpeg,
      ["-y", "-f", "concat", "-i", listPath, "-c:v", "libvpx", "-pix_fmt", "yuv420p", OUT],
      { stdio: "inherit" },
    );
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });

  await access(OUT);
  console.log(`Video saved: ${OUT}`);
}

try {
  await main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
