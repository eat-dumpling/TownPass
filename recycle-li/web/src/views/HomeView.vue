<script setup lang="ts">
// 首頁：一條循環——掃一掃 → 拿到資源 → 蓋我的里 → 任務與成就。畫面上最大的是「掃一掃」。
import Zy from '@/components/Zy.vue'
import { computed } from 'vue'
import Mascot from '@/components/Mascot.vue'
import IsoLi from '@/components/IsoLi.vue'
import RankBar from '@/components/RankBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import { missions } from '@/domain/catalog'
import { useGame } from '@/stores/game'

const game = useGame()
// 下一個還沒完成的今日任務
const nextMission = computed(() => {
  const m = missions.filter((x) => x.type.startsWith('daily')).find((x) => !game.missionProgress(x.id).done)
  return m ? { m, p: game.missionProgress(m.id) } : null
})
</script>

<template>
  <main class="page stack">
    <header class="row top">
      <h1 class="title"><Zy text="回收小里長" /></h1>
      <router-link to="/settings" class="btn ghost" aria-label="設定（家長）"><AppIcon name="Settings" :size="26" /></router-link>
    </header>

    <router-link to="/build" class="li card" aria-label="我的里，去蓋房子">
      <IsoLi :li="game.li" :slots="game.slots" class="mini" />
      <p class="green"><AppIcon name="Leaf" :size="16" /> <Zy text="綠意" /> {{ game.green }}</p>
    </router-link>

    <RankBar compact />

    <Mascot line="掃一掃要丟的東西，拿星星蓋房子！" :size="64" />

    <router-link to="/scan" class="hero btn secondary">
      <AppIcon name="Camera" :size="72" :stroke="1.6" />
      <span><Zy text="掃一掃" /></span>
    </router-link>
    <div class="grid2">
      <router-link to="/pick" class="btn"><AppIcon name="HandClick" /> <Zy text="用選的" /></router-link>
      <router-link to="/quiz" class="btn primary"><AppIcon name="Map" /> <Zy text="考考你" /></router-link>
    </div>

    <router-link v-if="nextMission" to="/missions" class="card row mission">
      <AppIcon :name="nextMission.m.icon" :size="30" />
      <div style="flex: 1" class="stack tight">
        <strong><Zy :text="nextMission.m.title" /></strong>
        <div class="bar"><i :style="{ width: (nextMission.p.count / nextMission.p.goal) * 100 + '%' }"></i></div>
      </div>
      <span class="cnt">{{ nextMission.p.count }}/{{ nextMission.p.goal }}</span>
    </router-link>

    <nav class="grid3" aria-label="更多">
      <router-link to="/build" class="tile"><AppIcon name="Building" :size="40" :stroke="1.6" /><Zy text="蓋房子" /></router-link>
      <router-link to="/missions" class="tile"><AppIcon name="Trophy" :size="40" :stroke="1.6" /><Zy text="任務成就" /></router-link>
      <router-link to="/codex" class="tile"><AppIcon name="Award" :size="40" :stroke="1.6" /><Zy text="圖鑑" /></router-link>
    </nav>
  </main>
</template>

<style scoped>
.top { justify-content: space-between; }
.title { font-size: var(--fs-h2); margin: 0; color: var(--primary-900); }
.li { padding: 14px 10px 10px; background: linear-gradient(180deg, #E7F6FA, #D5EEDB); text-decoration: none; display: block; }
.mini { max-width: 260px; margin: 0 auto; }
.green { margin: 6px 0 0; font-weight: 700; color: #2F6B3A; display: flex; align-items: center; gap: 4px; }
.res { list-style: none; padding: 0; margin: 0; display: flex; justify-content: space-between; gap: 6px; }
.res li { background: var(--white); border-radius: 999px; padding: 6px 10px; font-weight: 700; box-shadow: var(--shadow); display: flex; align-items: center; gap: 4px; }
.hero { min-height: 160px; font-size: var(--fs-h1); flex-direction: column; border-radius: 28px; }
.mission { text-decoration: none; color: var(--gray-900); }
.tight { gap: 4px; }
.cnt { font-weight: 800; color: var(--primary-700); }
</style>
