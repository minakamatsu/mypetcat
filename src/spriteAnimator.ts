import type spritesManifest from "../public/cat/sprites.json";

export type SpriteManifest = typeof spritesManifest;

export interface AnimationDef {
  file: string;
  frameCount: number;
  fps: number;
  loop: boolean;
}

export class SpriteAnimator {
  private readonly images = new Map<string, HTMLImageElement>();
  private elapsed = 0;
  private frameIndex = 0;
  private finished = false;
  private currentAnim: string;

  constructor(
    private readonly manifest: SpriteManifest,
    initialAnimation: string,
  ) {
    this.currentAnim = initialAnimation;
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
    const anim = this.manifest.animations[
      this.currentAnim as keyof typeof this.manifest.animations
    ] as AnimationDef | undefined;
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
    const anim = this.manifest.animations[
      this.currentAnim as keyof typeof this.manifest.animations
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

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();

    if (direction < 0) {
      ctx.translate(drawWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      img,
      this.frameIndex * frameWidth,
      0,
      frameWidth,
      frameHeight,
      0,
      0,
      drawWidth,
      drawHeight,
    );

    ctx.restore();
  }

  getDisplaySize(): { width: number; height: number } {
    return {
      width: this.manifest.frameWidth * this.manifest.scale,
      height: this.manifest.frameHeight * this.manifest.scale,
    };
  }
}
