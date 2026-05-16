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
  private hitScratch: HTMLCanvasElement | null = null;
  private elapsed = 0;
  private frameIndex = 0;
  private finished = false;
  private currentAnim: string;

  constructor(
    private readonly manifest: SpriteManifest,
    initialAnimation: string,
  ) {
    this.currentAnim = initialAnimation;
    this.padTopPx = SpriteAnimator.computePadTopPx(manifest);
    const scale = manifest.scale;
    this.padBottomPx = (manifest.canvasPadBottom ?? 0) * scale;
    this.padLeftPx = (manifest.canvasPadLeft ?? 14) * scale;
    this.padRightPx = (manifest.canvasPadRight ?? 14) * scale;
  }

  private static computePadTopPx(manifest: SpriteManifest): number {
    const scale = manifest.scale;
    return (manifest.canvasPadTop ?? 28) * scale;
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
  }

  getAnimationName(): string {
    return this.currentAnim;
  }

  update(deltaSeconds: number): void {
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
    ctx.save();
    ctx.globalAlpha = 1;
    this.drawAnimClip(ctx, direction, this.currentAnim, this.frameIndex);
    ctx.restore();
  }

  private drawAnimClip(
    ctx: CanvasRenderingContext2D,
    direction: 1 | -1,
    animKey: string,
    frameIx: number,
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

    const { frameWidth, frameHeight, scale } = this.manifest;
    const drawWidth = frameWidth * scale;
    const drawHeight = frameHeight * scale;
    const feetLineY = ctx.canvas.height - this.padBottomPx - drawHeight;
    const drawY = feetLineY;

    ctx.save();

    if (direction < 0) {
      ctx.translate(this.padLeftPx + drawWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        frameIx * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        drawY,
        drawWidth,
        drawHeight,
      );
    } else {
      ctx.drawImage(
        img,
        frameIx * frameWidth,
        0,
        frameWidth,
        frameHeight,
        this.padLeftPx,
        drawY,
        drawWidth,
        drawHeight,
      );
    }

    ctx.restore();
  }

  getDisplaySize(): { width: number; height: number } {
    const scale = this.manifest.scale;
    const coreW = this.manifest.frameWidth * scale;
    return {
      width: coreW + this.padLeftPx + this.padRightPx,
      height: this.manifest.frameHeight * scale + this.padTopPx + this.padBottomPx,
    };
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
    return (
      this.alphaAtAnimPix(this.currentAnim, this.frameIndex, bx, by, direction) >
      40
    );
  }

  private alphaAtAnimPix(
    animKey: string,
    frameIx: number,
    bx: number,
    by: number,
    direction: 1 | -1,
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

    const { frameWidth, frameHeight, scale } = this.manifest;
    const drawWidth = frameWidth * scale;
    const drawHeight = frameHeight * scale;
    const canvasH = frameHeight * scale + this.padTopPx + this.padBottomPx;
    if (canvasH <= 0) {
      return 0;
    }

    const feetLineY = canvasH - this.padBottomPx - drawHeight;

    if (
      bx < this.padLeftPx ||
      bx >= this.padLeftPx + drawWidth ||
      by < feetLineY ||
      by >= feetLineY + drawHeight
    ) {
      return 0;
    }

    const lx = Math.min(
      frameWidth - 1,
      Math.max(0, Math.floor((bx - this.padLeftPx) / scale)),
    );
    const ly = Math.min(
      frameHeight - 1,
      Math.max(0, Math.floor((by - feetLineY) / scale)),
    );
    const sx = direction >= 0 ? lx : frameWidth - 1 - lx;

    if (!this.hitScratch) {
      this.hitScratch = document.createElement("canvas");
      this.hitScratch.width = frameWidth;
      this.hitScratch.height = frameHeight;
    }
    const hctx = this.hitScratch.getContext("2d", { willReadFrequently: true });
    if (!hctx) {
      return 0;
    }

    hctx.clearRect(0, 0, frameWidth, frameHeight);
    hctx.drawImage(
      img,
      frameIx * frameWidth,
      0,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );

    return hctx.getImageData(sx, ly, 1, 1).data[3];
  }

  private getAnimDef(): AnimationDef | undefined {
    return this.manifest.animations[
      this.currentAnim as keyof typeof this.manifest.animations
    ] as AnimationDef | undefined;
  }
}
