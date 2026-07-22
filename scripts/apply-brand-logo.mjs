/**
 * Apply a finished NyumbaSearch app icon (house + magnifying glass on cocoa brown)
 * to all web + Android brand surfaces.
 *
 * Usage: node scripts/apply-brand-logo.mjs [source-image-path]
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const src =
  process.argv[2] ??
  resolve(root, "scripts/brand-source-icon.jpg");

const cocoa = { r: 74, g: 39, b: 19, alpha: 1 }; // #4A2713 — brand brown

/** Square-crop cover resize (source is slightly non-square JPEG). */
async function squarePng(size) {
  return sharp(src)
    .rotate()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writePng(relPath, buffer) {
  const abs = resolve(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  await sharp(buffer).toFile(abs);
  console.log("wrote", relPath);
}

async function writeResized(relPath, size) {
  await writePng(relPath, await squarePng(size));
}

/** OG / social: icon centered on branded canvas */
async function writeOgImage() {
  const canvasW = 1200;
  const canvasH = 630;
  const mark = await sharp(await squarePng(512))
    .resize(420, 420, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: cocoa.r, g: cocoa.g, b: cocoa.b },
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(resolve(root, "public/og-image.jpg"));
  console.log("wrote public/og-image.jpg");
}

/** Android adaptive: inset mark stays inside the safe zone */
async function writeAndroidIcons() {
  const canvas = 432; // 108dp * 4
  const inset = Math.round(canvas * 0.72);
  const mark = await sharp(await squarePng(inset))
    .resize(inset, inset)
    .png()
    .toBuffer();
  const fg = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: cocoa.r, g: cocoa.g, b: cocoa.b, alpha: 1 },
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
  await writePng("android/app/src/main/res/drawable/ic_launcher_foreground.png", fg);
  await writePng(
    "android/app/src/main/res/drawable/ic_launcher_monochrome.png",
    await sharp(fg).greyscale().png().toBuffer(),
  );

  // Legacy density mipmaps for pre-API-26
  for (const [dir, size] of [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ]) {
    const buf = await squarePng(size);
    await writePng(`android/app/src/main/res/${dir}/ic_launcher.png`, buf);
    await writePng(`android/app/src/main/res/${dir}/ic_launcher_round.png`, buf);
  }

  console.log("android mipmaps + foreground ready");
}

// Keep a high-res master in public/brand
const master = await squarePng(1024);
await writePng("public/brand/nyumbasearch-mark.png", master);
copyFileSync(resolve(root, "public/brand/nyumbasearch-mark.png"), resolve(root, "public/brand/nyumbasearch-logo.png"));
await writeResized("public/brand/nyumbasearch-icon.png", 256);

// Canonical v4 paths (Google requires favicon multiples of 48px)
await writeResized("public/brand/v4/logo.png", 512);
await writeResized("public/brand/v4/icon.png", 256);
await writeResized("public/brand/v4/icon-192.png", 192);
await writeResized("public/brand/v4/icon-512.png", 512);
await writeResized("public/brand/v4/favicon-32.png", 32);
await writeResized("public/brand/v4/favicon-48.png", 48);
await writeResized("public/brand/v4/favicon-96.png", 96);
await writeResized("public/brand/v4/apple-touch-icon.png", 180);
await writeResized("public/favicon-48x48.png", 48);
await writeResized("public/favicon-96x96.png", 96);
await writeResized("public/android-chrome-192x192.png", 192);
await writeResized("public/android-chrome-512x512.png", 512);

// Legacy aliases — keep in sync so stale HTML eventually shows cocoa
await writeResized("public/brand/v3/logo.png", 512);
await writeResized("public/brand/logo-cocoa.png", 512);
await writeResized("public/brand/icon-cocoa.png", 256);
await writeResized("public/brand/icon-192-cocoa.png", 192);
await writeResized("public/brand/icon-512-cocoa.png", 512);
await writeResized("public/favicon-cocoa.png", 64);
await writeResized("public/apple-touch-icon-cocoa.png", 180);
await writeResized("public/brand/logo-mark.png", 512);
await writeResized("public/brand/icon-mark.png", 256);
await writeResized("public/brand/icon-192-mark.png", 192);
await writeResized("public/brand/icon-512-mark.png", 512);
await writeResized("public/favicon-mark.png", 64);
await writeResized("public/apple-touch-icon-mark.png", 180);
await writeResized("public/brand/icon-192.png", 192);
await writeResized("public/brand/icon-512.png", 512);
await writeResized("public/favicon.png", 64);
await writeResized("public/apple-touch-icon.png", 180);

await writeOgImage();
await writeAndroidIcons();

console.log("Brand assets updated from", src);
console.log("Suggested theme color: #4A2713");
