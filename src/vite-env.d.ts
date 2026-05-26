/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_R2: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
