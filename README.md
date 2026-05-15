# Desktop Cat

A small Windows desktop pet built with **Tauri 2**. A cat walks along the bottom of your screen (above the taskbar), hops at the edges, and looks at you when clicked. The window stays on top of other apps and uses a transparent background.

## Features

- Walk animation along the screen bottom
- Hop animation when reaching the left or right edge
- Click the cat to stop and play a “look at you” idle animation
- Always-on-top, frameless, transparent window

## Prerequisites

1. [Node.js](https://nodejs.org/) (LTS)
2. [Rust](https://www.rust-lang.org/tools/install) (`rustup` on Windows)
3. [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/) (Visual Studio C++ Build Tools with MSVC)

## Setup

```powershell
cd desktop-cat
npm install
npm run sprites
```

Sprites are exported from `assets/source/Cat_Grey.aseprite` into `public/cat/`. Edit the Aseprite file, then run `npm run sprites` again. See [assets/CREDITS.md](assets/CREDITS.md) for tag mapping.

## Development

```powershell
npm run tauri dev
```

## Build installer (downloadable `.exe`)

```powershell
npm run tauri build
```

The Windows installer is created under:

`src-tauri/target/release/bundle/nsis/`

A copy is also placed in [`release/`](release/) after a successful build (for example `Desktop Cat_0.1.0_x64-setup.exe`). Share that file to install on other PCs.

**Note:** Building requires the MSVC linker. If `link.exe` is not found, open **x64 Native Tools Command Prompt for VS 2022** or run the build from a shell where Visual Studio Build Tools are on `PATH`.

## Controls

- **Click** the cat while it is walking to make it stop and look at you for about two seconds, then it resumes walking.

## Project layout

| Path | Purpose |
|------|---------|
| `src/main.ts` | App loop, window positioning |
| `src/catController.ts` | Walk / hop / look state machine |
| `src/spriteAnimator.ts` | Sprite sheet playback |
| `public/cat/` | Sprite PNG strips and `sprites.json` |
| `assets/source/Cat_Grey.aseprite` | Source art (Aseprite) |
| `src-tauri/src/lib.rs` | `get_work_area` (Windows taskbar-aware bounds) |
| `scripts/export-sprites-from-aseprite.mjs` | Export runtime sprites from Aseprite |

## License

Application code: use as you like for personal/class projects. See [assets/CREDITS.md](assets/CREDITS.md) for sprite licensing.
