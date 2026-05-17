import type { PetSlot } from "./petManager";
import { CatRng } from "./rng";

/** Ten moods that cycle on a ~2 minute timer and drive idle episodes. */
export type CatEmotion =
  | "calm"
  | "playful"
  | "sleepy"
  | "curious"
  | "grumpy"
  | "energetic"
  | "affectionate"
  | "mischievous"
  | "shy"
  | "feisty";

type ScriptStep =
  | { kind: "flourish"; anim: string }
  | { kind: "hold"; anim: string; sec: number }
  | { kind: "walk"; short?: boolean }
  | { kind: "run" };

interface EmotionProfile {
  emotion: CatEmotion;
  weight: number;
  scripts: ScriptStep[][];
}

interface CatEmotionState {
  emotion: CatEmotion;
  moodTimer: number;
  episode: ActiveEpisode | null;
}

interface ActiveEpisode {
  steps: ScriptStep[];
  stepIndex: number;
  phase: "flourish" | "hold" | "walk" | "run";
  holdLeft: number;
}

const MOOD_CYCLE_MIN = 108;
const MOOD_CYCLE_MAX = 132;

const EMOTION_PROFILES: EmotionProfile[] = [
  {
    emotion: "calm",
    weight: 12,
    scripts: [
      [{ kind: "hold", anim: "sit", sec: 4 }],
      [{ kind: "flourish", anim: "look_tilt" }, { kind: "hold", anim: "sit", sec: 2 }],
      [{ kind: "flourish", anim: "sit_tilt" }],
    ],
  },
  {
    emotion: "playful",
    weight: 11,
    scripts: [
      [{ kind: "flourish", anim: "happy" }, { kind: "walk" }],
      [{ kind: "flourish", anim: "scratch" }, { kind: "run" }],
      [{ kind: "flourish", anim: "happy" }, { kind: "flourish", anim: "look_lift" }],
    ],
  },
  {
    emotion: "sleepy",
    weight: 10,
    scripts: [
      [{ kind: "hold", anim: "nap", sec: 8 }],
      [{ kind: "hold", anim: "nap", sec: 5 }, { kind: "flourish", anim: "look_lift" }],
    ],
  },
  {
    emotion: "curious",
    weight: 10,
    scripts: [
      [{ kind: "flourish", anim: "look_lift" }, { kind: "flourish", anim: "look_tilt" }],
      [{ kind: "flourish", anim: "look_tilt" }, { kind: "walk", short: true }],
    ],
  },
  {
    emotion: "grumpy",
    weight: 9,
    scripts: [
      [{ kind: "flourish", anim: "alert" }, { kind: "flourish", anim: "sit_tilt" }],
      [{ kind: "flourish", anim: "angry" }, { kind: "walk" }],
    ],
  },
  {
    emotion: "energetic",
    weight: 10,
    scripts: [
      [{ kind: "flourish", anim: "alert" }, { kind: "run" }],
      [{ kind: "run" }],
      [{ kind: "flourish", anim: "happy" }, { kind: "run" }],
    ],
  },
  {
    emotion: "affectionate",
    weight: 10,
    scripts: [
      [{ kind: "flourish", anim: "happy" }, { kind: "flourish", anim: "stretch" }],
      [{ kind: "flourish", anim: "look_lift" }, { kind: "hold", anim: "sit", sec: 3 }],
    ],
  },
  {
    emotion: "mischievous",
    weight: 9,
    scripts: [
      [{ kind: "flourish", anim: "scratch" }, { kind: "run" }],
      [{ kind: "flourish", anim: "alert" }, { kind: "walk" }],
    ],
  },
  {
    emotion: "shy",
    weight: 9,
    scripts: [
      [{ kind: "flourish", anim: "sit_tilt" }, { kind: "hold", anim: "sit", sec: 4 }],
      [{ kind: "hold", anim: "sit", sec: 3 }, { kind: "flourish", anim: "look_tilt" }],
    ],
  },
  {
    emotion: "feisty",
    weight: 10,
    scripts: [
      [{ kind: "flourish", anim: "angry" }, { kind: "run" }],
      [{ kind: "flourish", anim: "angry" }, { kind: "flourish", anim: "alert" }, { kind: "run" }],
    ],
  },
];

const WAKE_GRUMPY: ScriptStep[] = [
  { kind: "flourish", anim: "angry" },
  { kind: "run" },
];
const WAKE_FEISTY: ScriptStep[] = [
  { kind: "flourish", anim: "angry" },
  { kind: "flourish", anim: "alert" },
  { kind: "run" },
];
const WAKE_HAPPY: ScriptStep[] = [
  { kind: "flourish", anim: "happy" },
  { kind: "walk", short: true },
];
const WAKE_STARTLED: ScriptStep[] = [
  { kind: "flourish", anim: "alert" },
  { kind: "run" },
];

export interface SocialEmotionBias {
  playFight: number;
  chase: number;
  wake: number;
}

export class CatEmotionSystem {
  private readonly states = new Map<number, CatEmotionState>();
  private readonly rng = new CatRng(0x8e1d9a2b);

  syncCats(cats: PetSlot[]): void {
    const ids = new Set(cats.map((c) => c.id));
    for (const id of [...this.states.keys()]) {
      if (!ids.has(id)) {
        this.states.delete(id);
      }
    }
    for (const cat of cats) {
      if (!this.states.has(cat.id)) {
        const emotion = this.pickEmotion();
        this.states.set(cat.id, {
          emotion,
          moodTimer: this.rb(MOOD_CYCLE_MIN, MOOD_CYCLE_MAX),
          episode: null,
        });
      }
    }
  }

  getEmotion(catId: number): CatEmotion {
    return this.states.get(catId)?.emotion ?? "calm";
  }

  getSocialBias(catA: number, catB: number): SocialEmotionBias {
    const a = this.getEmotion(catA);
    const b = this.getEmotion(catB);
    let playFight = 1;
    let chase = 1;
    let wake = 1;

    const pair = (x: CatEmotion, y: CatEmotion) =>
      (x === a && y === b) || (x === b && y === a);

    if (pair("playful", "playful")) {
      playFight *= 1.45;
      chase *= 1.35;
    }
    if (pair("feisty", "feisty") || pair("feisty", "grumpy")) {
      playFight *= 1.55;
    }
    if (pair("mischievous", "playful") || pair("mischievous", "energetic")) {
      chase *= 1.5;
    }
    if (pair("shy", "shy")) {
      playFight *= 0.35;
      chase *= 0.4;
      wake *= 0.5;
    }
    if (a === "sleepy" || b === "sleepy") {
      wake *= 1.25;
    }
    if (a === "calm" && b === "calm") {
      playFight *= 0.75;
      chase *= 0.7;
    }
    if (a === "affectionate" || b === "affectionate") {
      playFight *= 1.2;
    }

    return { playFight, chase, wake };
  }

  onNapWake(cat: PetSlot): void {
    if (cat.controller.isPersonalityLocked() || cat.controller.isSocialLocked()) {
      return;
    }
    const emotion = this.getEmotion(cat.id);
    const roll = this.rng.next();

    if (emotion === "grumpy" && roll < 0.58) {
      this.startEpisode(cat, WAKE_GRUMPY);
      return;
    }
    if (emotion === "feisty" && roll < 0.52) {
      this.startEpisode(cat, WAKE_FEISTY);
      return;
    }
    if (emotion === "energetic" && roll < 0.45) {
      this.startEpisode(cat, WAKE_STARTLED);
      return;
    }
    if (emotion === "playful" && roll < 0.4) {
      this.startEpisode(cat, WAKE_HAPPY);
      return;
    }
    if (roll < 0.22) {
      this.startEpisode(cat, WAKE_STARTLED);
    } else if (roll < 0.38) {
      this.startEpisode(cat, WAKE_HAPPY);
    }
  }

  onSocialNapDisturbed(sleeper: PetSlot, waker: PetSlot): void {
    if (!sleeper.controller.isPersonalityLocked()) {
      this.onNapWake(sleeper);
    }
    if (
      waker.controller.canJoinSocial() &&
      !waker.controller.isPersonalityLocked() &&
      this.rng.chance(0.28)
    ) {
      const wEmotion = this.getEmotion(waker.id);
      if (wEmotion === "mischievous" || wEmotion === "playful") {
        waker.controller.playPersonalityAnim("happy");
      }
    }
  }

  update(cats: PetSlot[], delta: number): void {
    this.syncCats(cats);

    for (const cat of cats) {
      const state = this.states.get(cat.id);
      if (!state) {
        continue;
      }

      if (state.episode) {
        this.advanceEpisode(cat, state, delta);
        continue;
      }

      if (cat.controller.isSocialLocked() || cat.controller.isDragging()) {
        continue;
      }

      state.moodTimer -= delta;
      if (state.moodTimer <= 0) {
        state.emotion = this.pickEmotion();
        state.moodTimer = this.rb(MOOD_CYCLE_MIN, MOOD_CYCLE_MAX);
        if (cat.controller.canJoinSocial()) {
          const profile = EMOTION_PROFILES.find((p) => p.emotion === state.emotion);
          const script = this.pk(profile?.scripts ?? [[{ kind: "hold", anim: "sit", sec: 3 }]]);
          this.startEpisode(cat, script);
        }
      }
    }
  }

  private advanceEpisode(
    cat: PetSlot,
    state: CatEmotionState,
    delta: number,
  ): void {
    const ep = state.episode;
    if (!ep) {
      return;
    }

    const ctrl = cat.controller;

    switch (ep.phase) {
      case "flourish":
        if (ctrl.isPersonalityClipDone()) {
          this.nextStep(cat, state);
        }
        break;
      case "hold":
        ep.holdLeft -= delta;
        if (ep.holdLeft <= 0) {
          this.nextStep(cat, state);
        }
        break;
      case "walk":
      case "run":
        if (!ctrl.isWalking()) {
          this.nextStep(cat, state);
        }
        break;
    }
  }

  private nextStep(cat: PetSlot, state: CatEmotionState): void {
    const ep = state.episode;
    if (!ep) {
      return;
    }

    ep.stepIndex++;
    if (ep.stepIndex >= ep.steps.length) {
      this.endEpisode(cat, state);
      return;
    }

    this.runStep(cat, ep, ep.steps[ep.stepIndex]!);
  }

  private runStep(cat: PetSlot, ep: ActiveEpisode, step: ScriptStep): void {
    const ctrl = cat.controller;

    switch (step.kind) {
      case "flourish":
        ep.phase = "flourish";
        ctrl.playPersonalityAnim(step.anim);
        break;
      case "hold":
        ep.phase = "hold";
        ep.holdLeft = step.sec;
        ctrl.enterPersonalityPose(step.anim);
        break;
      case "walk":
        ep.phase = "walk";
        ctrl.startPersonalityWalk(step.short);
        break;
      case "run":
        ep.phase = "run";
        ctrl.startPersonalityRun();
        break;
    }
  }

  private startEpisode(cat: PetSlot, steps: ScriptStep[]): void {
    if (
      cat.controller.isSocialLocked() ||
      cat.controller.isDragging() ||
      !cat.controller.canJoinSocial()
    ) {
      return;
    }

    const state = this.states.get(cat.id);
    if (!state) {
      return;
    }

    cat.controller.setPersonalityLock(true);
    state.episode = {
      steps,
      stepIndex: 0,
      phase: "flourish",
      holdLeft: 0,
    };
    this.runStep(cat, state.episode, steps[0]!);
  }

  private endEpisode(cat: PetSlot, state: CatEmotionState): void {
    state.episode = null;
    cat.controller.finishPersonalityEpisode();
    cat.controller.setPersonalityLock(false);
  }

  private pickEmotion(): CatEmotion {
    return this.rng.weightedPick(
      EMOTION_PROFILES.map((p) => ({ value: p.emotion, weight: p.weight })),
    );
  }

  private rb(min: number, max: number): number {
    return this.rng.randBetween(min, max);
  }

  private pk<T>(items: readonly T[]): T {
    return this.rng.pick(items);
  }
}
