/// Desktop shell for the static Next.js export in ../out.
/// All application logic lives in the web build; this crate only hosts it.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Control Center");
}
