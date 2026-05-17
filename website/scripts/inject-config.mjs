import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const config = {
  version: process.env.APP_VERSION || "0.1.0",
  githubRepo:
    process.env.GITHUB_REPO_URL || "https://github.com/minakamatsu/mypetcat",
  windowsDownload:
    process.env.WINDOWS_INSTALLER_URL ||
    "/downloads/Desktop%20Cat_0.1.0_x64-setup.exe",
};

writeFileSync(
  join(root, "config.js"),
  `window.SITE_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
  "utf8",
);

console.log("Wrote website/config.js", config);
