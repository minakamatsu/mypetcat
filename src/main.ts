import { invoke } from "@tauri-apps/api/core";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CatController, type ScreenLayout } from "./catController";
import { SpriteAnimator, type SpriteManifest } from "./spriteAnimator";

async function loadSpriteManifest(): Promise<SpriteManifest> {
  const res = await fetch("/cat/sprites.json");
  if (!res.ok) {
    throw new Error(`Failed to load sprites.json: ${res.status}`);
  }
  return res.json() as Promise<SpriteManifest>;
}

async function loadScreenLayout(): Promise<ScreenLayout> {
  return invoke<ScreenLayout>("get_screen_layout");
}

/** Keep the pet above all other windows (re-applied periodically and on focus loss). */
async function keepOnTop(): Promise<void> {
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(true);
  try {
    await invoke("ensure_topmost");
  } catch {
    // setAlwaysOnTop above is sufficient if the Rust helper fails.
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
  const manifest = await loadSpriteManifest();
  const animator = new SpriteAnimator(manifest, "sit");
  await animator.load();

  const { width, height } = animator.getDisplaySize();
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const displayScale = await window.scaleFactor();
  await window.setSize(new LogicalSize(width, height));
  await window.setResizable(false);

  let layout = await loadScreenLayout();
  const feetLiftPx = (manifest.feetLiftPx ?? 0) * manifest.scale;
  const padBottomLogical =
    (manifest.canvasPadBottom ?? 0) * manifest.scale;
  const cat = new CatController(
    layout,
    width,
    height,
    feetLiftPx,
    displayScale,
    padBottomLogical,
  );

  const syncLayout = async () => {
    const next = await loadScreenLayout();
    layout = next;
    cat.setLayout(next);
  };

  setInterval(() => {
    syncLayout().catch(console.error);
  }, 3000);

  canvas.addEventListener("pointerdown", (event) => {
    if (
      !animator.isOpaqueAtCss(
        event.clientX,
        event.clientY,
        canvas,
        cat.direction,
      )
    ) {
      return;
    }
    event.preventDefault();
    cat.onClick();
  });

  let lastFrame = performance.now();
  let lastAnim = "";
  let topmostCounter = 0;

  const tick = (now: number) => {
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    const animName = cat.currentAnimation();
    if (animName !== lastAnim || cat.consumeAnimHardRestart()) {
      animator.play(animName, true);
      lastAnim = animName;
    }

    animator.update(delta);
    cat.update(delta, animator.isFinished());
    animator.draw(ctx, cat.direction);

    const { x, y } = cat.getPosition();
    void window.setPosition(new PhysicalPosition(x, y)).then(() => {
      if (++topmostCounter % 45 === 0) {
        keepOnTop().catch(console.error);
      }
    });

    requestAnimationFrame(tick);
  };

  const initial = cat.getPosition();
  await window.setPosition(new PhysicalPosition(initial.x, initial.y));
  await keepOnTop();
  await window.show();
  await keepOnTop();

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
    const canvas = document.getElementById("pet");
    if (canvas instanceof HTMLCanvasElement) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 320;
        canvas.height = 48;
        ctx.fillStyle = "#ff6b6b";
        ctx.font = "12px sans-serif";
        ctx.fillText(String(error), 4, 20);
      }
    }
  });
});
