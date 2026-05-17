# Building Desktop Cat for macOS (share with Mac friends)

## Important: Windows installer ≠ Mac

The Windows file (`Desktop Cat_*_x64-setup.exe`) is **only for Windows PCs**.

- **x64** here means **Windows 64-bit**, not Mac.
- MacBooks need a **`.dmg`** built on **macOS** (Apple Silicon or Intel Mac).

You **cannot** build a Mac `.dmg` from your Windows PC. Use a Mac (yours or a friend's) once, then share the `.dmg` file.

## On a Mac (one-time setup)

1. Install [Node.js](https://nodejs.org/) (LTS).
2. Install [Rust](https://www.rust-lang.org/tools/install).
3. Install [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/):
   ```bash
   xcode-select --install
   ```
4. Clone or copy this `desktop-cat` folder onto the Mac.

## Build the shareable `.dmg`

```bash
cd desktop-cat
npm install
npm run sprites
npm run package:mac
```

The file to send friends appears in:

`release/Desktop Cat_0.1.0_aarch64.dmg` (Apple Silicon)

or

`release/Desktop Cat_0.1.0_x64.dmg` (Intel Mac)

Share **the `.dmg` built on the same chip family** when possible (M1/M2/M3 friends → build on Apple Silicon; older Intel Mac friends → build on Intel). Universal builds are possible but slower to produce.

## What friends do on Mac

1. Open the `.dmg` you sent.
2. Drag **Desktop Cat** into Applications.
3. First launch: **Right-click → Open** if macOS says the app is from an unidentified developer (unsigned indie app).
4. Tray icon (menu bar): **Start with Windows** is labeled **Start at login** on Mac; use **Quit Desktop Cat** to exit.

## Optional: fewer security warnings

Apple code signing + notarization requires a paid [Apple Developer](https://developer.apple.com/) account ($99/year). Not required for friends who trust you and use Right-click → Open.
