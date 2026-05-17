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
  | "alert"
  | "angry";

type Mode =
  | "intro"
  | "dormant"
  | "walking"
  | "acting"
  | "interacting"
  | "dragging"
  | "falling";
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

import type { CatRng } from "./rng";

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

const INTRO_SIT_CHANCE = 0.38;
const FALL_GRAVITY = 2800;
const FALL_MAX_VY = 2200;

/** After this many qualifying petting clicks (not nap pokes), the cat goes on a long roam. */
const BURST_WALK_AFTER_CLICKS = 8;
/** `walkRemaining` multiplier vs horizontal travel span (screen edge → edge minus pet width). */
const BURST_WALK_DISTANCE_MULT_MIN = 1.12;
const BURST_WALK_DISTANCE_MULT_MAX = 4.65;

/** Per-cat walk/roam speed multiplier (subtle spread around baseline). */
const SPEED_TRAIT_MIN = 0.9;
const SPEED_TRAIT_MAX = 1.1;
/** Extra spread while `currentAnim === "run"` (chase, emotion sprints). */
const RUN_TRAIT_MIN = 0.92;
const RUN_TRAIT_MAX = 1.08;

export class CatController {
  direction: 1 | -1 = 1;
  x = 0;
  y = 0;

  private mode: Mode = "intro";
  private currentAnim: string = "sit";
  private actionTimer = 0;
  private introSecondsLeft = 0;
  private fallVelocityY = 0;
  private dragGrabOffsetY = 0;
  private walkRemaining = 0;
  private walkEase = 0;
  private walkPurpose: WalkPurpose = "roam";
  private walkTargetX: number | null = null;
  private readonly walkSpeed: number;
  /** Per-cat pace (walk + run base). */
  private readonly speedTrait: number;
  /** Extra variance when using the run sprite. */
  private readonly runTrait: number;
  /** Sprite draw box (manifest scale), matches canvas pixel space 1:1. */
  private readonly petDrawWidth: number;
  /** Paws sit this many px below the box top-left. */
  private readonly feetOffsetPx: number;
  private readonly feetLiftPx: number;
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
  private socialLocked = false;
  private socialAwaitFinish = false;
  private personalityLocked = false;
  private personalityAwaitFinish = false;
  /** Faster roam while `currentAnim === "run"`. */
  private walkSpeedBoost = 1;
  private readonly rng: CatRng;

  constructor(
    private layout: ScreenLayout,
    petWidth: number,
    _petHeight: number,
    feetOffsetPx: number,
    rng: CatRng,
    feetLiftPx = 0,
    /** Window monitor scale — used for walk speed only. */
    private readonly displayScale = 1,
  ) {
    this.rng = rng;
    this.petDrawWidth = Math.round(petWidth);
    this.feetOffsetPx = Math.round(feetOffsetPx);
    this.feetLiftPx = Math.round(feetLiftPx);
    this.speedTrait = this.rb(SPEED_TRAIT_MIN, SPEED_TRAIT_MAX);
    this.runTrait = this.rb(RUN_TRAIT_MIN, RUN_TRAIT_MAX);
    this.walkSpeed = (58 + this.rb(0, 18)) * displayScale;
    this.actionTimer = this.rb(14, 38);
    this.y = this.anchorY();
    this.rollEnergySession();
    this.energySessionSecondsRemaining += this.rb(0, 90);
    this.lastSpecialAt = -MIN_SPECIAL_GAP_SEC + this.rb(0, MIN_SPECIAL_GAP_SEC);
    this.beginIntro();
  }

  private rb(min: number, max: number): number {
    return this.rng.randBetween(min, max);
  }

  private wp<T extends string>(
    entries: { value: T; weight: number }[],
  ): T {
    return this.rng.weightedPick(entries);
  }

  private pk<T>(items: readonly T[]): T {
    return this.rng.pick(items);
  }

  isDragging(): boolean {
    return this.mode === "dragging";
  }

  isFalling(): boolean {
    return this.mode === "falling";
  }

  needsPhysicsUpdate(): boolean {
    return this.mode === "dragging" || this.mode === "falling";
  }

  beginDrag(canvasX: number, canvasY: number): void {
    this.clearPending();
    this.mode = "dragging";
    this.currentAnim = "sit";
    this.animHardRestart = true;
    this.dragGrabOffsetY = canvasY - this.y;
    this.x = canvasX - this.petDrawWidth / 2;
    this.clampX();
  }

  dragTo(canvasX: number, canvasY: number): void {
    if (this.mode !== "dragging") {
      return;
    }
    this.x = canvasX - this.petDrawWidth / 2;
    this.y = canvasY - this.dragGrabOffsetY;
    this.clampX();
  }

  endDrag(): void {
    if (this.mode !== "dragging") {
      return;
    }
    const floor = this.anchorY();
    if (this.y >= floor - 2) {
      this.y = floor;
      this.enterDormant();
      return;
    }
    this.mode = "falling";
    this.fallVelocityY = 0;
    this.currentAnim = "walk";
  }

  private beginIntro(): void {
    this.introSecondsLeft = this.rb(1.85, 3.15);
    this.pickHomeSpot();
    this.x = this.pickIntroSpawnX();

    if (this.rng.chance(INTRO_SIT_CHANCE)) {
      this.mode = "intro";
      this.currentAnim = "sit";
      this.homeX = this.x;
      return;
    }

    this.mode = "intro";
    this.currentAnim = "walk";
    this.walkPurpose = "home";
    this.walkTargetX = this.homeX;
    this.walkEase = 0;
    this.walkRemaining = 0;
    this.direction = this.x < this.homeX ? 1 : -1;
  }

  /** Start near the middle of the screen so the cat is easy to spot. */
  private pickIntroSpawnX(): number {
    const { minX, maxX } = this.travelXBounds();
    const span = Math.max(8, maxX - minX);
    const center = minX + span * 0.5 - this.petDrawWidth * 0.5;
    return Math.max(minX, Math.min(maxX, center + this.rb(-span * 0.08, span * 0.08)));
  }

  private updateIntro(deltaSeconds: number): void {
    this.introSecondsLeft -= deltaSeconds;

    if (this.currentAnim === "walk" && this.walkTargetX != null) {
      const prev = this.mode;
      this.mode = "walking";
      this.updateWalk(deltaSeconds);
      this.mode = prev;
    }

    const nearHome =
      Math.abs(this.x - this.homeX) < Math.max(8, 6 * this.displayScale);
    if (this.introSecondsLeft <= 0 || (this.currentAnim === "walk" && nearHome)) {
      this.enterDormant();
    }
  }

  private updateFall(deltaSeconds: number): void {
    const floor = this.anchorY();
    this.fallVelocityY = Math.min(
      FALL_MAX_VY,
      this.fallVelocityY + FALL_GRAVITY * deltaSeconds,
    );
    this.y += this.fallVelocityY * deltaSeconds;

    if (this.y >= floor) {
      this.y = floor;
      this.fallVelocityY = 0;
      this.mode = "dormant";
      this.currentAnim = "sit";
      this.animHardRestart = true;
      this.pickHomeSpot();
      this.homeX = this.x;
    }
  }

  /** Read-only peek for UX/debug */
  currentEnergyTier(): EnergyTier {
    return this.energyTier;
  }

  setLayout(layout: ScreenLayout): void {
    this.layout = layout;
    if (this.mode !== "dragging" && this.mode !== "falling") {
      this.y = this.anchorY();
    }
    this.clampX();
  }

  snapToFloor(): void {
    if (this.mode === "dragging" || this.mode === "falling") {
      return;
    }
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

  /** `nap_wake` when a deep nap ends from clicking. */
  onClick(): "nap_wake" | undefined {
    if (this.mode === "interacting") {
      return undefined;
    }
    this.clearPending();
    this.walkPurpose = "roam";
    this.walkTargetX = null;

    if (this.sleepingDeeplyIdle()) {
      this.napWakeClicksUsed++;
      if (this.napWakeClicksUsed < this.napWakeClicksNeeded) {
        return undefined;
      }
      this.napWakeClicksUsed = 0;
      this.playfulSeconds += this.rb(28, 52);
      this.mode = "dormant";
      this.currentAnim = "sit";
      this.animHardRestart = true;
      return "nap_wake";
    }

    this.pettingBurstClickCount++;
    if (this.pettingBurstClickCount >= BURST_WALK_AFTER_CLICKS) {
      this.pettingBurstClickCount = 0;
      this.startBurstWalk();
      return undefined;
    }

    this.mode = "interacting";
    this.currentAnim = this.wp(CLICK_REACTION_WEIGHTS);
    this.walkRemaining = 0;
    this.walkEase = 0;
    this.animHardRestart = true;
    return undefined;
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
    if (this.mode === "dragging") {
      return;
    }
    if (this.mode === "falling") {
      this.updateFall(deltaSeconds);
      return;
    }
    if (this.mode === "intro") {
      this.updateIntro(deltaSeconds);
      return;
    }

    if (this.socialLocked || this.personalityLocked) {
      return;
    }

    if (this.pending) {
      this.pendingTimer -= deltaSeconds;
      if (this.pendingTimer <= 0) {
        this.runPending();
      }
      return;
    }

    if (this.mode === "interacting") {
      if (animationFinished) {
        this.queueReturnToDormant(this.rb(0.35, 0.75));
      }
      return;
    }

    if (this.mode === "acting") {
      if (animationFinished) {
        this.queueReturnToDormant(this.rb(0.5, 1.1));
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

  getWidth(): number {
    return this.petDrawWidth;
  }

  isSocialLocked(): boolean {
    return this.socialLocked;
  }

  canJoinSocial(): boolean {
    if (this.socialLocked || this.personalityLocked) {
      return false;
    }
    if (this.mode !== "dormant" && this.mode !== "walking") {
      return false;
    }
    return this.pending === null;
  }

  isPersonalityLocked(): boolean {
    return this.personalityLocked;
  }

  setPersonalityLock(locked: boolean): void {
    if (locked) {
      this.clearPending();
      this.personalityLocked = true;
    } else {
      this.personalityLocked = false;
    }
  }

  playPersonalityAnim(anim: string, loop = false): void {
    this.clearPending();
    this.mode = "acting";
    this.currentAnim = anim;
    this.animHardRestart = true;
    this.personalityAwaitFinish = !loop;
  }

  isPersonalityClipDone(): boolean {
    return !this.personalityAwaitFinish;
  }

  updateWhilePersonality(
    _deltaSeconds: number,
    animationFinished: boolean,
  ): void {
    if (
      this.mode === "acting" &&
      animationFinished &&
      this.personalityAwaitFinish
    ) {
      this.personalityAwaitFinish = false;
    }
    if (this.mode === "walking") {
      this.updateWalk(_deltaSeconds);
    }
  }

  startPersonalityRun(): void {
    this.clearPending();
    this.mode = "walking";
    this.currentAnim = "run";
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    const { minX, maxX } = this.travelXBounds();
    const span = Math.max(80 * this.displayScale, maxX - minX);
    this.direction = this.rng.chance(0.5) ? 1 : -1;
    const mult = this.rb(1.35, 2.85);
    this.walkRemaining = span * mult;
    this.walkEase = 0;
    this.walkSpeedBoost = 1.62;
    this.animHardRestart = true;
  }

  startPersonalityWalk(short = false): void {
    this.clearPending();
    this.mode = "walking";
    this.currentAnim = "walk";
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;
    this.direction = this.x < minX + span * 0.5 ? 1 : -1;
    this.walkRemaining = this.rb(
      span * (short ? 0.22 : 0.38),
      span * (short ? 0.48 : 0.72),
    );
    this.walkEase = 0;
    this.walkSpeedBoost = 1;
    this.animHardRestart = true;
  }

  enterPersonalityPose(anim: string): void {
    this.clearPending();
    this.mode = "dormant";
    this.currentAnim = anim;
    this.animHardRestart = true;
    this.personalityAwaitFinish = false;
  }

  isWalking(): boolean {
    return this.mode === "walking";
  }

  finishPersonalityEpisode(): void {
    this.personalityAwaitFinish = false;
    this.walkSpeedBoost = 1;
    this.walkTargetX = null;
    this.walkPurpose = "roam";
    this.enterDormant();
  }

  isNapping(): boolean {
    return this.sleepingDeeplyIdle();
  }

  setSocialLock(locked: boolean): void {
    if (locked) {
      this.clearPending();
      this.socialLocked = true;
    } else {
      this.socialLocked = false;
    }
  }

  faceToward(otherCenterX: number): void {
    const myCenter = this.x + this.petDrawWidth / 2;
    this.direction = otherCenterX >= myCenter ? 1 : -1;
  }

  playSocialFlourish(anim: FlourishAnim): void {
    this.clearPending();
    this.mode = "acting";
    this.currentAnim = anim;
    this.animHardRestart = true;
    this.socialAwaitFinish = true;
  }

  isSocialClipDone(): boolean {
    return !this.socialAwaitFinish;
  }

  updateWhileSocial(
    _deltaSeconds: number,
    animationFinished: boolean,
  ): void {
    if (this.mode === "acting" && animationFinished && this.socialAwaitFinish) {
      this.socialAwaitFinish = false;
    }
  }

  updateSocialWalk(deltaSeconds: number): void {
    if (this.mode === "walking") {
      this.updateWalk(deltaSeconds);
    }
  }

  startChaseToward(targetCenterX: number, sprint = false): void {
    const { minX, maxX } = this.travelXBounds();
    const target = Math.max(
      minX,
      Math.min(maxX, targetCenterX - this.petDrawWidth / 2),
    );
    this.mode = "walking";
    this.currentAnim = sprint ? "run" : "walk";
    this.walkSpeedBoost = sprint ? 1.48 : 1;
    this.walkPurpose = "home";
    this.walkTargetX = target;
    this.walkRemaining = 0;
    this.walkEase = 1;
    this.direction = target > this.x ? 1 : -1;
    this.animHardRestart = true;
  }

  startChaseFleeFrom(chaserCenterX: number, sprint = false): void {
    const myCenter = this.x + this.petDrawWidth / 2;
    const fleeDir: 1 | -1 = myCenter >= chaserCenterX ? 1 : -1;
    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;
    let target = this.x + fleeDir * span * 0.32;
    target = Math.max(minX, Math.min(maxX, target));
    this.mode = "walking";
    this.currentAnim = sprint ? "run" : "walk";
    this.walkSpeedBoost = sprint ? 1.42 : 1;
    this.walkPurpose = "home";
    this.walkTargetX = target;
    this.walkRemaining = 0;
    this.walkEase = 1;
    this.direction = fleeDir;
    this.animHardRestart = true;
  }

  prepareSocialWake(): void {
    // Sleeper stays on nap until `completeSocialWake`.
  }

  completeSocialWake(): void {
    this.napWakeClicksUsed = this.napWakeClicksNeeded;
    this.playfulSeconds += this.rb(22, 44);
    this.mode = "dormant";
    this.currentAnim = "sit";
    this.animHardRestart = true;
  }

  finishSocial(): void {
    this.socialAwaitFinish = false;
    this.walkTargetX = null;
    this.walkPurpose = "roam";
    this.enterDormant();
  }

  private rollEnergySession(): void {
    this.energyTier = this.wp([
      { value: "tired", weight: 26 },
      { value: "normal", weight: 46 },
      { value: "wired", weight: 28 },
    ]);
    this.energySessionSecondsRemaining = this.rb(120, 280);
  }

  /** Bottom of the full monitor overlay (= screen floor). */
  private floorCanvasY(): number {
    return this.layout.monitor.bottom - this.layout.monitor.top;
  }

  private canvasWidth(): number {
    return this.layout.monitor.right - this.layout.monitor.left;
  }

  /** Top-left Y so the paws sit on the monitor bottom edge. */
  private anchorY(): number {
    return this.floorCanvasY() - this.feetOffsetPx - this.feetLiftPx;
  }

  private pickHomeSpot(): void {
    this.homeZone = this.wp([
      { value: "center", weight: 52 },
      { value: "midLeft", weight: 24 },
      { value: "midRight", weight: 24 },
    ]);

    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;

    switch (this.homeZone) {
      case "center":
        this.homeX = minX + span * this.rb(0.44, 0.56);
        break;
      case "midLeft":
        this.homeX = minX + span * this.rb(0.22, 0.36);
        break;
      case "midRight":
        this.homeX = minX + span * this.rb(0.64, 0.78);
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

    this.currentAnim = this.rng.chance(napChance) ? "nap" : "sit";
    if (this.currentAnim === "nap") {
      this.napWakeClicksNeeded = 1 + Math.floor(this.rb(0, 4));
      this.napWakeClicksUsed = 0;
    } else {
      this.napWakeClicksNeeded = 0;
      this.napWakeClicksUsed = 0;
    }
  }

  private nextPlannerDelay(): number {
    const mood = this.plannerMood();
    if (mood === "sleeping") {
      return this.rb(42, 82);
    }
    if (mood === "wired") {
      return this.rb(8, 20);
    }
    if (mood === "playful") {
      return this.rb(11, 26);
    }
    if (mood === "tired") {
      return this.rb(38, 76);
    }
    return this.rb(16, 42);
  }

  private scheduleFlourishForMood(): void {
    if (this.plannerMood() === "sleeping") {
      this.scheduleAct(
        this.wp(SLEEP_MICRO_FLOURISH),
        this.rb(0.5, 1.15),
      );
      return;
    }
    this.scheduleAct(this.wp(FLOURISH_WEIGHTS), this.rb(0.15, 0.58));
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
    return this.wp(nonzero);
  }

  private startWalk(): void {
    this.mode = "walking";
    this.currentAnim = "walk";
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    const { minX, maxX } = this.travelXBounds();
    const span = maxX - minX;
    this.direction = this.x < minX + span * 0.5 ? 1 : -1;
    this.walkRemaining = this.rb(span * 0.45, span * 0.95);
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
    this.direction = this.rng.chance(0.5) ? 1 : -1;
    const mult = this.rb(
      BURST_WALK_DISTANCE_MULT_MIN,
      BURST_WALK_DISTANCE_MULT_MAX,
    );
    this.walkRemaining = span * mult;
    this.walkEase = 0;
    this.animHardRestart = true;
  }

  private startWalkTowardHome(): void {
    if (this.rng.chance(0.12)) {
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
        this.pendingTimer = this.rb(
          this.sleepingDeeplyIdle() ? 0.55 : 0.22,
          this.sleepingDeeplyIdle() ? 1.5 : 0.95,
        );
        break;
      case "flourish":
        this.scheduleFlourishForMood();
        break;
      case "goHome":
        this.pending = "goHome";
        this.pendingTimer = this.rb(0.2, 0.5);
        this.currentAnim = "sit";
        break;
      case "walk":
        this.pending = "walk";
        this.pendingTimer = this.rb(0.5, 1.4);
        this.currentAnim = "sit";
        break;
      case "stretch":
        this.pending = "stretch";
        this.pendingTimer = this.rb(0.4, 1.0);
        this.currentAnim = "sit";
        break;
      case "alert":
        this.pending = "alert";
        this.pendingTimer = this.rb(0.35, 0.9);
        this.currentAnim = "sit";
        break;
    }
  }

  /** Horizontal speed for walk/run (px/s), including per-cat traits. */
  private locomotionSpeed(ease: number): number {
    let speed =
      this.walkSpeed *
      this.walkSpeedBoost *
      this.speedTrait *
      Math.max(0.15, ease);
    if (this.currentAnim === "run") {
      speed *= this.runTrait;
    }
    return speed;
  }

  private updateWalk(deltaSeconds: number): void {
    if (this.walkEase < 1) {
      this.walkEase = Math.min(
        1,
        this.walkEase + deltaSeconds / WALK_EASE_IN_SEC,
      );
    }

    let ease = this.walkEase;

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
      const speed = this.locomotionSpeed(ease);
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

    const speed = this.locomotionSpeed(ease);
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
      this.walkSpeedBoost = 1;
      this.mode = "dormant";
      if (this.personalityLocked) {
        this.currentAnim = "sit";
        this.animHardRestart = true;
        return;
      }
      if (this.rng.chance(0.24)) {
        this.scheduleAct(this.pk(WALK_ARRIVAL_FLOURISH), this.rb(0.08, 0.35));
      } else {
        this.queueReturnToDormant(this.rb(0.4, 0.9));
      }
    }
  }

  private finishWalkingToDormant(): void {
    this.walkSpeedBoost = 1;
    this.walkPurpose = "roam";
    this.walkTargetX = null;
    this.walkRemaining = 0;
    this.walkEase = 0;
    this.mode = "dormant";
    if (this.rng.chance(0.28)) {
      this.scheduleAct(this.pk(WALK_ARRIVAL_FLOURISH), this.rb(0.06, 0.28));
      return;
    }
    this.queueReturnToDormant(this.rb(0.25, 0.55));
  }

  private travelXBounds(): { minX: number; maxX: number } {
    return {
      minX: 0,
      maxX: Math.max(0, this.canvasWidth() - this.petDrawWidth),
    };
  }

  private clampX(): void {
    const { minX, maxX } = this.travelXBounds();
    this.x = Math.max(minX, Math.min(maxX, this.x));
  }
}
