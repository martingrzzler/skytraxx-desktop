// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::thread;
use std::{
    collections::HashMap,
    fs::{self, File},
};
use sysinfo::Disks;
use tar::Archive;
use tauri::api::path;
use tauri::Window;
use tokio::io::AsyncWriteExt;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_skytraxx_device,
            update_device,
            download_archive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct DownloadProgress {
    total: u64,
    downloaded: u64,
}

#[tauri::command]
async fn download_archive(window: Window, url: &str, file_name: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .or(Err("Failed to download archive"))?;

    let total = response.content_length().unwrap_or(0);
    let download_dir = path::download_dir().unwrap();

    let file_path = format!("{}/{}", download_dir.to_str().unwrap(), file_name);
    let mut file = tokio::io::BufWriter::new(
        tokio::fs::File::create(file_path)
            .await
            .or(Err("Failed to create file"))?,
    );
    let mut stream = response.bytes_stream();

    let mut downloaded = 0;
    while let Some(chunk) = stream.try_next().await.or(Err("Failed to get chunk"))? {
        thread::sleep(std::time::Duration::from_millis(100));
        file.write_all(&chunk)
            .await
            .or(Err("Failed to write chunk"))?;
        downloaded += chunk.len() as u64;
        let _ = window.emit("DOWNLOAD_PROGRESS", DownloadProgress { total, downloaded });
    }

    file.flush().await.or(Err("Failed to flush file"))?;

    Ok(())
}

#[tauri::command]
fn get_skytraxx_device() -> FrontendResult<DeviceInfo> {
    let dict = match get_device_info() {
        Ok(d) => d,
        Err(e) => return FrontendResult::error(e.to_string()),
    };

    let device_name = match dict.get("hw") {
        Some(name) => name.to_string(),
        None => return FrontendResult::error("device_name not found".to_string()),
    };

    let software_version = match dict.get("sw") {
        Some(version) => version.to_string(),
        None => return FrontendResult::error("software_version not found".to_string()),
    };

    FrontendResult::result(DeviceInfo {
        device_name,
        software_version,
    })
}

#[tauri::command]
fn update_device(tar_path: &str, software_version: &str) -> FrontendResult<String> {
    let download_dir = path::download_dir().unwrap();
    let f = match File::open(format!("{}/{}", download_dir.to_str().unwrap(), tar_path)) {
        Ok(f) => f,
        Err(e) => return FrontendResult::error(e.to_string()),
    };
    let mut ar = Archive::new(f);

    let mountpoint = match find_mountpoint("skytraxx") {
        Some(m) => m,
        None => return FrontendResult::error("Skytraxx not found".to_string()),
    };

    match ar.unpack(format!("{}/data", mountpoint)) {
        Ok(_) => (),
        Err(e) => return FrontendResult::error(e.to_string()),
    }

    match update_device_info(software_version) {
        Ok(_) => (),
        Err(e) => return FrontendResult::error(e.to_string()),
    }

    FrontendResult::result("Tar extracted successfully".to_string())
}

fn get_device_info() -> Result<HashMap<String, String>, String> {
    let mountpoint = match find_mountpoint("Skytraxx") {
        Some(m) => m,
        None => {
            return Err("Skytraxx not found".to_string());
        }
    };

    let sys_file_content = fs::read_to_string(format!("{}/.sys/hwsw.info", mountpoint))
        .or(Err("Failed to read file"))?;

    return Ok(parse_lines(&sys_file_content));
}

fn update_device_info(software_version: &str) -> Result<(), String> {
    let mountpoint = match find_mountpoint("Skytraxx") {
        Some(m) => m,
        None => {
            return Err("Skytraxx not found".to_string());
        }
    };
    let mut dict = get_device_info()?;
    dict.insert("sw".to_string(), software_version.to_string());

    fs::write(format!("{}/.sys/hwsw.info", mountpoint), write_lines(dict))
        .or(Err("failed to write to file")?)
}

fn find_mountpoint(vol_name: &str) -> Option<String> {
    let disks = Disks::new_with_refreshed_list();

    for disk in disks.iter() {
        if disk.name().eq_ignore_ascii_case(vol_name) {
            match disk.mount_point().to_str() {
                Some(mountpoint) => return Some(mountpoint.to_string()),
                None => return None,
            }
        }
    }

    None
}

fn write_lines(dict: HashMap<String, String>) -> String {
    let mut lines = String::new();

    for (key, value) in dict.iter() {
        lines.push_str(&format!("{}=\"{}\"\n", key, value));
    }

    lines
}

fn parse_lines(file_content: &str) -> HashMap<String, String> {
    let mut dict: HashMap<String, String> = HashMap::new();

    for line in file_content.lines() {
        let parts: Vec<&str> = line.split('=').collect();
        if parts.len() == 2 {
            let key = parts[0].to_string();
            let value = parts[1].to_string().replace("\"", "");
            dict.insert(key, value);
        }
    }

    dict
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lines() {
        let file_content = "hw=\"Skytraxx 3.0\"\nsw=\"3.0.0\"";
        let dict = parse_lines(file_content);

        assert_eq!(dict.get("hw").unwrap(), "Skytraxx 3.0");
        assert_eq!(dict.get("sw").unwrap(), "3.0.0");
    }

    #[test]
    fn test_write_lines() {
        let mut dict: HashMap<String, String> = HashMap::new();
        dict.insert("hw".to_string(), "Skytraxx 3.0".to_string());
        dict.insert("sw".to_string(), "3.0.0".to_string());

        let lines = write_lines(dict);

        assert_eq!(lines, "hw=\"Skytraxx 3.0\"\nsw=\"3.0.0\"\n");
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct DeviceInfo {
    device_name: String,
    software_version: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct FrontendResult<T> {
    error: String,
    result: Option<T>,
}

impl<T> FrontendResult<T> {
    fn error(error: String) -> Self {
        FrontendResult {
            error,
            result: None,
        }
    }

    fn result(result: T) -> Self {
        FrontendResult {
            error: String::new(),
            result: Some(result),
        }
    }
}
