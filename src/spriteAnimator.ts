export interface ContentBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SpriteManifest {
  frameWidth: number;
  frameHeight: number;
  scale: number;
  anchor?: "bottom" | "top";
  drawOffsetY?: number;
  feetLiftPx?: number;
  canvasPadTop?: number;
  canvasPadBottom?: number;
  canvasPadLeft?: number;
  canvasPadRight?: number;
  /** Tight union of opaque pixels across all frames (source coords). */
  contentBounds?: ContentBounds;
  animations: Record<
    string,
    {
      file: string;
      frameCount: number;
      fps: number;
      loop: boolean;
      drawOffsetY?: number;
    }
  >;
}

export interface AnimationDef {
  file: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  drawOffsetY?: number;
}

export class SpriteAnimator {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly padTopPx: number;
  private readonly padBottomPx: number;
  private readonly padLeftPx: number;
  private readonly padRightPx: number;
  private readonly cropLeft: number;
  private readonly cropTop: number;
  private readonly cropWidth: number;
  private readonly cropHeight: number;
  private hitScratch: HTMLCanvasElement | null = null;
  private elapsed = 0;
  private frameIndex = 0;
  private finished = false;
  private frameFrozen = false;
  private currentAnim: string;

  constructor(
    private readonly manifest: SpriteManifest,
    initialAnimation: string,
  ) {
    this.currentAnim = initialAnimation;
    const scale = manifest.scale;
    this.padTopPx = (manifest.canvasPadTop ?? 2) * scale;
    this.padBottomPx = (manifest.canvasPadBottom ?? 2) * scale;
    this.padLeftPx = (manifest.canvasPadLeft ?? 2) * scale;
    this.padRightPx = (manifest.canvasPadRight ?? 2) * scale;

    const b = manifest.contentBounds;
    if (b) {
      this.cropLeft = b.left;
      this.cropTop = b.top;
      this.cropWidth = b.right - b.left + 1;
      this.cropHeight = b.bottom - b.top + 1;
    } else {
      this.cropLeft = 0;
      this.cropTop = 0;
      this.cropWidth = manifest.frameWidth;
      this.cropHeight = manifest.frameHeight;
    }
  }

  async load(): Promise<void> {
    const files = new Set(
      Object.values(this.manifest.animations).map((a) => a.file),
    );

    await Promise.all(
      [...files].map(
        (file) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(file, img);
              resolve();
            };
            img.onerror = () =>
              reject(new Error(`Failed to load sprite: ${file}`));
            img.src = `/cat/${file}`;
          }),
      ),
    );
  }

  play(name: string, restart = true): void {
    if (!restart && name === this.currentAnim) {
      return;
    }
    this.currentAnim = name;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.finished = false;
    this.frameFrozen = false;
  }

  /** Hold one frame still (e.g. carry pose while dragging). */
  freezeAtFrame(frame = 0): void {
    this.frameIndex = Math.max(0, frame);
    this.elapsed = 0;
    this.frameFrozen = true;
    this.finished = false;
  }

  resumeAnimation(): void {
    this.frameFrozen = false;
  }

  getAnimationName(): string {
    return this.currentAnim;
  }

  update(deltaSeconds: number): void {
    if (this.frameFrozen) {
      return;
    }
    const anim = this.getAnimDef();
    if (!anim) {
      return;
    }

    const frameDuration = 1 / anim.fps;
    this.elapsed += deltaSeconds;

    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      const next = this.frameIndex + 1;
      if (next >= anim.frameCount) {
        if (anim.loop) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = anim.frameCount - 1;
          this.finished = true;
        }
      } else {
        this.frameIndex = next;
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  draw(ctx: CanvasRenderingContext2D, direction: 1 | -1): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.drawAt(ctx, 0, 0, direction);
  }

  /** Draw one cat at canvas position (top-left), without clearing the canvas. */
  drawAt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: 1 | -1,
  ): void {
    const { width, height } = this.getDisplaySize();
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(x, y);
    this.drawAnimClipInBox(
      ctx,
      direction,
      this.currentAnim,
      this.frameIndex,
      width,
      height,
    );
    ctx.restore();
  }

  getDisplaySize(): { width: number; height: number } {
    const { width, height } = this.drawSize();
    return {
      width: width + this.padLeftPx + this.padRightPx,
      height: height + this.padTopPx + this.padBottomPx,
    };
  }

  /** Distance from box top-left to where the paws sit (for floor anchoring). */
  feetOffsetFromBoxTop(): number {
    const { height } = this.drawSize();
    return this.padTopPx + height;
  }

  /** Hit-test in coordinates relative to the cat's top-left (same space as drawAt). */
  isOpaqueAtLocal(lx: number, ly: number, direction: 1 | -1): boolean {
    const { width, height } = this.getDisplaySize();
    const bx = lx;
    const by = ly;
    return (
      this.alphaAtAnimPix(
        this.currentAnim,
        this.frameIndex,
        bx,
        by,
        direction,
        width,
        height,
      ) > 40
    );
  }

  private drawSize(): { width: number; height: number } {
    const scale = this.manifest.scale;
    return {
      width: this.cropWidth * scale,
      height: this.cropHeight * scale,
    };
  }

  private feetLineY(canvasHeight: number): number {
    const { height } = this.drawSize();
    return canvasHeight - this.padBottomPx - height;
  }

  private drawAnimClipInBox(
    ctx: CanvasRenderingContext2D,
    direction: 1 | -1,
    animKey: string,
    frameIx: number,
    _boxWidth: number,
    boxHeight: number,
  ): void {
    const anim = this.manifest.animations[
      animKey as keyof typeof this.manifest.animations
    ] as AnimationDef | undefined;
    if (!anim) {
      return;
    }

    const img = this.images.get(anim.file);
    if (!img) {
      return;
    }

    const { frameWidth } = this.manifest;
    const { width: drawWidth, height: drawHeight } = this.drawSize();
    const drawY = this.feetLineY(boxHeight);

    const srcX = this.cropLeft + frameIx * frameWidth;
    const srcY = this.cropTop;

    ctx.save();

    if (direction < 0) {
      ctx.translate(this.padLeftPx + drawWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        srcX,
        srcY,
        this.cropWidth,
        this.cropHeight,
        0,
        drawY,
        drawWidth,
        drawHeight,
      );
    } else {
      ctx.drawImage(
        img,
        srcX,
        srcY,
        this.cropWidth,
        this.cropHeight,
        this.padLeftPx,
        drawY,
        drawWidth,
        drawHeight,
      );
    }

    ctx.restore();
  }

  isOpaqueAtCss(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    direction: 1 | -1,
  ): boolean {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    const bx = ((clientX - rect.left) / rect.width) * canvas.width;
    const by = ((clientY - rect.top) / rect.height) * canvas.height;
    return this.isOpaqueAtBuffer(bx, by, direction);
  }

  /** @param bx, by — canvas backing-store coordinates */
  isOpaqueAtBuffer(bx: number, by: number, direction: 1 | -1): boolean {
    const { width, height } = this.getDisplaySize();
    return (
      this.alphaAtAnimPix(
        this.currentAnim,
        this.frameIndex,
        bx,
        by,
        direction,
        width,
        height,
      ) > 40
    );
  }

  private alphaAtAnimPix(
    animKey: string,
    frameIx: number,
    bx: number,
    by: number,
    direction: 1 | -1,
    boxWidth: number,
    boxHeight: number,
  ): number {
    const anim = this.manifest.animations[
      animKey as keyof typeof this.manifest.animations
    ] as AnimationDef | undefined;
    if (!anim) {
      return 0;
    }

    const img = this.images.get(anim.file);
    if (!img) {
      return 0;
    }

    const { frameWidth, scale } = this.manifest;
    const { width: drawWidth, height: drawHeight } = this.drawSize();
    if (boxHeight <= 0 || boxWidth <= 0) {
      return 0;
    }

    const drawY = this.feetLineY(boxHeight);

    if (
      bx < this.padLeftPx ||
      bx >= this.padLeftPx + drawWidth ||
      by < drawY ||
      by >= drawY + drawHeight
    ) {
      return 0;
    }

    const lx = Math.min(
      this.cropWidth - 1,
      Math.max(0, Math.floor((bx - this.padLeftPx) / scale)),
    );
    const ly = Math.min(
      this.cropHeight - 1,
      Math.max(0, Math.floor((by - drawY) / scale)),
    );
    const sx = direction >= 0 ? this.cropLeft + lx : this.cropLeft + this.cropWidth - 1 - lx;
    const sy = this.cropTop + ly;

    if (!this.hitScratch) {
      this.hitScratch = document.createElement("canvas");
      this.hitScratch.width = frameWidth;
      this.hitScratch.height = this.manifest.frameHeight;
    }
    const hctx = this.hitScratch.getContext("2d", { willReadFrequently: true });
    if (!hctx) {
      return 0;
    }

    hctx.clearRect(0, 0, frameWidth, this.manifest.frameHeight);
    hctx.drawImage(
      img,
      frameIx * frameWidth,
      0,
      frameWidth,
      this.manifest.frameHeight,
      0,
      0,
      frameWidth,
      this.manifest.frameHeight,
    );

    return hctx.getImageData(sx, sy, 1, 1).data[3];
  }

  private getAnimDef(): AnimationDef | undefined {
    return this.manifest.animations[
      this.currentAnim as keyof typeof this.manifest.animations
    ] as AnimationDef | undefined;
  }
}
