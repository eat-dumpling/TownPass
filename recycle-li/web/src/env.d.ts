/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
interface ImportMetaEnv {
  /** true：顯示尚未核對（status !== 'verified'）的品項，只在開發時使用 */
  readonly VITE_SHOW_UNVERIFIED?: string
  /** true：允許從 Hugging Face 下載模型（只在開發時使用；正式版必須放在 public/models） */
  readonly VITE_ALLOW_REMOTE_MODEL?: string
}
