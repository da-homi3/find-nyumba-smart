import sharp from "sharp";

const src =
  process.argv[2] ??
  "C:/Users/ochie/.cursor/projects/c-Users-ochie-OneDrive-Documents-Desktop-nyumbani/assets/c__Users_ochie_AppData_Roaming_Cursor_User_workspaceStorage_6ef3aa3c49dc1c9796b78b9c3db584af_images_Screenshot_2026-07-04_175215-3f7aa728-3143-4737-8afa-ac12dd650a46.png";

// Remove near-black background (decorative pattern) → transparent
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  if (r < 55 && g < 55 && b < 55) {
    out[i + 3] = 0;
  }
}

const transparent = await sharp(out, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 10 })
  .png()
  .toBuffer();

const trimmedMeta = await sharp(transparent).metadata();
console.log("trimmed", trimmedMeta.width, "x", trimmedMeta.height);

const masterSize = 1024;
const master = await sharp(transparent)
  .resize(masterSize, masterSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

async function writeSquare(path, size, solidBg = null) {
  if (!solidBg) {
    await sharp(master)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path);
    console.log("wrote", path);
    return;
  }

  const inset = Math.round(size * 0.86);
  const mark = await sharp(master)
    .resize(inset, inset, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: solidBg,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(path);
  console.log("wrote", path);
}

// Primary logo + icon (icon-only mark)
await writeSquare("public/brand/nyumbasearch-logo.png", 512);
await writeSquare("public/brand/nyumbasearch-icon.png", 256);
await writeSquare("public/brand/icon-192.png", 192);
await writeSquare("public/brand/icon-512.png", 512);
await writeSquare("public/brand/nyumbasearch-mark.png", 1024);

// Favicon / apple-touch on dark plate so white outline stays visible in light UI chrome
await writeSquare("public/favicon.png", 64, { r: 18, g: 18, b: 20, alpha: 1 });
await writeSquare("public/apple-touch-icon.png", 180, { r: 18, g: 18, b: 20, alpha: 1 });

console.log("Brand assets updated");
