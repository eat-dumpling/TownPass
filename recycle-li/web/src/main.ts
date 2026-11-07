import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import './styles/base.css'
import 'leaflet/dist/leaflet.css'
import { useGame } from './stores/game'
import { rememberBack } from './bridge/back'

rememberBack()

const app = createApp(App).use(createPinia()).use(router).use(i18n)
useGame().load().finally(() => {
  app.mount('#app')
  // 首頁畫好後在背景預先載入辨識模型，按「掃描」時多半已經好了（src/vision/preload.ts）
  import('./vision/preload').then((m) => m.preloadVision()).catch(() => {})
})
