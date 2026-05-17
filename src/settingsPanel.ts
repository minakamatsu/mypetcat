import {
  getSettings,
  MAX_CAT_COUNT,
  MIN_CAT_COUNT,
  setCatCount,
} from "./settings";

let panelEl: HTMLDivElement | null = null;
let onApply: ((count: number) => void) | null = null;
let sliderEl: HTMLInputElement | null = null;
let labelEl: HTMLOutputElement | null = null;

function clampCount(n: number): number {
  return Math.max(MIN_CAT_COUNT, Math.min(MAX_CAT_COUNT, Math.round(n)));
}

function readSliderCount(): number {
  return clampCount(Number(sliderEl?.value ?? MIN_CAT_COUNT));
}

function syncLabel(): void {
  if (labelEl && sliderEl) {
    labelEl.textContent = sliderEl.value;
  }
}

function setSliderCount(count: number): void {
  if (!sliderEl) {
    return;
  }
  sliderEl.value = String(clampCount(count));
  syncLabel();
}

export function syncSettingsPanelFromStorage(): void {
  setSliderCount(getSettings().catCount);
}

function applyCount(): void {
  const count = readSliderCount();
  setCatCount(count);
  onApply?.(count);
  setVisible(false);
}

function bumpCount(delta: number): void {
  setSliderCount(readSliderCount() + delta);
}

export function mountSettingsPanel(applyHandler: (count: number) => void): void {
  onApply = applyHandler;

  const panel = document.createElement("div");
  panel.id = "settings-panel";
  panel.hidden = true;

  const card = document.createElement("div");
  card.className = "settings-card";

  const title = document.createElement("h2");
  title.textContent = "Desktop Cat";
  card.appendChild(title);

  const countLabel = document.createElement("label");
  countLabel.className = "settings-row settings-row-count";
  const countSpan = document.createElement("span");
  countSpan.textContent = "Number of cats";
  const label = document.createElement("output");
  label.id = "cat-count-label";
  countLabel.append(countSpan, label);

  const stepper = document.createElement("div");
  stepper.className = "settings-stepper";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "settings-step-btn";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "Remove one cat");

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = "cat-count";
  slider.min = String(MIN_CAT_COUNT);
  slider.max = String(MAX_CAT_COUNT);
  slider.step = "1";

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "settings-step-btn";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "Add one cat");

  stepper.append(minusBtn, slider, plusBtn);
  countLabel.appendChild(stepper);

  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent =
    "All cats share one app — use the tray menu to add or remove. Do not open the shortcut again for each cat.";

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.id = "cat-count-apply";
  applyBtn.textContent = "Apply";

  card.append(countLabel, hint, applyBtn);
  panel.appendChild(card);
  document.body.appendChild(panel);

  panelEl = panel;
  sliderEl = slider;
  labelEl = label;

  setSliderCount(getSettings().catCount);
  slider.addEventListener("input", syncLabel);
  minusBtn.addEventListener("click", () => bumpCount(-1));
  plusBtn.addEventListener("click", () => bumpCount(1));
  applyBtn.addEventListener("click", applyCount);
}

export function setVisible(visible: boolean): void {
  if (panelEl) {
    panelEl.hidden = !visible;
  }
  if (visible) {
    syncSettingsPanelFromStorage();
  }
}

export function toggleVisible(): boolean {
  const next = panelEl?.hidden !== false;
  setVisible(next);
  return next;
}

export function isSettingsPanelOpen(): boolean {
  return panelEl != null && !panelEl.hidden;
}
