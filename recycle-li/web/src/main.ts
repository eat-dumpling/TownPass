import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import './styles/base.css'
import 'leaflet/dist/leaflet.css'
import { useGame } from './stores/game'

const app = createApp(App).use(createPinia()).use(router).use(i18n)
useGame().load().finally(() => app.mount('#app'))
