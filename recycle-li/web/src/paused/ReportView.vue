<script setup lang="ts">
// 16 本週家庭報告：只存在手機。數字是家庭自己回報的估計（標明）。
// 臺北市回收率（以重量計）和家庭袋數口徑不同，不在報告裡比較。
import { computed } from 'vue'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import { PRICE_PER_LITER, useGame, weekKey } from '@/stores/game'

const game = useGame()
const thisWeek = weekKey()
const lastWeek = (() => { const d = new Date(`${thisWeek}T12:00:00+08:00`); d.setDate(d.getDate() - 7); return weekKey(d) })()
const sum = (wk: string) => game.disposals.filter((d) => weekKey(new Date(`${d.date}T12:00:00+08:00`)) === wk)
const now = computed(() => sum(thisWeek))
const prev = computed(() => sum(lastWeek))
const liters = (ds: typeof game.disposals) => ds.reduce((s, d) => s + d.generalLiters, 0)
const diffL = computed(() => liters(prev.value) - liters(now.value))
const saved = computed(() => Math.round(diffL.value * PRICE_PER_LITER))
const recycle = computed(() => now.value.reduce((s, d) => s + d.recycleBags, 0))
const onTime = computed(() => now.value.filter((d) => d.onTime).length)
const newLearned = computed(() => game.weekly.counts.item_learned ?? 0)
const accuracy = computed(() => {
  const es = Object.values(game.codex)
  const c = es.reduce((s, e) => s + e.correct, 0)
  const w = es.reduce((s, e) => s + e.wrong, 0)
  return c + w ? Math.round((c / (c + w)) * 100) : 0
})
const headline = computed(() =>
  prev.value.length && diffL.value > 0 ? `少 ${diffL.value} 公升，省 ${saved.value} 元` : `一般垃圾 ${liters(now.value)} 公升`,
)
</script>

<template>
  <main class="page stack">
    <TopBar :title="headline" back="/" />
    <Mascot mood="cheer" :line="headline" />
    <div class="grid2">
      <div class="tile"><span class="art" aria-hidden="true">🗑️</span>{{ liters(now) }} 公升<span class="caption">約 {{ Math.round(liters(now) * PRICE_PER_LITER) }} 元</span></div>
      <div class="tile"><span class="art" aria-hidden="true">♻️</span>{{ recycle }} 袋回收</div>
      <div class="tile"><span class="art" aria-hidden="true">⏰</span>準時 {{ onTime }} 次</div>
      <div class="tile gold"><span class="art" aria-hidden="true">🃏</span>新學會 {{ newLearned }}</div>
      <div class="tile"><span class="art" aria-hidden="true">⭐</span>分對率 {{ accuracy }}%</div>
      <div class="tile"><span class="art" aria-hidden="true">🔥</span>連續 {{ game.streak.count }} 天</div>
    </div>
    <p class="caption">數字是家庭自己回報的估計；專用垃圾袋每公升 {{ PRICE_PER_LITER }} 元。只存在這支手機。</p>
  </main>
</template>

<style scoped>.art { font-size: 2.6rem; }</style>
