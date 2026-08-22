#!/usr/bin/env node
/**
 * Builds property manager tutorial master video:
 *  1. Generate VO (edge-tts) if missing
 *  2. Concatenate footage clips
 *  3. Mix VO + optional ambient bed
 *  4. Burn in chapter titles + subtitles
 *
 * Output:
 *   docs/video-tutorial/FOR-LAPTOP/01-MASTER-16x9-VO.mp4
 *   docs/video-tutorial/FOR-LAPTOP/02-MASTER-9x16-VO.mp4
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TUTORIAL = path.join(ROOT, "docs", "video-tutorial");
const FOOTAGE = path.join(TUTORIAL, "footage");
const VO_DIR = path.join(TUTORIAL, "voiceover");
const OUT = path.join(TUTORIAL, "FOR-LAPTOP");
const ARTIFACTS = "/opt/cursor/artifacts";

const CLIP_ORDER = [
  "01-homepage",
  "02-dashboard",
  "03-properties",
  "04-add-property",
  "05-manage-rent",
  "06-team",
  "07-analytics",
  "08-cta",
];

const CLIP_TRIM = {
  "01-homepage": { ss: 2.0, t: 12 },
  "02-dashboard": { ss: 1.0, t: 28 },
  "03-properties": { ss: 0.4, t: 16 },
  "04-add-property": { ss: 0.6, t: 30 },
  "05-manage-rent": { ss: 5.0, t: 12 },
  "06-team": { ss: 0.4, t: 12 },
  "07-analytics": { ss: 0.4, t: 12 },
  "08-cta": { ss: 0.4, t: 10 },
};

const CLIP_TITLES = [
  "Welcome — nyumbasearch.com",
  "Your dashboard",
  "Properties",
  "Upload a listing",
  "Tenants & rent",
  "Team",
  "Analytics",
  "Get started",
];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function ffprobeDuration(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(parseFloat(out.trim())) : reject(new Error("ffprobe"))));
  });
}

async function ensureVo() {
  await mkdir(VO_DIR, { recursive: true });
  const voMp3 = path.join(VO_DIR, "VO-Chilemba-tutorial.mp3");
  const voTxt = path.join(VO_DIR, "VO-TTS.txt");
  try {
    await access(voTxt);
  } catch {
    const script = await readFile(path.join(TUTORIAL, "SCRIPT.md"), "utf8");
    const blocks = [...script.matchAll(/^### Chapter \d+[^\n]*\n\n([\s\S]*?)(?=\n### |\n---|\n## |$)/gm)];
    const text = blocks.map((m) => m[1].trim()).join("\n\n");
    await writeFile(voTxt, text, "utf8");
  }

  try {
    await access(voMp3);
    const existingDur = await ffprobeDuration(voMp3);
    if (existingDur < 120) {
      console.log("VO too short — regenerating…");
    } else {
      return voMp3;
    }
  } catch {
    /* generate */
  }

  console.log("Generating VO…");
  const edgeTts = process.env.EDGE_TTS ?? path.join(process.env.HOME ?? "", ".local/bin/edge-tts");
  await run(edgeTts, [
    "--voice", "en-KE-ChilembaNeural",
    "--rate=+0%",
    "--pitch=+0Hz",
    "-f", voTxt,
    "--write-media", voMp3,
  ]);
  return voMp3;
}

async function concatClips() {
  await mkdir(OUT, { recursive: true });
  const files = await readdir(FOOTAGE);
  const clips = CLIP_ORDER.map((name) => {
    const f = files.find((x) => x.startsWith(name) && x.endsWith(".webm"));
    if (!f) throw new Error(`Missing footage: ${name}.webm — run npm run tutorial:record`);
    return path.join(FOOTAGE, f);
  });

  const trimmedDir = path.join(FOOTAGE, "trimmed");
  await mkdir(trimmedDir, { recursive: true });
  const trimmed = [];
  for (const src of clips) {
    const base = path.basename(src, ".webm");
    const spec = CLIP_TRIM[base] ?? { ss: 0, t: 30 };
    const dest = path.join(trimmedDir, `${base}.mp4`);
    await run("ffmpeg", [
      "-y",
      "-ss", String(spec.ss),
      "-t", String(spec.t),
      "-i", src,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "20",
      "-an",
      "-pix_fmt", "yuv420p",
      dest,
    ]);
    trimmed.push(dest);
  }

  const chapters = [];
  let t = 0;
  for (let i = 0; i < trimmed.length; i++) {
    chapters.push({ t, title: CLIP_TITLES[i] ?? CLIP_ORDER[i] });
    t += await ffprobeDuration(trimmed[i]);
  }
  await writeFile(path.join(FOOTAGE, "chapters.json"), JSON.stringify(chapters, null, 2), "utf8");

  const listPath = path.join(FOOTAGE, "concat.txt");
  const lines = [];
  for (const f of trimmed) {
    lines.push(`file '${f.replace(/'/g, "'\\''")}'`);
  }
  await writeFile(listPath, lines.join("\n"), "utf8");

  const raw = path.join(OUT, "raw-concat.mp4");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-an", raw]);
  return { raw, chapters };
}

function chapterFilter(chapters) {
  const filters = chapters.map((ch) => {
    const escaped = ch.title.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    return `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${escaped}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=80:enable='between(t,${ch.t},${ch.t + 3.5})':box=1:boxcolor=0x1a1209@0.75:boxborderw=16`;
  });
  return filters.join(",");
}

async function buildMaster(rawVideo, voMp3, chapters) {
  await mkdir(OUT, { recursive: true });
  const voDur = await ffprobeDuration(voMp3);
  const vidDur = await ffprobeDuration(rawVideo);
  console.log(`VO: ${voDur.toFixed(1)}s · Video: ${vidDur.toFixed(1)}s`);

  const master = path.join(OUT, "01-MASTER-16x9-VO.mp4");
  const finalDur = voDur + 1.5;
  const pad = Math.max(0, finalDur - vidDur);

  await run("ffmpeg", [
    "-y",
    "-i", rawVideo,
    "-i", voMp3,
    "-filter_complex",
    `[0:v]tpad=stop_mode=clone:stop_duration=${pad.toFixed(2)},trim=0:${finalDur.toFixed(2)},setpts=PTS-STARTPTS,${chapterFilter(chapters)}[v];[1:a]atrim=0:${finalDur.toFixed(2)},asetpts=PTS-STARTPTS[a]`,
    "-map", "[v]",
    "-map", "[a]",
    "-t", String(finalDur),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "192k",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    master,
  ]);

  const social = path.join(OUT, "02-MASTER-9x16-VO.mp4");
  await run("ffmpeg", [
    "-y",
    "-i", master,
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-c:a", "copy",
    "-movflags", "+faststart",
    social,
  ]);

  await mkdir(ARTIFACTS, { recursive: true });
  await run("cp", [master, path.join(ARTIFACTS, "NyumbaSearch-Manager-Tutorial-16x9.mp4")]);
  await run("cp", [social, path.join(ARTIFACTS, "NyumbaSearch-Manager-Tutorial-9x16.mp4")]);

  return { master, social, voDur };
}

async function main() {
  const voMp3 = await ensureVo();
  const { raw, chapters } = await concatClips();
  const { master, social, voDur } = await buildMaster(raw, voMp3, chapters);
  console.log(`\n✓ 16:9 master: ${master}`);
  console.log(`✓ 9:16 social: ${social}`);
  console.log(`✓ Runtime: ~${Math.round(voDur / 60)} min`);
}

try {
  await main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
