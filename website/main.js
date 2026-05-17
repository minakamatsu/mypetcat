const cfg = window.SITE_CONFIG ?? {
  version: "0.1.0",
  githubRepo: "https://github.com/minakamatsu/mypetcat",
  windowsDownload: "/downloads/Desktop%20Cat_0.1.0_x64-setup.exe",
};

const winBtn = document.getElementById("windows-download");
const repoLink = document.getElementById("github-repo");
const versionEl = document.getElementById("app-version");
const cloneCmd = document.getElementById("clone-cmd");

if (winBtn) {
  winBtn.href = cfg.windowsDownload;
  winBtn.setAttribute("download", "");
}

if (repoLink) {
  repoLink.href = cfg.githubRepo;
  repoLink.textContent = cfg.githubRepo.replace(/^https?:\/\//, "");
}

if (versionEl) versionEl.textContent = `v${cfg.version}`;

if (cloneCmd) {
  const cloneUrl = cfg.githubRepo.endsWith(".git")
    ? cfg.githubRepo
    : `${cfg.githubRepo}.git`;
  cloneCmd.textContent = `git clone ${cloneUrl}`;
}
