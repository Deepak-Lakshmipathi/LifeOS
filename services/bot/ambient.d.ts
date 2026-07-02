// Minimal ImportMeta.env ambient shape so `tsc --noEmit` can type-check files
// pulled transitively from the Vite-based src/ tree (e.g. src/vault/transport.ts,
// imported here only for its VaultTransport interface — the bot never
// instantiates GitTransport). The real shape lives in Vite's own
// `vite/client` types, which aren't installed in this standalone project.
interface ImportMetaEnv {
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
