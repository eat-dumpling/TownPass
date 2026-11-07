import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n, type LangId } from './i18n'
import './styles/base.css'

// 語言：記住使用者的選擇；第一次用瀏覽器語言（中文 → zh，其他 → en）
const saved = (() => { try { return localStorage.getItem('tth-lang') } catch { return null } })()
const guess: LangId = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
i18n.global.locale.value = (saved as LangId) || guess
document.documentElement.lang = i18n.global.locale.value === 'zh' ? 'zh-Hant-TW' : 'en'

createApp(App).use(router).use(i18n).mount('#app')
