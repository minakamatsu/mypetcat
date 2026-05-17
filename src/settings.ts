const SETTINGS_KEY = "desktop-cat-settings";

export const MIN_CAT_COUNT = 1;
export const MAX_CAT_COUNT = 8;

export interface AppSettings {
  launchAtStartup: boolean;
  catCount: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  launchAtStartup: true,
  catCount: 1,
};

function clampCatCount(n: number): number {
  return Math.max(MIN_CAT_COUNT, Math.min(MAX_CAT_COUNT, Math.round(n)));
}

function loadRaw(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      launchAtStartup:
        typeof parsed.launchAtStartup === "boolean"
          ? parsed.launchAtStartup
          : DEFAULT_SETTINGS.launchAtStartup,
      catCount:
        typeof parsed.catCount === "number"
          ? clampCatCount(parsed.catCount)
          : DEFAULT_SETTINGS.catCount,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): AppSettings {
  return loadRaw();
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      catCount: clampCatCount(settings.catCount),
    }),
  );
}

export function setLaunchAtStartup(enabled: boolean): AppSettings {
  const next = { ...loadRaw(), launchAtStartup: enabled };
  saveSettings(next);
  return next;
}

export function setCatCount(count: number): AppSettings {
  const next = { ...loadRaw(), catCount: clampCatCount(count) };
  saveSettings(next);
  return next;
}
