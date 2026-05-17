/**
 * Copy the built installer into release/ for sharing.
 * - Windows: NSIS .exe
 * - macOS: .dmg from bundle/macos
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = join(root, "release");
const bundleRoot = join(root, "src-tauri", "target", "release", "bundle");

function copyFromDir(bundleDir, ext, label) {
  if (!existsSync(bundleDir)) {
    return false;
  }
  const installer = readdirSync(bundleDir).find((name) =>
    name.toLowerCase().endsWith(ext),
  );
  if (!installer) {
    return false;
  }
  mkdirSync(releaseDir, { recursive: true });
  const dest = join(releaseDir, installer);
  cpSync(join(bundleDir, installer), dest, { force: true });
  console.log(`\n${label} ready to share:\n  ${dest}\n`);
  return true;
}

const platform = process.platform;
let copied = false;

if (platform === "win32") {
  copied = copyFromDir(join(bundleRoot, "nsis"), ".exe", "Windows installer");
  if (!copied) {
    console.error(
      `No Windows installer in ${join(bundleRoot, "nsis")}\nRun: npm run package`,
    );
    process.exit(1);
  }
} else if (platform === "darwin") {
  copied = copyFromDir(join(bundleRoot, "macos"), ".dmg", "macOS disk image");
  if (!copied) {
    console.error(
      `No macOS .dmg in ${join(bundleRoot, "macos")}\nRun: npm run package:mac`,
    );
    process.exit(1);
  }
} else {
  console.error(`Unsupported platform for packaging: ${platform}`);
  process.exit(1);
}
