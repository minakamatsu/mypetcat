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
fn get_work_area(window: tauri::WebviewWindow) -> Result<WorkAreaRect, String> {
    platform::get_screen_layout(&window)
        .map(|layout| WorkAreaRect {
            left: layout.work_area.left,
            top: layout.work_area.top,
            right: layout.work_area.right,
            bottom: layout.work_area.bottom,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screen_layout(window: tauri::WebviewWindow) -> Result<ScreenLayout, String> {
    platform::get_screen_layout(&window).map_err(|e| e.to_string())
}

/// Re-apply always-on-top (Win32 topmost pin on Windows).
#[tauri::command]
fn ensure_topmost(window: tauri::WebviewWindow) -> Result<(), String> {
    platform::pin_topmost(&window)
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(windows)]
mod platform {
    use super::{Rect, ScreenLayout};
    use tauri::WebviewWindow;
    use windows::Win32::Foundation::RECT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    fn rect_from_win32(rect: RECT) -> Rect {
        Rect {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        }
    }

    pub fn get_screen_layout(
        window: &WebviewWindow,
    ) -> Result<ScreenLayout, Box<dyn std::error::Error>> {
        let hwnd = window.hwnd()?;
        let hmon = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let ok = unsafe { GetMonitorInfoW(hmon, &mut info) };
        if !ok.as_bool() {
            return Err("GetMonitorInfoW failed".into());
        }

        let monitor = rect_from_win32(info.rcMonitor);
        let work_area = rect_from_win32(info.rcWork);
        let taskbar_height = (monitor.bottom - work_area.bottom).max(0);
        // Sit on the desktop, not under the taskbar.
        let feet_y = work_area.bottom;

        Ok(ScreenLayout {
            work_area,
            monitor,
            taskbar_height,
            feet_y,
        })
    }

    pub fn pin_topmost(window: &WebviewWindow) -> Result<(), String> {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_SHOWWINDOW,
        };

        window.set_always_on_top(true).map_err(|e| e.to_string())?;

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW;
        unsafe {
            // Re-toggle topmost so we stack above the Windows 11 taskbar layer.
            let _ = SetWindowPos(hwnd, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags);
            SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{Rect, ScreenLayout};
    use tauri::WebviewWindow;

    fn monitor_bounds(m: &tauri::Monitor) -> Rect {
        let pos = m.position();
        let size = m.size();
        Rect {
            left: pos.x,
            top: pos.y,
            right: pos.x + size.width as i32,
            bottom: pos.y + size.height as i32,
        }
    }

    fn work_area_bounds(m: &tauri::Monitor) -> Rect {
        let work = m.work_area();
        let pos = work.position;
        let size = work.size;
        Rect {
            left: pos.x,
            top: pos.y,
            right: pos.x + size.width as i32,
            bottom: pos.y + size.height as i32,
        }
    }

    fn primary_monitor(window: &WebviewWindow) -> Result<tauri::Monitor, Box<dyn std::error::Error>> {
        if let Some(m) = window.current_monitor()? {
            return Ok(m);
        }
        if let Some(m) = window.primary_monitor()? {
            return Ok(m);
        }
        Err("No display found".into())
    }

    pub fn get_screen_layout(
        window: &WebviewWindow,
    ) -> Result<ScreenLayout, Box<dyn std::error::Error>> {
        let handle = primary_monitor(window)?;
        let monitor = monitor_bounds(&handle);
        let work_area = work_area_bounds(&handle);
        let taskbar_height = (monitor.bottom - work_area.bottom).max(0);
        let feet_y = work_area.bottom;

        Ok(ScreenLayout {
            work_area,
            monitor,
            taskbar_height,
            feet_y,
        })
    }

    pub fn pin_topmost(window: &WebviewWindow) -> Result<(), String> {
        window.set_always_on_top(true).map_err(|e| e.to_string())
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
mod platform {
    use super::{Rect, ScreenLayout};
    use tauri::WebviewWindow;

    pub fn get_screen_layout(
        _window: &WebviewWindow,
    ) -> Result<ScreenLayout, Box<dyn std::error::Error>> {
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
            feet_y: work_area.bottom,
        })
    }

    pub fn pin_topmost(window: &WebviewWindow) -> Result<(), String> {
        window.set_always_on_top(true).map_err(|e| e.to_string())
    }
}

#[cfg(windows)]
fn lock_file_path() -> std::path::PathBuf {
    std::env::temp_dir().join("com.minna.desktop-cat.lock")
}

#[cfg(windows)]
fn pid_is_running(pid: u32) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

    if pid == 0 {
        return false;
    }

    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return false;
        };
        let _ = CloseHandle(handle);
        true
    }
}

#[cfg(windows)]
fn remove_lock_file() {
    let _ = std::fs::remove_file(lock_file_path());
}

#[cfg(windows)]
fn already_running_message(pid: &str) -> String {
    format!(
        "Desktop Cat is already running (pid {pid}).\n\
         - Tray (near clock): right-click Desktop Cat -> Quit\n\
         - Or from desktop-cat folder: npm run dev:stop\n\
         Then run: npm run tauri dev"
    )
}

#[cfg(windows)]
fn ensure_single_instance() -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let path = lock_file_path();

    if path.exists() {
        let stale = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .is_none_or(|pid| !pid_is_running(pid));
        if stale {
            let _ = std::fs::remove_file(&path);
        } else {
            let pid = std::fs::read_to_string(&path)
                .ok()
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| "unknown".into());
            return Err(already_running_message(&pid));
        }
    }

    match OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(mut file) => {
            let _ = writeln!(file, "{}", std::process::id());
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            let pid = std::fs::read_to_string(&path)
                .ok()
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| "unknown".into());
            Err(already_running_message(&pid))
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(not(windows))]
fn ensure_single_instance() -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(msg) = ensure_single_instance() {
        eprintln!("{msg}");
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
                let _ = platform::pin_topmost(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_work_area,
            get_screen_layout,
            ensure_topmost,
            quit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            #[cfg(windows)]
            if matches!(event, tauri::RunEvent::Exit) {
                remove_lock_file();
            }
        });
}
