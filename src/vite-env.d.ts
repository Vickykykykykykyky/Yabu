/// <reference types="vite/client" />

declare module '*.sql?raw' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_USE_R2: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
