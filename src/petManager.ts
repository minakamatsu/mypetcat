import { CatController, type ScreenLayout } from "./catController";
import { CatEmotionSystem } from "./catEmotions";
import { CatSocialSystem } from "./catSocial";
import { CatRng, seedForCat } from "./rng";
import { SpriteAnimator, type SpriteManifest } from "./spriteAnimator";
import { getSettings } from "./settings";

export interface PetSlot {
  id: number;
  controller: CatController;
  animator: SpriteAnimator;
  lastAnim: string;
}

const DRAG_THRESHOLD_PX = 6;

export class PetManager {
  private cats: PetSlot[] = [];
  private readonly emotions = new CatEmotionSystem();
  private readonly social = new CatSocialSystem(this.emotions);
  private layout: ScreenLayout;
  /** Top-left of the overlay window in screen physical pixels. */
  private windowOrigin = { left: 0, top: 0 };
  private dragCatId: number | null = null;
  private pointerDownCat: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerMoved = false;
  private onDragStarted: (() => void) | null = null;

  constructor(
    private readonly manifest: SpriteManifest,
    private readonly petWidth: number,
    private readonly petHeight: number,
    private readonly feetOffsetPx: number,
    private readonly feetLiftPx: number,
    private readonly displayScale: number,
    layout: ScreenLayout,
  ) {
    this.layout = layout;
    this.rebuildCats(getSettings().catCount);
  }

  setOnDragStarted(handler: () => void): void {
    this.onDragStarted = handler;
  }

  monitorOrigin(): { left: number; top: number } {
    return { left: this.layout.monitor.left, top: this.layout.monitor.top };
  }

  getWindowOrigin(): { left: number; top: number } {
    return this.windowOrigin;
  }

  setWindowOrigin(left: number, top: number): void {
    this.windowOrigin = { left, top };
  }

  monitorSize(): { width: number; height: number } {
    const m = this.layout.monitor;
    return { width: m.right - m.left, height: m.bottom - m.top };
  }

  setLayout(layout: ScreenLayout): void {
    this.layout = layout;
    for (const cat of this.cats) {
      cat.controller.setLayout(layout);
    }
  }

  /** Move every cat back to the floor (e.g. after layout / monitor change). */
  resetCatsToFloor(): void {
    for (const cat of this.cats) {
      cat.controller.snapToFloor();
    }
  }

  getCats(): readonly PetSlot[] {
    return this.cats;
  }

  rebuildCats(count: number): void {
    this.cats = [];
    for (let i = 0; i < count; i++) {
      const rng = new CatRng(seedForCat(i, count * 17));
      const animator = new SpriteAnimator(this.manifest, "sit");
      const controller = new CatController(
        this.layout,
        this.petWidth,
        this.petHeight,
        this.feetOffsetPx,
        rng,
        this.feetLiftPx,
        this.displayScale,
      );
      this.cats.push({
        id: i,
        controller,
        animator,
        lastAnim: "",
      });
    }
    void Promise.all(this.cats.map((c) => c.animator.load()));
  }

  screenToCanvas(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      cx: (clientX - rect.left) * scaleX,
      cy: (clientY - rect.top) * scaleY,
    };
  }

  /** Screen physical coords from pointer event. */
  pointerToScreen(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const { cx, cy } = this.screenToCanvas(clientX, clientY, canvas);
    const origin = this.monitorOrigin();
    return {
      sx: origin.left + cx,
      sy: origin.top + cy,
      cx,
      cy,
    };
  }

  /** Stable back-to-front order: low id behind, dragged cat always on top. */
  private drawOrder(): PetSlot[] {
    const ordered = [...this.cats].sort((a, b) => a.id - b.id);
    if (this.dragCatId == null) {
      return ordered;
    }
    const idx = ordered.findIndex((c) => c.id === this.dragCatId);
    if (idx < 0) {
      return ordered;
    }
    const [dragged] = ordered.splice(idx, 1);
    ordered.push(dragged!);
    return ordered;
  }

  /** True while the user is dragging or holding the mouse on a cat. */
  isCapturingPointer(): boolean {
    return this.pointerDownCat != null;
  }

  isDragging(): boolean {
    return this.dragCatId != null;
  }

  hitTestCat(cx: number, cy: number): PetSlot | null {
    const ordered = this.drawOrder();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const cat = ordered[i]!;
      const origin = this.catCanvasOrigin(cat);
      const lx = cx - origin.x;
      const ly = cy - origin.y;
      if (cat.animator.isOpaqueAtLocal(lx, ly, cat.controller.direction)) {
        return cat;
      }
    }
    return null;
  }

  catCanvasOrigin(cat: PetSlot): { x: number; y: number } {
    return cat.controller.getPosition();
  }

  onPointerDown(clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    const { sx, sy, cx, cy } = this.pointerToScreen(clientX, clientY, canvas);
    const hit = this.hitTestCat(cx, cy);
    if (!hit) {
      return;
    }
    this.pointerDownCat = hit.id;
    this.pointerDownX = sx;
    this.pointerDownY = sy;
    this.pointerMoved = false;
  }

  onPointerMove(clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    if (this.pointerDownCat == null) {
      return;
    }
    const { sx, sy, cx, cy } = this.pointerToScreen(clientX, clientY, canvas);
    const dx = sx - this.pointerDownX;
    const dy = sy - this.pointerDownY;
    if (!this.pointerMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!this.pointerMoved) {
      this.pointerMoved = true;
      const cat = this.cats.find((c) => c.id === this.pointerDownCat);
      if (cat) {
        this.dragCatId = cat.id;
        cat.controller.beginDrag(cx, cy);
        this.onDragStarted?.();
      }
    }
    if (this.dragCatId != null) {
      const cat = this.cats.find((c) => c.id === this.dragCatId);
      cat?.controller.dragTo(cx, cy);
    }
  }

  onPointerUp(_clientX: number, _clientY: number, _canvas: HTMLCanvasElement): void {
    if (this.pointerDownCat == null) {
      return;
    }
    const cat = this.cats.find((c) => c.id === this.pointerDownCat);
    if (cat) {
      if (this.dragCatId != null) {
        cat.controller.endDrag();
      } else if (!this.pointerMoved) {
        cat.controller.onClick();
      }
    }
    this.pointerDownCat = null;
    this.dragCatId = null;
    this.pointerMoved = false;
  }

  update(delta: number): void {
    for (const cat of this.cats) {
      const animName = cat.controller.currentAnimation();
      if (animName !== cat.lastAnim || cat.controller.consumeAnimHardRestart()) {
        cat.animator.play(animName, true);
        cat.animator.resumeAnimation();
        cat.lastAnim = animName;
      }
      cat.animator.update(delta);
      const finished = cat.animator.isFinished();
      if (cat.controller.needsPhysicsUpdate()) {
        cat.controller.update(delta, finished);
      } else if (cat.controller.isSocialLocked()) {
        cat.controller.updateWhileSocial(delta, finished);
      } else if (cat.controller.isPersonalityLocked()) {
        cat.controller.updateWhilePersonality(delta, finished);
      } else {
        cat.controller.update(delta, finished);
      }
    }
    this.emotions.update(this.cats, delta);
    this.social.update(this.cats, delta, this.displayScale);
    for (const cat of this.cats) {
      const animName = cat.controller.currentAnimation();
      if (animName !== cat.lastAnim || cat.controller.consumeAnimHardRestart()) {
        cat.animator.play(animName, true);
        cat.lastAnim = animName;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const cat of this.drawOrder()) {
      const origin = this.catCanvasOrigin(cat);
      cat.animator.drawAt(ctx, origin.x, origin.y, cat.controller.direction);
    }
  }
}
