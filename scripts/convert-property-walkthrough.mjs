/**
 * Convert a property walkthrough .mov to H.264 MP4, upload to property-media,
 * and update properties.video_url with a fresh signed URL.
 *
 * Usage:
 *   node scripts/convert-property-walkthrough.mjs <propertyId>
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const env = { ...process.env };
  for (const name of [".env", ".env.local"]) {
    const p = path.join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in env) || !env[key]) env[key] = val;
    }
  }
  return env;
}

function propertyMediaPathFromUrl(urlOrPath) {
  const raw = String(urlOrPath ?? "").trim();
  if (!raw) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i.test(raw)) {
    return raw.split("?")[0] ?? raw;
  }
  try {
    const u = new URL(raw);
    const markers = [
      "/object/sign/property-media/",
      "/object/public/property-media/",
      "/object/authenticated/property-media/",
    ];
    for (const marker of markers) {
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) return decodeURIComponent(u.pathname.slice(idx + marker.length));
    }
  } catch {
    return null;
  }
  return null;
}

function resolveFfmpeg(env) {
  if (env.FFMPEG_PATH && existsSync(env.FFMPEG_PATH)) return env.FFMPEG_PATH;
  try {
    const staticPath = require("ffmpeg-static");
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    /* optional */
  }
  for (const candidate of [
    path.join(tmpdir(), "ffmpeg-bin", "ffmpeg.exe"),
    path.join(tmpdir(), "ffmpeg-bin", "ffmpeg"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return "ffmpeg";
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  if (!res.body) throw new Error("Empty download body");
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  const propertyId = process.argv[2];
  if (!propertyId) {
    console.error("Usage: node scripts/convert-property-walkthrough.mjs <propertyId>");
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key);
  const ffmpeg = resolveFfmpeg(env);
  console.log("ffmpeg:", ffmpeg);

  const { data: property, error } = await admin
    .from("properties")
    .select("id, title, owner_id, video_url")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!property) throw new Error("Property not found");
  if (!property.video_url) throw new Error("Property has no video_url");

  console.log("Property:", property.title);
  console.log("Current video:", property.video_url.slice(0, 120));

  const oldPath = propertyMediaPathFromUrl(property.video_url);
  const workDir = path.join(tmpdir(), `nyumba-video-${propertyId}`);
  mkdirSync(workDir, { recursive: true });

  const srcExt = (oldPath?.split(".").pop() || "mov").split("?")[0];
  const srcFile = path.join(workDir, `source.${srcExt}`);
  const outFile = path.join(workDir, "walkthrough.mp4");

  let downloadUrl = property.video_url;
  if (oldPath) {
    const { data: signed, error: signErr } = await admin.storage
      .from("property-media")
      .createSignedUrl(oldPath, 60 * 60);
    if (signErr) console.warn("resign failed, using stored URL:", signErr.message);
    else if (signed?.signedUrl) downloadUrl = signed.signedUrl;
  }

  console.log("Downloading source…");
  await downloadToFile(downloadUrl, srcFile);

  console.log("Transcoding to H.264 MP4…");
  await run(ffmpeg, [
    "-y",
    "-i",
    srcFile,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outFile,
  ]);

  const ownerId = property.owner_id || "unknown";
  const newPath = `${ownerId}/${propertyId}/video-${randomUUID()}.mp4`;
  console.log("Uploading", newPath);

  const bytes = readFileSync(outFile);
  const { error: uploadErr } = await admin.storage.from("property-media").upload(newPath, bytes, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (uploadErr) throw uploadErr;

  const { data: signedOut, error: signedOutErr } = await admin.storage
    .from("property-media")
    .createSignedUrl(newPath, 60 * 60 * 24 * 365);
  if (signedOutErr) throw signedOutErr;
  if (!signedOut?.signedUrl) throw new Error("Could not sign new video");

  const { error: updateErr } = await admin
    .from("properties")
    .update({ video_url: signedOut.signedUrl })
    .eq("id", propertyId);
  if (updateErr) throw updateErr;

  console.log("Updated video_url to MP4.");
  console.log(signedOut.signedUrl.slice(0, 160));

  try {
    unlinkSync(srcFile);
    unlinkSync(outFile);
  } catch {
    /* ignore */
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
