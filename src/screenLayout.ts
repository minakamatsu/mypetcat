import { invoke } from "@tauri-apps/api/core";
import type { ScreenLayout } from "./catController";

/**
 * Win32 physical pixels for the monitor that owns the pet window.
 * (Tauri `currentMonitor()` work-area values can be logical on some setups.)
 */
export async function resolveScreenLayout(): Promise<ScreenLayout> {
  return invoke<ScreenLayout>("get_screen_layout");
}
