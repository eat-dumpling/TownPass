<script setup lang="ts">
// 9 任務：每天 3 個（學習、行動〔只在收運日〕、探索）＋本週減量任務。
import { computed, ref } from 'vue'
import TopBar from '@/components/TopBar.vue'
import ParentGate from '@/components/ParentGate.vue'
import { missions } from '@/domain/catalog'
import { useGame } from '@/stores/game'
import { isCollectionDay } from '@/solvers/schedule'

const game = useGame()
const dayNo = new Date().getDate()
const today = computed(() => {
  const learn = missions.filter((m) => m.type === 'daily_learning')
  const explore = missions.filter((m) => m.type === 'daily_explore')
  const out = [learn[dayNo % learn.length]]
  if (isCollectionDay(new Date())) out.push(missions.find((m) => m.type === 'daily_action')!)
  out.push(explore[dayNo % explore.length])
  return out
})
const weekly = missions.filter((m) => m.type === 'weekly_reduce')
const gate = ref(false)
</script>

<template>
  <main class="page stack">
    <TopBar title="今天的任務" back="/" />
    <ul class="list">
      <li v-for="m in today" :key="m.id" class="card row" :class="{ done: game.missionProgress(m.id).done }">
        <span class="art" aria-hidden="true">{{ m.emoji }}</span>
        <div style="flex: 1" class="stack">
          <strong>{{ m.title }}</strong>
          <div class="bar"><i :style="{ width: (game.missionProgress(m.id).count / game.missionProgress(m.id).goal) * 100 + '%' }"></i></div>
        </div>
        <span aria-label="完成">{{ game.missionProgress(m.id).done ? '✅' : `${game.missionProgress(m.id).count}/${game.missionProgress(m.id).goal}` }}</span>
      </li>
    </ul>
    <h2 class="h2">📅 本週</h2>
    <ul class="list">
      <li v-for="m in weekly" :key="m.id" class="card row">
        <span class="art" aria-hidden="true">{{ m.emoji }}</span>
        <div style="flex: 1" class="stack">
          <strong>{{ m.title }}</strong>
          <div class="bar"><i :style="{ width: (game.missionProgress(m.id).count / game.missionProgress(m.id).goal) * 100 + '%' }"></i></div>
        </div>
        <button class="btn" aria-label="家長確認一次" @click="gate = true">👍</button>
      </li>
    </ul>
    <ParentGate v-if="gate" @pass="game.confirmReduce(); gate = false" />
  </main>
</template>

<style scoped>
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.art { font-size: 2.4rem; }
.done { background: #F0FAF0; }
.h2 { font-size: var(--fs-title); margin: 8px 0 0; }
</style>
