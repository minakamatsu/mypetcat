import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, CheckMenuItem, Submenu } from "@tauri-apps/api/menu";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import {
  getSettings,
  setLaunchAtStartup,
  setCatCount,
  MIN_CAT_COUNT,
  MAX_CAT_COUNT,
} from "./settings";

const TRAY_ID = "desktop-cat-main";

export interface TrayHandlers {
  onOpenSettings: () => void;
  onResetCats: () => void;
  onCatCountChange: (count: number) => void;
}

let tray: TrayIcon | null = null;
let handlers: TrayHandlers | null = null;

async function loadTrayIcon(): Promise<Image | undefined> {
  try {
    const res = await fetch("/cat/tray-icon.png");
    if (!res.ok) {
      return undefined;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await Image.fromBytes(bytes);
  } catch {
    return undefined;
  }
}

async function applyLaunchAtStartup(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}

function trayTooltip(count: number): string {
  return count === 1 ? "Desktop Cat (1 cat)" : `Desktop Cat (${count} cats)`;
}

async function buildTrayMenu(): Promise<Menu> {
  const h = handlers;
  if (!h) {
    throw new Error("Tray handlers not set");
  }

  const settings = getSettings();

  const catCountItems: CheckMenuItem[] = [];
  for (let n = MIN_CAT_COUNT; n <= MAX_CAT_COUNT; n++) {
    const count = n;
    catCountItems.push(
      await CheckMenuItem.new({
        id: `cat-count-${count}`,
        text: String(count),
        checked: settings.catCount === count,
        action: async () => {
          if (getSettings().catCount === count) {
            return;
          }
          setCatCount(count);
          h.onCatCountChange(count);
          await refreshTray();
        },
      }),
    );
  }

  const catsSubmenu = await Submenu.new({
    id: "cats-submenu",
    text: `Number of cats (${settings.catCount})`,
    items: catCountItems,
  });

  const settingsItem = await MenuItem.new({
    id: "settings",
    text: "Cat settings…",
    action: () => {
      h.onOpenSettings();
    },
  });

  const resetItem = await MenuItem.new({
    id: "reset-cats",
    text: "Reset cats to bottom",
    action: () => {
      h.onResetCats();
    },
  });

  const autostartItem = await CheckMenuItem.new({
    id: "launch-at-startup",
    text: "Start at login",
    checked: settings.launchAtStartup,
    action: async () => {
      const next = await autostartItem.isChecked();
      setLaunchAtStartup(next);
      await applyLaunchAtStartup(next);
    },
  });

  const quitItem = await MenuItem.new({
    id: "quit",
    text: "Quit Desktop Cat",
    action: () => {
      void invoke("quit_app");
    },
  });

  return Menu.new({
    items: [catsSubmenu, settingsItem, resetItem, autostartItem, quitItem],
  });
}

/** Rebuild tray menu and tooltip after cat count or settings change. */
export async function refreshTray(): Promise<void> {
  if (!tray) {
    return;
  }
  const count = getSettings().catCount;
  await tray.setMenu(await buildTrayMenu());
  await tray.setTooltip(trayTooltip(count));
}

export async function initLaunchAtStartup(): Promise<void> {
  const { launchAtStartup } = getSettings();
  await applyLaunchAtStartup(launchAtStartup);
}

export async function setupTray(trayHandlers: TrayHandlers): Promise<void> {
  handlers = trayHandlers;

  const existing = await TrayIcon.getById(TRAY_ID);
  if (existing) {
    await existing.close();
  }

  const icon = await loadTrayIcon();
  tray = await TrayIcon.new({
    id: TRAY_ID,
    icon: icon ?? undefined,
    menuOnLeftClick: true,
  });

  await refreshTray();
}
