use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct ScreenLayout {
    pub work_area: Rect,
    pub monitor: Rect,
    pub taskbar_height: i32,
    /// Y coordinate where the pet's feet should sit (physical pixels).
    pub feet_y: i32,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct WorkAreaRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[tauri::command]
fn get_work_area() -> Result<WorkAreaRect, String> {
    platform::get_screen_layout()
        .map(|layout| WorkAreaRect {
            left: layout.work_area.left,
            top: layout.work_area.top,
            right: layout.work_area.right,
            bottom: layout.work_area.bottom,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screen_layout() -> Result<ScreenLayout, String> {
    platform::get_screen_layout().map_err(|e| e.to_string())
}

/// Re-apply HWND_TOPMOST so the pet stays above the Windows taskbar.
#[tauri::command]
fn ensure_topmost(window: tauri::WebviewWindow) -> Result<(), String> {
    platform::pin_topmost(&window)
}

#[cfg(windows)]
mod platform {
    use super::{Rect, ScreenLayout};
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITOR_DEFAULTTONEAREST, MONITORINFO,
    };
    use windows::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA};

    fn rect_from_win32(rect: RECT) -> Rect {
        Rect {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        }
    }

    fn monitor_for_work_area(work_area: Rect) -> Result<Rect, Box<dyn std::error::Error>> {
        let center = POINT {
            x: (work_area.left + work_area.right) / 2,
            y: (work_area.top + work_area.bottom) / 2,
        };

        let hmon = unsafe { MonitorFromPoint(center, MONITOR_DEFAULTTONEAREST) };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let ok = unsafe { GetMonitorInfoW(hmon, &mut info) };
        if ok.as_bool() {
            return Ok(rect_from_win32(info.rcMonitor));
        }

        Err("GetMonitorInfoW failed".into())
    }

    pub fn get_screen_layout() -> Result<ScreenLayout, Box<dyn std::error::Error>> {
        let mut work_rect = RECT::default();
        unsafe {
            SystemParametersInfoW(
                SPI_GETWORKAREA,
                0,
                Some(std::ptr::from_mut(&mut work_rect).cast()),
                Default::default(),
            )?;
        }

        let work_area = rect_from_win32(work_rect);
        let monitor = monitor_for_work_area(work_area)?;
        let taskbar_height = (monitor.bottom - work_area.bottom).max(0);
        // Feet on the physical bottom of the screen (pet walks over the taskbar).
        let feet_y = monitor.bottom;

        Ok(ScreenLayout {
            work_area,
            monitor,
            taskbar_height,
            feet_y,
        })
    }

    pub fn pin_topmost(window: &tauri::WebviewWindow) -> Result<(), String> {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };

        window
            .set_always_on_top(true)
            .map_err(|e| e.to_string())?;

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        unsafe {
            SetWindowPos(
                hwnd,
                Some(HWND_TOPMOST),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}

#[cfg(not(windows))]
mod platform {
    use super::{Rect, ScreenLayout};

    pub fn get_screen_layout() -> Result<ScreenLayout, Box<dyn std::error::Error>> {
        let work_area = Rect {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1040,
        };
        let monitor = Rect {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        Ok(ScreenLayout {
            work_area,
            monitor,
            taskbar_height: monitor.bottom - work_area.bottom,
            feet_y: monitor.bottom,
        })
    }

    pub fn pin_topmost(window: &tauri::WebviewWindow) -> Result<(), String> {
        window
            .set_always_on_top(true)
            .map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = platform::pin_topmost(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_work_area,
            get_screen_layout,
            ensure_topmost
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
