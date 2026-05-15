import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import manifest from "../public/cat/sprites.json";
import { CatController, type WorkArea } from "./catController";
import { SpriteAnimator } from "./spriteAnimator";

async function loadWorkArea(): Promise<WorkArea> {
  return invoke<WorkArea>("get_work_area");
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

  const animator = new SpriteAnimator(manifest, "walk");
  await animator.load();

  const { width, height } = animator.getDisplaySize();
  canvas.width = width;
  canvas.height = height;

  const window = getCurrentWindow();
  await window.setSize(new PhysicalSize(width, height));
  await window.setResizable(false);

  let workArea = await loadWorkArea();
  const cat = new CatController(workArea, width, height);
  cat.x = workArea.left + Math.round((workArea.right - workArea.left) * 0.25);

  const syncWorkArea = async () => {
    workArea = await loadWorkArea();
    cat.setWorkArea(workArea);
  };

  setInterval(() => {
    syncWorkArea().catch(console.error);
  }, 3000);

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    cat.onClick();
    animator.play(cat.currentAnimation(), true);
  });

  let lastFrame = performance.now();
  let lastAnim = "";

  const tick = (now: number) => {
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    const animName = cat.currentAnimation();
    if (animName !== lastAnim) {
      animator.play(animName, true);
      lastAnim = animName;
    }

    animator.update(delta);
    cat.update(delta, animator.isFinished());
    animator.draw(ctx, cat.direction);

    const { x, y } = cat.getPosition();
    void window.setPosition(new PhysicalPosition(x, y));

    requestAnimationFrame(tick);
  };

  animator.play("walk");
  const initial = cat.getPosition();
  await window.setPosition(new PhysicalPosition(initial.x, initial.y));
  requestAnimationFrame(tick);
}

window.addEventListener("DOMContentLoaded", () => {
  startPet().catch((error) => {
    console.error(error);
  });
});
