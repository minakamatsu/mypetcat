import type { CatController, FlourishAnim } from "./catController";
import type { CatEmotion, CatEmotionSystem } from "./catEmotions";
import type { PetSlot } from "./petManager";
import { CatRng } from "./rng";

export type SocialKind = "playFight" | "chase" | "wake";

type Phase =
  | { type: "play"; step: number }
  | { type: "chase"; elapsed: number }
  | { type: "wake"; step: number };

interface ActiveSocial {
  kind: SocialKind;
  catA: number;
  catB: number;
  phase: Phase;
  chaserId?: number;
}

const PAIR_COOLDOWN_SEC = 28;
const NEAR_DIST_SCALE = 105;

const PLAY_STEPS: { a: FlourishAnim; b: FlourishAnim }[] = [
  { a: "happy", b: "happy" },
  { a: "scratch", b: "alert" },
  { a: "alert", b: "scratch" },
  { a: "happy", b: "sit_tilt" },
];

const PLAY_STEPS_FEISTY: { a: FlourishAnim; b: FlourishAnim }[] = [
  { a: "angry", b: "alert" },
  { a: "scratch", b: "angry" },
  { a: "angry", b: "scratch" },
  { a: "alert", b: "angry" },
];

export class CatSocialSystem {
  private active: ActiveSocial | null = null;
  private pairCooldowns = new Map<string, number>();
  private readonly rng = new CatRng(0x5a1c4e7);

  constructor(private readonly emotions: CatEmotionSystem) {}

  update(cats: PetSlot[], delta: number, displayScale: number): void {
    this.tickCooldowns(delta);

    if (this.active) {
      this.advance(this.active, cats, delta, displayScale);
      return;
    }

    if (cats.length < 2) {
      return;
    }

    this.tryStart(cats, displayScale);
  }

  private tickCooldowns(delta: number): void {
    for (const [key, t] of this.pairCooldowns) {
      const next = t - delta;
      if (next <= 0) {
        this.pairCooldowns.delete(key);
      } else {
        this.pairCooldowns.set(key, next);
      }
    }
  }

  private pairKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  private nearDist(displayScale: number): number {
    return NEAR_DIST_SCALE * displayScale;
  }

  private catById(cats: PetSlot[], id: number): PetSlot | undefined {
    return cats.find((c) => c.id === id);
  }

  private centerX(c: CatController): number {
    return c.getPosition().x + c.getWidth() / 2;
  }

  private tryStart(cats: PetSlot[], displayScale: number): void {
    const near = this.nearDist(displayScale);

    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        const a = cats[i]!;
        const b = cats[j]!;
        const key = this.pairKey(a.id, b.id);
        if (this.pairCooldowns.has(key)) {
          continue;
        }

        const ax = this.centerX(a.controller);
        const bx = this.centerX(b.controller);
        if (Math.abs(ax - bx) > near) {
          continue;
        }

        const aOk = a.controller.canJoinSocial();
        const bOk = b.controller.canJoinSocial();
        if (!aOk && !bOk) {
          continue;
        }

        const bias = this.emotions.getSocialBias(a.id, b.id);

        if (b.controller.isNapping() && a.controller.canJoinSocial()) {
          if (this.rng.chance(0.42 * bias.wake)) {
            this.startWake(a, b);
            return;
          }
        }
        if (a.controller.isNapping() && b.controller.canJoinSocial()) {
          if (this.rng.chance(0.42 * bias.wake)) {
            this.startWake(b, a);
            return;
          }
        }

        if (!aOk || !bOk) {
          continue;
        }

        const roll = this.rng.next();
        const playCutoff = Math.min(0.92, 0.38 * bias.playFight);
        const chaseCutoff = Math.min(0.98, playCutoff + 0.34 * bias.chase);
        if (roll < playCutoff) {
          this.startPlayFight(a, b);
          return;
        }
        if (roll < chaseCutoff) {
          this.startChase(a, b);
          return;
        }
      }
    }
  }

  private startPlayFight(a: PetSlot, b: PetSlot): void {
    this.lockPair(a.controller, b.controller);
    this.active = {
      kind: "playFight",
      catA: a.id,
      catB: b.id,
      phase: { type: "play", step: 0 },
    };
    this.facePair(a.controller, b.controller);
    this.playStep(a.controller, b.controller, 0, this.pairFeisty(a.id, b.id));
  }

  private startChase(a: PetSlot, b: PetSlot): void {
    const chaser = this.rng.chance(0.5) ? a : b;
    const runner = chaser.id === a.id ? b : a;
    this.lockPair(a.controller, b.controller);
    this.active = {
      kind: "chase",
      catA: a.id,
      catB: b.id,
      chaserId: chaser.id,
      phase: { type: "chase", elapsed: 0 },
    };
    chaser.controller.faceToward(this.centerX(runner.controller));
    runner.controller.faceToward(this.centerX(chaser.controller));
    const chaseFeisty = this.pairFeisty(chaser.id, runner.id);
    chaser.controller.startChaseToward(
      this.centerX(runner.controller),
      chaseFeisty,
    );
    runner.controller.startChaseFleeFrom(
      this.centerX(chaser.controller),
      chaseFeisty && this.rng.chance(0.5),
    );
  }

  private startWake(waker: PetSlot, sleeper: PetSlot): void {
    this.lockPair(waker.controller, sleeper.controller);
    this.active = {
      kind: "wake",
      catA: waker.id,
      catB: sleeper.id,
      phase: { type: "wake", step: 0 },
    };
    waker.controller.faceToward(this.centerX(sleeper.controller));
    sleeper.controller.faceToward(this.centerX(waker.controller));
    waker.controller.playSocialFlourish("alert");
    sleeper.controller.prepareSocialWake();
  }

  private lockPair(a: CatController, b: CatController): void {
    a.setSocialLock(true);
    b.setSocialLock(true);
  }

  private unlockPair(a: CatController, b: CatController): void {
    a.setSocialLock(false);
    b.setSocialLock(false);
    a.finishSocial();
    b.finishSocial();
  }

  private facePair(a: CatController, b: CatController): void {
    a.faceToward(this.centerX(b));
    b.faceToward(this.centerX(a));
  }

  private playStep(
    a: CatController,
    b: CatController,
    step: number,
    feisty: boolean,
  ): void {
    const table = feisty ? PLAY_STEPS_FEISTY : PLAY_STEPS;
    const clip = table[step] ?? table[0]!;
    a.playSocialFlourish(clip.a);
    b.playSocialFlourish(clip.b);
  }

  private pairFeisty(aId: number, bId: number): boolean {
    const a = this.emotions.getEmotion(aId);
    const b = this.emotions.getEmotion(bId);
    const spicy: CatEmotion[] = ["feisty", "grumpy", "mischievous"];
    return spicy.includes(a) || spicy.includes(b);
  }

  private advance(
    active: ActiveSocial,
    cats: PetSlot[],
    delta: number,
    displayScale: number,
  ): void {
    const slotA = this.catById(cats, active.catA);
    const slotB = this.catById(cats, active.catB);
    if (!slotA || !slotB) {
      this.endActive(active, slotA?.controller, slotB?.controller);
      return;
    }

    const a = slotA.controller;
    const b = slotB.controller;

    switch (active.phase.type) {
      case "play": {
        const bothDone =
          a.isSocialClipDone() && b.isSocialClipDone();
        if (bothDone) {
          const next = active.phase.step + 1;
          const feisty = this.pairFeisty(active.catA, active.catB);
          const table = feisty ? PLAY_STEPS_FEISTY : PLAY_STEPS;
          if (next >= table.length) {
            this.endActive(active, a, b);
            return;
          }
          active.phase = { type: "play", step: next };
          this.facePair(a, b);
          this.playStep(a, b, next, feisty);
        }
        break;
      }
      case "chase": {
        active.phase.elapsed += delta;
        const locomoting = (anim: string) => anim === "walk" || anim === "run";
        if (locomoting(a.currentAnimation())) {
          a.updateSocialWalk(delta);
        }
        if (locomoting(b.currentAnimation())) {
          b.updateSocialWalk(delta);
        }
        const chaser =
          active.chaserId === active.catA ? a : b;
        const runner =
          active.chaserId === active.catA ? b : a;
        const dist = Math.abs(
          this.centerX(chaser) - this.centerX(runner),
        );
        if (
          active.phase.elapsed >= 3.8 ||
          dist < this.nearDist(displayScale) * 0.55
        ) {
          this.endActive(active, a, b);
        }
        break;
      }
      case "wake": {
        const waker = slotA.id === active.catA ? a : b;
        const sleeper = slotA.id === active.catA ? b : a;
        if (active.phase.step === 0 && waker.isSocialClipDone()) {
          const wakerSlot = slotA.id === active.catA ? slotA : slotB;
          const sleeperSlot = slotA.id === active.catA ? slotB : slotA;
          const wEmotion = this.emotions.getEmotion(wakerSlot.id);
          waker.playSocialFlourish(
            wEmotion === "mischievous" || wEmotion === "feisty"
              ? "happy"
              : "alert",
          );
          sleeper.completeSocialWake();
          this.emotions.onSocialNapDisturbed(sleeperSlot, wakerSlot);
          active.phase = { type: "wake", step: 1 };
        } else if (active.phase.step === 1 && waker.isSocialClipDone()) {
          this.endActive(active, a, b);
        }
        break;
      }
    }
  }

  private endActive(
    active: ActiveSocial,
    a?: CatController,
    b?: CatController,
  ): void {
    if (a && b) {
      this.unlockPair(a, b);
    }
    this.pairCooldowns.set(this.pairKey(active.catA, active.catB), PAIR_COOLDOWN_SEC);
    this.active = null;
  }
}
