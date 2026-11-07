<script setup lang="ts">
// 孩子的底部選單（照台北通 Figma）：白底、灰色線條圖示，選到的那一個變藍綠。
// 決選版只有兩個：家、圖鑑。掃一掃是首頁的大按鈕，選單不再放第二個（考考你從首頁的大按鈕進去；蓋房子從首頁的小島進去）。
import { useRoute, useRouter } from 'vue-router'
import { switchTab } from '@/nav'
import AppIcon from './AppIcon.vue'
import Zy from './Zy.vue'

const route = useRoute()
const router = useRouter()
const on = (p: string) => (p === '/' ? route.path === '/' : route.path.startsWith(p))
</script>

<template>
  <nav class="dock" aria-label="主選單">
    <router-link to="/" @click.prevent="switchTab(router, '/')" class="it home" :class="{ on: on('/') }" :aria-current="on('/') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Home" :size="26" :stroke="2" /></span><span class="lb"><Zy text="家" /></span>
    </router-link>
    <router-link to="/codex" @click.prevent="switchTab(router, '/codex')" class="it codex" :class="{ on: on('/codex') }" :aria-current="on('/codex') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Book" :size="26" :stroke="2" /></span><span class="lb"><Zy text="圖鑑" /></span>
    </router-link>
  </nav>
</template>

<style scoped>
.dock {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: grid; grid-template-columns: repeat(2, 1fr); align-items: end;
  max-width: 560px; margin: 0 auto; padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, .94); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border-radius: 26px 26px 0 0; box-shadow: 0 -6px 24px rgba(17, 38, 41, .1);
}
.it { --c: #5AB4C5; display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; color: var(--gray-600); min-height: 64px; justify-content: flex-end; }
.ic { width: 44px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--gray-500); transition: transform .15s; }
.lb { font-size: .78rem; font-weight: 700; white-space: nowrap; color: var(--gray-500); }
.on .ic { color: var(--primary-600); }
.on .lb { color: var(--primary-600); }
.it:active .ic { transform: scale(.94); }
</style>
