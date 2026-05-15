use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct WorkAreaRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[tauri::command]
fn get_work_area() -> Result<WorkAreaRect, String> {
    platform::get_work_area().map_err(|e| e.to_string())
}

#[cfg(windows)]
mod platform {
    use super::WorkAreaRect;
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA};

    pub fn get_work_area() -> Result<WorkAreaRect, Box<dyn std::error::Error>> {
        let mut rect = RECT::default();
        unsafe {
            SystemParametersInfoW(
                SPI_GETWORKAREA,
                0,
                Some(std::ptr::from_mut(&mut rect).cast()),
                Default::default(),
            )?;
        }
        Ok(WorkAreaRect {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        })
    }
}

#[cfg(not(windows))]
mod platform {
    use super::WorkAreaRect;

    pub fn get_work_area() -> Result<WorkAreaRect, Box<dyn std::error::Error>> {
        Ok(WorkAreaRect {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1040,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_work_area])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
