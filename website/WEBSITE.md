# Desktop Cat landing page (Vercel)

Static site in this folder. Deployed via root `vercel.json` (does **not** build the Tauri app).

API routes in `/api` handle **download click counting** and redirects.

## Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | *(repo root)* |
| **Framework Preset** | Other |
| **Build Command** | `node website/scripts/inject-config.mjs` |
| **Output Directory** | `website` |
| **Install Command** | *(empty)* |

## Download click tracking

The Windows button links to **`/api/download`**, which:

1. Increments a counter in **Vercel KV** (if connected)
2. Redirects to the `.exe` in `website/downloads/`

### Step 1 — Add Upstash Redis (required for counts)

**Vercel KV no longer exists.** Use Upstash instead (free tier is fine):

1. Open **[Upstash for Redis on the Vercel Marketplace](https://vercel.com/marketplace/upstash)**
2. Click **Install** → pick your **Desktop Cat** Vercel project
3. Choose the **Free** plan, name the database, create it
4. Make sure it is **connected** to the project (adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)
5. **Redeploy** the site

Alternative path: Project → **Storage** tab → **Browse Storage** / **Create Database** → pick **Upstash Redis** (not “KV”).

### Step 2 — See how many downloads

Set a secret so only you can read stats:

| Variable | Example | Purpose |
|----------|---------|---------|
| `STATS_SECRET` | `my-long-random-string` | Protects `/api/stats` |

Then open (replace with your domain and secret):

```text
https://YOUR-SITE.vercel.app/api/stats?key=my-long-random-string
```

Response:

```json
{ "downloads": 42 }
```

### Optional — Google Analytics (graphs & more detail)

1. [Google Analytics](https://analytics.google.com/) → create property → copy **Measurement ID** (`G-XXXXXXXX`)
2. Vercel → **Environment Variables** → `GA_MEASUREMENT_ID` = `G-XXXXXXXX`
3. Redeploy

In GA: **Reports → Engagement → Events** → look for `download_click`.

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GITHUB_REPO_URL` | Link + clone command | `https://github.com/minakamatsu/mypetcat` |
| `WINDOWS_INSTALLER_URL` | Skip `/api/download` and link elsewhere (no KV count) | `/api/download` → then `.exe` |
| `APP_VERSION` | Tagline version | `0.1.0` |
| `GA_MEASUREMENT_ID` | Google Analytics | *(off)* |
| `STATS_SECRET` | Password for `/api/stats` | *(public stats if unset)* |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Auto-set when Upstash is linked | — |

## Updating the Windows installer

1. On Windows: `npm run package`
2. Copy `release/Desktop Cat_*_x64-setup.exe` → `website/downloads/`
3. Commit and push

## Local preview

```powershell
cd desktop-cat
node website/scripts/inject-config.mjs
npx --yes serve website -p 3456
```

`/api/download` only works on Vercel (or `vercel dev`), not plain `serve`.
