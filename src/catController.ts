export interface BoundsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ScreenLayout {
  work_area: BoundsRect;
  monitor: BoundsRect;
  taskbar_height: number;
  feet_y: number;
}

export type DormantAnim = "sit" | "nap";
/** One-shot animations (mode: acting); all except sit, nap, walk */
export type FlourishAnim =
  | "stretch"
  | "look_tilt"
  | "look_lift"
  | "sit_tilt"
  | "happy"
  | "scratch"
  | "alert";

type Mode = "dormant" | "walking" | "acting" | "interacting";
type PendingKind = "walk" | "stretch" | "alert" | "pose" | "goHome" | "act";
type HomeZone = "center" | "midLeft" | "midRight";

/** Random idle performances (all non-looping clips) */
const FLOURISH_WEIGHTS: { value: FlourishAnim; weight: number }[] = [
  { value: "look_tilt", weight: 14 },
  { value: "look_lift", weight: 12 },
  { value: "sit_tilt", weight: 14 },
  { value: "happy", weight: 16 },
  { value: "scratch", weight: 14 },
  { value: "alert", weight: 12 },
  { value: "stretch", weight: 10 },
];

/** Click reactions — every flourish, weighted for variety */
const CLICK_REACTION_WEIGHTS: { value: FlourishAnim; weight: number }[] = [
  { value: "look_tilt", weight: 14 },
  { value: "look_lift", weight: 12 },
  { value: "sit_tilt", weight: 12 },
  { value: "happy", weight: 18 },
  { value: "scratch", weight: 12 },
  { value: "alert", weight: 12 },
  { value: "stretch", weight: 8 },
];

const WALK_ARRIVAL_FLOURISH: FlourishAnim[] = [
  "happy",
  "sit_tilt",
  "look_tilt",
  "look_lift",
  "scratch",
  "alert",
  "stretch",
];

const WALK_EASE_IN_SEC = 0.55;
const WALK_EASE_OUT_SEC = 0.45;
const MIN_SPECIAL_GAP_SEC = 18;
type WalkPurpose = "roam" | "home";

/** High-level temperament for idle planning */
export type PlannerMood = "sleeping" | "wired" | "playful" | "awake" | "tired";

/** Long-run energy — rotates on a session timer */
export type EnergyTier = "tired" | "normal" | "wired";
type PlanKind =
  | "stay"
  | "flourish"
  | "walk"
  | "goHome"
  | "stretch"
  | "alert";

const PLAN_AWAKE: { value: PlanKind; weight: number }[] = [
  { value: "stay", weight: 26 },
  { value: "flourish", weight: 22 },
  { value: "walk", weight: 30 },
  { value: "goHome", weight: 26 },
  { value: "stretch", weight: 5 },
  { value: "alert", weight: 5 },
];

/** Deep nap: barely moves — no roaming */
const PLAN_SLEEPING: { value: PlanKind; weight: number }[] = [
  { value: "stay", weight: 62 },
  { value: "flourish", weight: 16 },
  { value: "walk", weight: 0 },
  { value: "goHome", weight: 0 },
  { value: "stretch", weight: 0 },
  { value: "alert", weight: 5 },
];

const PLAN_PLAYFUL: { value: PlanKind; weight: number }[] = [
  { value: "stay", weight: 12 },
  { value: "flourish", weight: 36 },
  { value: "walk", weight: 28 },
  { value: "goHome", weight: 12 },
  { value: "stretch", weight: 6 },
  { value: "alert", weight: 6 },
];

const PLAN_TIRED: { value: PlanKind; weight: number }[] = [
  { value: "stay", weight: 50 },
  { value: "flourish", weight: 10 },
  { value: "walk", weight: 16 },
  { value: "goHome", weight: 14 },
  { value: "stretch", weight: 5 },
  { value: "alert", weight: 5 },
];

const PLAN_WIRED: { value: PlanKind; weight: number }[] = [
  { value: "stay", weight: 8 },
  { value: "flourish", weight: 42 },
  { value: "walk", weight: 34 },
  { value: "goHome", weight: 6 },
  { value: "stretch", weight: 12 },
  { value: "alert", weight: 12 },
];

const SLEEP_MICRO_FLOURISH: { value: FlourishAnim; weight: number }[] = [
  { value: "look_lift", weight: 18 },
  { value: "sit_tilt", weight: 24 },
  { value: "look_tilt", weight: 26 },
];

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function weightedPick<T extends string>(
  entries: { value: T; weight: number }[],
): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.value;
    }
  }
  return entries[entries.length - 1]!.value;
}

function pickFlourish(): FlourishAnim {
  return weightedPick(FLOURISH_WEIGHTS);
}

function plannerWeightsFor(
  mood: PlannerMood,
): { value: PlanKind; weight: number }[] {
  switch (mood) {
    case "sleeping":
      return PLAN_SLEEPING;
    case "wired":
      return PLAN_WIRED;
    case "playful":
      return PLAN_PLAYFUL;
    case "tired":
      return PLAN_TIRED;
    default:
      return PLAN_AWAKE;
  }
}

function clicksToWakeRoll(): number {
  return 1 + Math.floor(Math.random() * 4);
}

/** After this many qualifying petting clicks (not nap pokes), the cat goes on a long roam. */
const BURST_WALK_AFTER_CLICKS = 8;
/** `walkRemaining` multiplier vs horizontal travel span (screen edge → edge minus pet width). */
const BURST_WALK_DISTANCE_MULT_MIN = 1.12;
const BURST_WALK_DISTANCE_MULT_MAX = 4.65;

export class CatController {
  direction: 1 | -1 = 1;
  x = 0;
  y = 0;

  private mode: Mode = "dormant";
  private currentAnim: string = "sit";
  private actionTimer = randBetween(16, 32);
  private walkRemaining = 0;
  private walkEase = 0;
  private walkPurpose: WalkPurpose = "roam";
  private walkTargetX: number | null = null;
  private readonly walkSpeed: number;
  private readonly petWidthPhysical: number;
  private readonly petHeightPhysical: number;
  private readonly feetLiftPhysical: number;
  private readonly padBottomPhysical: number;
  private pending: PendingKind | null = null;
  private pendingTimer = 0;
  private lastSpecialAt = -MIN_SPECIAL_GAP_SEC;
  private homeX = 0;
  private homeZone: HomeZone = "center";
  private pendingActAnim: FlourishAnim | null = null;
  private playfulSeconds = 0;
  private napWakeClicksNeeded = 0;
  private napWakeClicksUsed = 0;
  /** Replay same clip from frame 0 (petting) */
  private animHardRestart = false;
  private energyTier: EnergyTier = "normal";
  private energySessionSecondsRemaining = 0;
  /** Running count toward `startBurstWalk` (ignored for nap poke-to-wake). */
  private pettingBurstClickCount = 0;

  constructor(
    private layout: ScreenLayout,
    petWidth: number,
    petHeight: number,
    /** Lift in canvas/logical px (scaled to physical for positioning). */
    feetLiftPx = 0,
    /** Window monitor scale (physical ÷ logical). Win32 coords are physical. */
    private readonly displayScale = 1,
    /** Transparent pad below sprite (logical * scaleFactor) — keeps paws on-screen */
    padBottomPxLogical = 0,
  ) {
    this.padBottomPhysical = Math.round(padBottomPxLogical * displayScale);
    this.petWidthPhysical = Math.round(petWidth * displayScale);
    this.petHeightPhysical = Math.round(petHeight * displayScale);
    this.feetLiftPhysical = Math.round(feetLiftPx * displayScale);
    this.walkSpeed = 68 * displayScale;
    this.y = this.anchorY();
    this.pickHomeSpot();
    this.x = this.homeX;
    this.pickDormantPose();
    this.rollEnergySession();
  }

  /** Read-only peek for UX/debug */
  currentEnergyTier(): EnergyTier {
    return this.energyTier;
  }

  setLayout(layout: ScreenLayout): void {
    this.layout = layout;
    this.y = this.anchorY();
    this.clampX();
  }

  currentAnimation(): string {
    return this.currentAnim;
  }

  isInteracting(): boolean {
    return this.mode === "interacting";
  }

  sleepingDeeplyIdle(): boolean {
    return (
      this.mode === "dormant" &&
      this.pending === null &&
      this.currentAnim === "nap"
    );
  }

  onClick(): void {
    if (this.mode === "interacting") {
      return;
    }
    this.clearPending();
    this.walkPurpose = "roam";
    this.walkTargetX = null;

    if (this.sleepingDeeplyIdle()) {
      this.napWakeClicksUsed++;
      if (this.napWakeClicksUsed < this.napWakeClicksNeeded) {
        return;
      }
      this.napWakeClicksUsed = 0;
      this.playfulSeconds += randBetween(28, 52);
      this.mode = "dormant";
      this.currentAnim = "sit";
      this.animHardRestart = true;
      return;
    }

    this.pettingBurstClickCount++;
    if (this.pettingBurstClickCount >= BURST_WALK_AFTER_CLICKS) {
      this.pettingBurstClickCount = 0;
      this.startBurstWalk();
      return;
    }

    this.mode = "interacting";
    this.currentAnim = weightedPick(CLICK_REACTION_WEIGHTS);
    this.walkRemaining = 0;
    this.walkEase = 0;
    this.animHardRestart = true;
  }

  plannerMood(): PlannerMood {
    if (this.sleepingDeeplyIdle()) {
      return "sleeping";
    }
    if (this.energyTier === "wired") {
      return "wired";
    }
    if (
      this.mode === "dormant" &&
      !this.pending &&
      this.playfulSeconds > 0 &&
      !this.sleepingDeeplyIdle()
    ) {
      return "playful";
    }
    if (this.energyTier === "tired") {
      return "tired";
    }
    return "awake";
  }

  consumeAnimHardRestart(): boolean {
    if (!this.animHardRestart) {
      return false;
    }
    this.animHardRestart = false;
    return true;
  }

  update(deltaSeconds: number, animationFinished: boolean): void {
    if (this.pending) {
      this.pendingTimer -= deltaSeconds;
      if (this.pendingTimer <= 0) {
        this.runPending();
      }
      return;
    }

    if (this.mode === "interacting") {
      if (animationFinished) {
        this.queueReturnToDormant(randBetween(0.35, 0.75));
      }
      return;
    }

    if (this.mode === "acting") {
      if (animationFinished) {
        this.queueReturnToDormant(randBetween(0.5, 1.1));
      }
      return;
    }

    if (this.mode === "walking") {
      this.updateWalk(deltaSeconds);
      return;
    }

    // dormant
    if (!this.pending) {
      if (!this.sleepingDeeplyIdle() && this.playfulSeconds > 0) {
        this.playfulSeconds = Math.max(
          0,
          this.playfulSeconds - deltaSeconds,
        );
      }
      this.energySessionSecondsRemaining -= deltaSeconds;
      if (this.energySessionSecondsRemaining <= 0) {
        this.rollEnergySession();
      }
    }

    this.actionTimer -= deltaSeconds;
    if (this.actionTimer <= 0) {
      this.planNextAction();
      this.actionTimer = this.nextPlannerDelay();
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }

  private rollEnergySession(): void {
    this.energyTier = weightedPick([
      { value: "tired", weight: 26 },
      { value: "normal", weight: 46 },
      { value: "wired", weight: 28 },
    ]);
    this.energySessionSecondsRemaining = randBetween(120, 280);
  }

  private anchorY(): number {
    return (
      this.layout.feet_y -
      this.petHeightPhysical -
      this.feetLiftPhysical +
      this.padBottomPhysical
    );
  }

  private pickHomeSpot(): void {
    this.homeZone = weightedPick([
      { value: "center", weight: 52 },
      { value: "midLeft", weight: 24 },
      { value: "midRight", weight: 24 },
    ]);

    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;

    switch (this.homeZone) {
      case "center":
        this.homeX = minX + span * randBetween(0.44, 0.56);
        break;
      case "midLeft":
        this.homeX = minX + span * randBetween(0.22, 0.36);
        break;
      case "midRight":
        this.homeX = minX + span * randBetween(0.64, 0.78);
        break;
    }
  }

  private queueReturnToDormant(delaySeconds: number): void {
    this.mode = "dormant";
    this.pending = "pose";
    this.pendingTimer = delaySeconds;
    this.currentAnim = "sit";
  }

  private clearPending(): void {
    this.pending = null;
    this.pendingTimer = 0;
    this.pendingActAnim = null;
  }

  private runPending(): void {
    const kind = this.pending;
    const actAnim = kind === "act" ? this.pendingActAnim : null;
    this.pending = null;
    this.pendingTimer = 0;
    if (kind !== "act") {
      this.pendingActAnim = null;
    }

    switch (kind) {
      case "walk":
        this.startWalk();
        break;
      case "stretch":
        this.startStretch();
        break;
      case "alert":
        this.startAlert();
        break;
      case "goHome":
        this.startWalkTowardHome();
        break;
      case "pose":
        this.enterDormant();
        break;
      case "act":
        if (actAnim) {
          this.startActing(actAnim);
        }
        break;
      default:
        break;
    }
  }

  /** Queue a one-shot flourish after a short delay (still / sit pose first). */
  private scheduleAct(anim: FlourishAnim, delaySeconds: number): void {
    this.pending = "act";
    this.pendingActAnim = anim;
    this.pendingTimer = delaySeconds;
    this.currentAnim = "sit";
  }

  private enterDormant(): void {
    this.mode = "dormant";
    this.pickDormantPose();
    this.walkRemaining = 0;
    this.walkEase = 0;
  }

  private pickDormantPose(): void {
    let napChance = 0.5;
    if (this.energyTier === "tired") napChance = 0.58;
    else if (this.energyTier === "wired") napChance = 0.18;
    else if (this.energyTier === "normal") napChance = 0.48;

    this.currentAnim = Math.random() < napChance ? "nap" : "sit";
    if (this.currentAnim === "nap") {
      this.napWakeClicksNeeded = clicksToWakeRoll();
      this.napWakeClicksUsed = 0;
    } else {
      this.napWakeClicksNeeded = 0;
      this.napWakeClicksUsed = 0;
    }
  }

  private nextPlannerDelay(): number {
    const mood = this.plannerMood();
    if (mood === "sleeping") {
      return randBetween(42, 82);
    }
    if (mood === "wired") {
      return randBetween(8, 20);
    }
    if (mood === "playful") {
      return randBetween(11, 26);
    }
    if (mood === "tired") {
      return randBetween(38, 76);
    }
    return randBetween(16, 42);
  }

  private scheduleFlourishForMood(): void {
    if (this.plannerMood() === "sleeping") {
      this.scheduleAct(
        weightedPick(SLEEP_MICRO_FLOURISH),
        randBetween(0.5, 1.15),
      );
      return;
    }
    this.scheduleAct(pickFlourish(), randBetween(0.15, 0.58));
  }

  private pickPlanKind(): PlanKind {
    const mood = this.plannerMood();
    let rows = plannerWeightsFor(mood).map((e) => ({ ...e }));

    const now = performance.now() / 1000;
    const specialReady =
      now - this.lastSpecialAt >= MIN_SPECIAL_GAP_SEC;

    if (mood !== "sleeping" && !specialReady) {
      rows = rows.map((r) =>
        r.value === "stretch" || r.value === "alert"
          ? { ...r, weight: 0 }
          : r,
      );
    }

    if (mood !== "sleeping") {
      const atHome =
        Math.abs(this.homeX - this.x) < 24 * this.displayScale;
      if (atHome) {
        rows = rows.map((e) => {
          if (e.value === "goHome") return { ...e, weight: 0 };
          if (e.value === "stay") return { ...e, weight: e.weight + 12 };
          if (e.value === "walk") {
            return { ...e, weight: Math.max(0, e.weight - 6) };
          }
          return e;
        });
      }
    }

    const nonzero = rows.filter((r) => r.weight > 0);
    if (nonzero.length === 0) {
      return "stay";
    }
    return weightedPick(nonzero);
  }

  private startWalk(): void {
    this.mode = "walking";
    this.currentAnim = "walk";
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;
    this.direction = this.x < minX + span * 0.5 ? 1 : -1;
    this.walkRemaining = randBetween(span * 0.45, span * 0.95);
    this.walkEase = 0;
  }

  /** Long scripted roam triggered by sustained petting; direction and distance are randomized. */
  private startBurstWalk(): void {
    this.mode = "walking";
    this.currentAnim = "walk";
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    const { minX, maxX } = this.travelXBounds();
    const span = Math.max(80 * this.displayScale, maxX - minX);
    this.direction = Math.random() < 0.5 ? 1 : -1;
    const mult = randBetween(
      BURST_WALK_DISTANCE_MULT_MIN,
      BURST_WALK_DISTANCE_MULT_MAX,
    );
    this.walkRemaining = span * mult;
    this.walkEase = 0;
    this.animHardRestart = true;
  }

  private startWalkTowardHome(): void {
    if (Math.random() < 0.12) {
      this.pickHomeSpot();
    }
    const { minX, maxX } = this.travelXBounds();
    const target = Math.max(minX, Math.min(maxX, this.homeX));
    const dx = target - this.x;
    const near = Math.max(6, 5 * this.displayScale);
    if (Math.abs(dx) < near) {
      this.enterDormant();
      return;
    }
    this.mode = "walking";
    this.currentAnim = "walk";
    this.walkPurpose = "home";
    this.walkTargetX = target;
    this.walkRemaining = 0;
    this.walkEase = 0;
    this.direction = dx > 0 ? 1 : -1;
  }

  private startStretch(): void {
    this.startActing("stretch");
  }

  private startAlert(): void {
    this.startActing("alert");
  }

  private startActing(anim: FlourishAnim): void {
    this.mode = "acting";
    this.currentAnim = anim;
    const now = performance.now() / 1000;
    if (anim === "stretch" || anim === "alert") {
      this.lastSpecialAt = now;
    }
  }

  private planNextAction(): void {
    const choice = this.pickPlanKind();

    switch (choice) {
      case "stay":
        this.pending = "pose";
        this.pendingTimer = randBetween(
          this.sleepingDeeplyIdle() ? 0.55 : 0.22,
          this.sleepingDeeplyIdle() ? 1.5 : 0.95,
        );
        break;
      case "flourish":
        this.scheduleFlourishForMood();
        break;
      case "goHome":
        this.pending = "goHome";
        this.pendingTimer = randBetween(0.2, 0.5);
        this.currentAnim = "sit";
        break;
      case "walk":
        this.pending = "walk";
        this.pendingTimer = randBetween(0.5, 1.4);
        this.currentAnim = "sit";
        break;
      case "stretch":
        this.pending = "stretch";
        this.pendingTimer = randBetween(0.4, 1.0);
        this.currentAnim = "sit";
        break;
      case "alert":
        this.pending = "alert";
        this.pendingTimer = randBetween(0.35, 0.9);
        this.currentAnim = "sit";
        break;
    }
  }

  private updateWalk(deltaSeconds: number): void {
    if (this.walkEase < 1) {
      this.walkEase = Math.min(
        1,
        this.walkEase + deltaSeconds / WALK_EASE_IN_SEC,
      );
    }

    let ease = this.walkEase;

    const speedFactor = (): number => this.walkSpeed * Math.max(0.15, ease);

    if (this.walkPurpose === "home" && this.walkTargetX != null) {
      const tgt = this.walkTargetX;
      const dx = tgt - this.x;
      const near = Math.max(4, 3 * this.displayScale);
      if (Math.abs(dx) < near) {
        this.x = tgt;
        this.finishWalkingToDormant();
        return;
      }
      this.direction = dx > 0 ? 1 : -1;
      const speed = speedFactor();
      const step = this.direction * speed * deltaSeconds;
      const nextX = this.x + step;
      if (
        (this.direction > 0 && nextX >= tgt) ||
        (this.direction < 0 && nextX <= tgt)
      ) {
        this.x = tgt;
        this.finishWalkingToDormant();
        return;
      }
      this.x = nextX;
      this.clampX();
      return;
    }

    const endDistance = this.walkSpeed * WALK_EASE_OUT_SEC;
    if (this.walkRemaining < endDistance) {
      ease = Math.min(ease, this.walkRemaining / endDistance);
    }

    const speed = this.walkSpeed * Math.max(0.15, ease);
    this.x += this.direction * speed * deltaSeconds;
    this.walkRemaining -= speed * deltaSeconds;
    this.clampX();

    const { minX, maxX } = this.travelXBounds();

    if (this.x <= minX) {
      this.x = minX;
      this.direction = 1;
    } else if (this.x >= maxX) {
      this.x = maxX;
      this.direction = -1;
    }

    if (this.walkRemaining <= 0) {
      this.walkEase = 0;
      this.mode = "dormant";
      if (Math.random() < 0.24) {
        this.scheduleAct(pick(WALK_ARRIVAL_FLOURISH), randBetween(0.08, 0.35));
      } else {
        this.queueReturnToDormant(randBetween(0.4, 0.9));
      }
    }
  }

  private finishWalkingToDormant(): void {
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    this.walkRemaining = 0;
    this.walkEase = 0;
    this.mode = "dormant";
    if (Math.random() < 0.28) {
      this.scheduleAct(pick(WALK_ARRIVAL_FLOURISH), randBetween(0.06, 0.28));
      return;
    }
    this.queueReturnToDormant(randBetween(0.25, 0.55));
  }

  private travelXBounds(): { minX: number; maxX: number } {
    const m = this.layout.monitor;
    return {
      minX: m.left,
      maxX: m.right - this.petWidthPhysical,
    };
  }

  private clampX(): void {
    const { minX, maxX } = this.travelXBounds();
    this.x = Math.max(minX, Math.min(maxX, this.x));
  }
}
