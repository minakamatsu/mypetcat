# Desktop Cat

A small Windows desktop pet built with **Tauri 2**. A cat walks along the bottom of your screen, hops at the edges, and reacts when you click it. The window stays on top of other apps and uses a transparent background.

## Features

- Walk, nap, and playful idle animations along the screen bottom
- Click the cat to interact (petting, wake from nap, and more)
- Always-on-top, frameless, transparent window
- **Multiple cats (1–8)** in one app — one tray icon, not one icon per cat
- **System tray** — set cat count, settings, quit, **Start with Windows**
- **Installer** — share a single `.exe` setup file with friends

## Windows vs Mac — different files

| Platform | File to share | Built with |
|----------|---------------|------------|
| **Windows** | `Desktop Cat_*_x64-setup.exe` | `npm run package` on Windows |
| **Mac** | `Desktop Cat_*.dmg` | `npm run package:mac` **on a Mac** |

The Windows `.exe` does **not** work on MacBooks (`x64` means Windows 64-bit). See **[BUILD-MAC.md](BUILD-MAC.md)** for Mac build steps.

## For friends (install only)

### Windows

1. Get the installer file (for example `Desktop Cat_0.1.0_x64-setup.exe`).
2. Double-click it and complete setup.
3. The cat appears on your desktop. It is set to **start with Windows** by default.
4. **Tray icon** (near the clock): right-click for options.
   - **Number of cats** — pick 1–8 (applies instantly). Lower the number to remove cats.
   - **Cat settings…** — slider and **− / +** buttons, then **Apply**.
   - Uncheck **Start at login** if you do not want it at startup.
   - **Quit Desktop Cat** closes the whole app.
5. **Do not** open the desktop shortcut multiple times for more cats — that used to spawn extra tray icons. Use the tray menu instead.

Windows may show a SmartScreen warning for unsigned apps from individuals — use **More info** → **Run anyway** if you trust whoever sent the file.

### Mac

1. Get the `.dmg` file (built on a Mac — not the Windows `.exe`).
2. Open the `.dmg` and drag **Desktop Cat** to Applications.
3. First launch: if blocked, **right-click the app → Open**.
4. Menu bar icon: toggle login startup or quit. See [BUILD-MAC.md](BUILD-MAC.md) if you are building the `.dmg` yourself.

## For you (build & share)

### Prerequisites

1. [Node.js](https://nodejs.org/) (LTS)
2. [Rust](https://www.rust-lang.org/tools/install)
3. [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/) (Visual Studio C++ Build Tools with MSVC)

### Setup

```powershell
cd desktop-cat
npm install
npm run sprites
```

### Development

```powershell
npm run tauri dev
```

### Build a shareable installer

```powershell
npm run package
```

This runs a production build and copies the NSIS installer into [`release/`](release/) (for example `Desktop Cat_0.1.0_x64-setup.exe`). **Send that one file** to friends.

The installer is also at:

`src-tauri/target/release/bundle/nsis/`

**Note:** Building requires the MSVC linker. If `link.exe` is not found, use **x64 Native Tools Command Prompt for VS 2022** or a shell where Visual Studio Build Tools are on `PATH`.

## Controls

- **Click** the cat (on its pixels) to interact.
- **Drag** a cat to move it; it falls back to the screen bottom when released.
- **Tray menu** — **Number of cats** (1–8), **Cat settings…**, reset to bottom, start at login, quit.

## Project layout

| Path | Purpose |
|------|---------|
| `src/main.ts` | App loop, window positioning |
| `src/catController.ts` | Behavior / mood state machine |
| `src/spriteAnimator.ts` | Sprite sheet playback |
| `src/traySetup.ts` | Tray icon + startup toggle |
| `src/settings.ts` | Saved preferences (localStorage) |
| `public/cat/` | Sprite PNG strips and `sprites.json` |
| `assets/source/Cat_Grey.aseprite` | Source art (Aseprite) |
| `src-tauri/src/lib.rs` | Screen layout + topmost window |
| `scripts/export-sprites-from-aseprite.mjs` | Export runtime sprites |
| `scripts/copy-installer.mjs` | Copy installer to `release/` |

## License

Application code: use as you like for personal/class projects. See [assets/CREDITS.md](assets/CREDITS.md) for sprite licensing.
