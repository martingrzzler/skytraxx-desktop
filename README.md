# Skytraxx Desktop App


## Installation
1. Rust
2. Node.js
3. GO

## Development
1. Clone the repository
2. Run `npm install`
3. Run `npm run tauri dev`
4. Run `npm run serve:archive` to serve debug archive with the go server

## Build
Tauri does not support cross-compiling yet, so you need to build the app on the target platform.

### MACOS
Build for both Apple Silicon and Intel
```bash
npm run tauri build -- --target universal-apple-darwin
```

### WINDOWS
```bash
npm run tauri build
```
