/**
 * Build app/tray/installer icons from assets/icon-brand.png (user brand art).
 * Falls back to sit sprite frame 0 if icon-brand.png is missing.
 * Then run `tauri icon` to emit src-tauri/icons/*.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sitStrip = join(root, "public", "cat", "sit.png");
const assetsDir = join(root, "assets");
const iconBrand = join(assetsDir, "icon-brand.png");
const iconSource = join(assetsDir, "icon-source.png");
const trayIcon = join(root, "public", "cat", "tray-icon.png");

const FRAME = 32;

async function extractSitFrame() {
  return sharp(sitStrip).extract({
    left: 0,
    top: 0,
    width: FRAME,
    height: FRAME,
  });
}

async function main() {
  mkdirSync(assetsDir, { recursive: true });

  if (existsSync(iconBrand)) {
    await sharp(iconBrand)
      .resize(1024, 1024, { fit: "cover", position: "centre" })
      .png()
      .toFile(iconSource);
    await sharp(iconBrand)
      .resize(64, 64, { fit: "cover", position: "centre" })
      .png()
      .toFile(trayIcon);
    console.log("Using assets/icon-brand.png for app + tray icons");
  } else {
    const frame = await extractSitFrame();
    await frame
      .clone()
      .resize(1024, 1024, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(iconSource);
    await frame
      .clone()
      .resize(64, 64, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(trayIcon);
    console.log("Using sit sprite for app + tray icons (add assets/icon-brand.png to override)");
  }

  console.log("Wrote", iconSource);
  console.log("Wrote", trayIcon);

  execSync(`npx tauri icon "${iconSource}"`, {
    cwd: root,
    stdio: "inherit",
  });

  console.log("Updated src-tauri/icons/ (app + installer .ico)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
