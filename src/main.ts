import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { initClickThrough, syncClickThrough } from "./clickThrough";
import { PetManager } from "./petManager";
import { resolveScreenLayout } from "./screenLayout";
import { SpriteAnimator, type SpriteManifest } from "./spriteAnimator";
import {
  mountSettingsPanel,
  toggleVisible,
  syncSettingsPanelFromStorage,
} from "./settingsPanel";
import { initLaunchAtStartup, refreshTray, setupTray } from "./traySetup";

async function loadSpriteManifest(): Promise<SpriteManifest> {
  const res = await fetch("/cat/sprites.json");
  if (!res.ok) {
    throw new Error(`Failed to load sprites.json: ${res.status}`);
  }
  return res.json() as Promise<SpriteManifest>;
}

async function keepOnTop(): Promise<void> {
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(true);
  try {
    await invoke("ensure_topmost");
  } catch {
    // setAlwaysOnTop is enough if Rust helper fails.
  }
}

async function startPet(): Promise<void> {
  const canvas = document.getElementById("pet");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing #pet canvas");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D canvas context");
  }

  const window = getCurrentWindow();
  await window.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });

  const manifest = await loadSpriteManifest();
  const probe = new SpriteAnimator(manifest, "sit");
  await probe.load();

  const petSize = probe.getDisplaySize();
  const displayScale = await window.scaleFactor();

  let layout = await resolveScreenLayout();

  const manager = new PetManager(
    manifest,
    petSize.width,
    petSize.height,
    probe.feetOffsetFromBoxTop(),
    (manifest.feetLiftPx ?? 0) * manifest.scale,
    displayScale,
    layout,
  );

  await Promise.all(manager.getCats().map((c) => c.animator.load()));

  manager.setOnDragStarted(() => {
    keepOnTop().catch(console.error);
  });

  const resizeOverlay = async () => {
    layout = await resolveScreenLayout();
    manager.setLayout(layout);

    const scale = await window.scaleFactor();
    // Full monitor overlay so the cat can render above the taskbar when dragged.
    // Floor line still uses work_area (desktop surface above taskbar).
    const m = layout.monitor;
    const winLeft = m.left;
    const winTop = m.top;
    const winWidth = m.right - m.left;
    const winHeight = m.bottom - m.top;

    manager.setWindowOrigin(winLeft, winTop);

    canvas.width = winWidth;
    canvas.height = winHeight;
    canvas.style.width = `${winWidth / scale}px`;
    canvas.style.height = `${winHeight / scale}px`;

    await window.setSize(new PhysicalSize(winWidth, winHeight));
    await window.setPosition(new PhysicalPosition(winLeft, winTop));
    manager.resetCatsToFloor();
  };

  await keepOnTop();
  await window.show();

  const applyCatCount = (count: number) => {
    manager.rebuildCats(count);
    void Promise.all(manager.getCats().map((c) => c.animator.load())).then(() => {
      void resizeOverlay();
    });
    void refreshTray();
  };

  mountSettingsPanel(applyCatCount);

  try {
    await initLaunchAtStartup();
    await setupTray({
      onOpenSettings: () => {
        syncSettingsPanelFromStorage();
        toggleVisible();
      },
      onResetCats: () => {
        void resizeOverlay();
      },
      onCatCountChange: applyCatCount,
    });
  } catch (err) {
    console.warn("Tray / autostart setup failed (pet still runs):", err);
  }

  await resizeOverlay();

  const syncLayout = async () => {
    await resizeOverlay();
  };

  setInterval(() => {
    syncLayout().catch(console.error);
  }, 3000);

  canvas.addEventListener("pointerdown", (e) => {
    manager.onPointerDown(e.clientX, e.clientY, canvas);
    e.preventDefault();
  });
  globalThis.addEventListener("pointermove", (e: PointerEvent) => {
    manager.onPointerMove(e.clientX, e.clientY, canvas);
  });
  globalThis.addEventListener("pointerup", (e: PointerEvent) => {
    manager.onPointerUp(e.clientX, e.clientY, canvas);
  });

  let lastFrame = performance.now();
  let topmostCounter = 0;

  const tick = (now: number) => {
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    manager.update(delta);
    manager.draw(ctx);
    void syncClickThrough(manager);

    if (manager.isDragging() || ++topmostCounter % 30 === 0) {
      keepOnTop().catch(console.error);
    }

    requestAnimationFrame(tick);
  };

  await keepOnTop();

  setTimeout(() => {
    void initClickThrough();
  }, 400);

  setInterval(() => {
    keepOnTop().catch(console.error);
  }, 2000);

  void window.onFocusChanged(({ payload: focused }) => {
    if (!focused) {
      keepOnTop().catch(console.error);
    }
  });

  requestAnimationFrame(tick);
}

window.addEventListener("DOMContentLoaded", () => {
  startPet().catch((error) => {
    console.error(error);
  });
});
