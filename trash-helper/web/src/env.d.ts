/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
interface ImportMetaEnv {
  readonly VITE_SHOW_UNVERIFIED?: string
  readonly VITE_ALLOW_REMOTE_MODEL?: string
}
