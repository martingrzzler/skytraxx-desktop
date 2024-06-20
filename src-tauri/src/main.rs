// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::{Deserialize, Serialize};
use std::fs::File;
use sysinfo::{Disks, System};
use tar::Archive;
use tauri::api::path;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            find_skytraxx_mountpoint,
            extract_transfer_tar
        ])
        // .setup(|app| {
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn find_skytraxx_mountpoint() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = Disks::new_with_refreshed_list();
    let mut mountpoint = String::new();

    for disk in disks.iter() {
        if disk.name().eq_ignore_ascii_case("skytraxx") {
            match disk.mount_point().to_str() {
                None => (),
                Some(mount) => {
                    mountpoint = mount.to_string();
                }
            }
        }
    }

    mountpoint
}

#[tauri::command]
fn extract_transfer_tar(tar_path: &str, mountpoint: &str) -> FrontendResult {
    let download_dir = path::download_dir().unwrap();
    let f = match File::open(format!("{}/{}", download_dir.to_str().unwrap(), tar_path)) {
        Ok(f) => f,
        Err(e) => return FrontendResult::error(e.to_string()),
    };
    let mut ar = Archive::new(f);

    match ar.unpack(format!("{mountpoint}/update")) {
        Ok(_) => (),
        Err(e) => return FrontendResult::error(e.to_string()),
    }

    FrontendResult::result("Tar extracted successfully".to_string())
}

#[derive(Serialize, Deserialize, Debug)]
struct FrontendResult {
    error: String,
    result: String,
}

impl FrontendResult {
    fn new(error: String, result: String) -> Self {
        FrontendResult { error, result }
    }

    fn error(error: String) -> Self {
        FrontendResult {
            error,
            result: String::new(),
        }
    }

    fn result(result: String) -> Self {
        FrontendResult {
            error: String::new(),
            result,
        }
    }
}
