<script setup lang="ts">
// 孩子的底部選單：像遊戲一樣，五個大圓鈕，中間最大的是「掃一掃」。
// 每個功能一種顏色（家＝藍綠、考考你＝天藍、掃一掃＝黃、蓋房子＝綠、圖鑑＝紫），整個 App 都用同一套顏色。
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
.it { --c: #468D9B; display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; color: var(--gray-600); min-height: 64px; justify-content: flex-end; }
.ic { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 12%, white); transition: transform .15s; }
.lb { font-size: .78rem; font-weight: 800; white-space: nowrap; }
.on .ic { background: var(--c); color: #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 70%, black); transform: translateY(-2px); }
.on .lb { color: var(--c); }
.it:active .ic { transform: scale(.94); }
.home { --c: #468D9B; }
.quiz { --c: #3D9DC0; }
.build { --c: #4E9A57; }
.codex { --c: #8A63C8; }
.scan { --c: #E7A43C; }
.ic.big {
  width: 70px; height: 70px; border-radius: 50%; margin-top: -30px; color: #3B2A06;
  background: radial-gradient(circle at 35% 30%, #FFE7A8, #F5BA4B 60%, #E7A43C);
  box-shadow: 0 6px 0 #C98A2E, 0 10px 18px rgba(231, 164, 60, .35); border: 4px solid #fff;
}
.scan { justify-content: center; }
</style>
