<script setup lang="ts">
// 孩子的底部選單（照台北通 Figma）：白底、灰色線條圖示，選到的那一個變藍綠；中間凸起的藍綠圓鈕是「掃一掃」。
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'
import Zy from './Zy.vue'

const route = useRoute()
const on = (p: string) => (p === '/' ? route.path === '/' : route.path.startsWith(p))
</script>

<template>
  <nav class="dock" aria-label="主選單">
    <router-link to="/" class="it home" :class="{ on: on('/') }" :aria-current="on('/') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Home" :size="26" :stroke="2" /></span><span class="lb"><Zy text="家" /></span>
    </router-link>
    <router-link to="/quiz" class="it quiz" :class="{ on: on('/quiz') }" :aria-current="on('/quiz') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Map" :size="26" :stroke="2" /></span><span class="lb"><Zy text="考考你" /></span>
    </router-link>
    <router-link to="/scan" class="it scan" aria-label="掃一掃">
      <span class="ic big"><AppIcon name="Camera" :size="36" :stroke="2" /></span>
    </router-link>
    <router-link to="/build" class="it build" :class="{ on: on('/build') }" :aria-current="on('/build') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Building" :size="26" :stroke="2" /></span><span class="lb"><Zy text="蓋房子" /></span>
    </router-link>
    <router-link to="/codex" class="it codex" :class="{ on: on('/codex') }" :aria-current="on('/codex') ? 'page' : undefined">
      <span class="ic"><AppIcon name="Book" :size="26" :stroke="2" /></span><span class="lb"><Zy text="圖鑑" /></span>
    </router-link>
  </nav>
</template>

<style scoped>
.dock {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: grid; grid-template-columns: repeat(5, 1fr); align-items: end;
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
.ic.big {
  width: 66px; height: 66px; border-radius: 50%; margin-top: -28px; color: #fff;
  background: var(--primary-500); box-shadow: 0 6px 16px rgba(90, 180, 197, .45); border: 4px solid #fff;
}
.scan { justify-content: center; }
</style>
