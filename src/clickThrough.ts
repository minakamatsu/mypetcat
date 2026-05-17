import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import type { PetManager } from "./petManager";
import { isSettingsPanelOpen } from "./settingsPanel";

/** When true, mouse clicks pass through to apps below. */
let ignoringCursor = true;

export async function initClickThrough(): Promise<void> {
  ignoringCursor = false;
  await getCurrentWindow().setIgnoreCursorEvents(true);
  ignoringCursor = true;
}

/**
 * Full-monitor overlay must not block the desktop. Ignore OS hit-testing
 * except over opaque cat pixels, while dragging, or when settings are open.
 */
export async function syncClickThrough(manager: PetManager): Promise<void> {
  let shouldIgnore = true;

  if (isSettingsPanelOpen() || manager.isCapturingPointer()) {
    shouldIgnore = false;
  } else {
    try {
      const pos = await cursorPosition();
      const origin = manager.getWindowOrigin();
      const cx = pos.x - origin.left;
      const cy = pos.y - origin.top;
      if (manager.hitTestCat(cx, cy) != null) {
        shouldIgnore = false;
      }
    } catch {
      // If cursor position is unavailable, prefer blocking over trapping the desktop.
      shouldIgnore = false;
    }
  }

  if (shouldIgnore === ignoringCursor) {
    return;
  }

  ignoringCursor = shouldIgnore;
  await getCurrentWindow().setIgnoreCursorEvents(shouldIgnore);
}
