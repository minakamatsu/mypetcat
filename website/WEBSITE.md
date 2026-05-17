# Desktop Cat landing page (Vercel)

Static site in this folder. Deployed via root `vercel.json` (does **not** build the Tauri app).

## Vercel project settings

If deploy fails or tries to run `npm run build` for the whole app, set in the Vercel dashboard:

| Setting | Value |
|---------|--------|
| **Root Directory** | *(leave empty — repo root)* |
| **Framework Preset** | Other |
| **Build Command** | `node website/scripts/inject-config.mjs` |
| **Output Directory** | `website` |
| **Install Command** | *(empty)* |

Or rely on root `vercel.json` (same values).

## Environment variables (optional)

All optional — defaults work for `minakamatsu/mypetcat` and the bundled installer.

| Variable | Purpose | Default |
|----------|---------|---------|
| `GITHUB_REPO_URL` | Link + clone command on the page | `https://github.com/minakamatsu/mypetcat` |
| `WINDOWS_INSTALLER_URL` | Override Windows download URL (e.g. GitHub Release asset) | `/downloads/Desktop%20Cat_0.1.0_x64-setup.exe` |
| `APP_VERSION` | Shown in the tagline | `0.1.0` |

Set these under **Project → Settings → Environment Variables** for Production (and Preview if you want).

## Updating the Windows installer

1. On Windows: `npm run package`
2. Copy `release/Desktop Cat_*_x64-setup.exe` → `website/downloads/` (same filename or update `inject-config.mjs` default).
3. Commit and push — Vercel redeploys.

The installer (~2 MB) is committed in `website/downloads/` so the download works without GitHub Releases.

## Private vs public GitHub

- **Windows download on this site:** works even if the repo is **private** (file is on Vercel).
- **Mac users cloning from GitHub:** need a **public** repo, or you must add them as collaborators on a private repo.

## Local preview

```powershell
cd desktop-cat
node website/scripts/inject-config.mjs
npx --yes serve website -p 3456
```

Open http://localhost:3456
