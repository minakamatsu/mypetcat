export type CatState = "walking" | "hopping" | "looking";

export interface WorkArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class CatController {
  state: CatState = "walking";
  direction: 1 | -1 = 1;
  x = 0;
  y = 0;
  private lookTimer = 0;

  constructor(
    private workArea: WorkArea,
    private readonly petWidth: number,
    private readonly petHeight: number,
    private readonly walkSpeed = 95,
    private readonly lookDuration = 2,
  ) {
    this.y = workArea.bottom - petHeight;
    this.x = workArea.left;
  }

  setWorkArea(area: WorkArea): void {
    this.workArea = area;
    this.y = area.bottom - this.petHeight;
    this.clampX();
  }

  onClick(): void {
    if (this.state === "walking") {
      this.state = "looking";
      this.lookTimer = this.lookDuration;
    }
  }

  currentAnimation(): "walk" | "jump" | "idle" {
    switch (this.state) {
      case "walking":
        return "walk";
      case "hopping":
        return "jump";
      case "looking":
        return "idle";
    }
  }

  update(deltaSeconds: number, hopAnimationFinished: boolean): void {
    if (this.state === "looking") {
      this.lookTimer -= deltaSeconds;
      if (this.lookTimer <= 0) {
        this.state = "walking";
      }
      return;
    }

    if (this.state === "hopping") {
      if (hopAnimationFinished) {
        this.direction = this.direction === 1 ? -1 : 1;
        this.state = "walking";
      }
      return;
    }

    this.x += this.direction * this.walkSpeed * deltaSeconds;

    const minX = this.workArea.left;
    const maxX = this.workArea.right - this.petWidth;

    if (this.x <= minX) {
      this.x = minX;
      this.state = "hopping";
    } else if (this.x >= maxX) {
      this.x = maxX;
      this.state = "hopping";
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }

  private clampX(): void {
    const minX = this.workArea.left;
    const maxX = this.workArea.right - this.petWidth;
    this.x = Math.max(minX, Math.min(maxX, this.x));
  }
}
