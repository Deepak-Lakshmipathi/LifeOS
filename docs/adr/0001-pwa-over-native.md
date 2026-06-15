# Installable PWA over Tauri / Flutter / native

LifeOS must run on both Windows and Android for a solo builder working with AI assistance. We chose an **installable PWA** (Vite + React + TypeScript) over Tauri+Rust, Flutter, React Native, or Capacitor.

Why: one web codebase installs on both targets, the web toolchain is the fastest path for AI-assisted iteration, and it gives direct access to the animation libraries (Framer Motion) that carry the Apple-feel polish. Tauri+Rust and Flutter add a real learning curve and raise the floor for a solo developer without buying anything Slice 1 needs.

Trade-off accepted: a PWA cannot match every native affordance (e.g. haptics degrade to mobile-only, no app-store native distribution). Reversible only at meaningful cost once UI and data layers are built, so recorded here.
