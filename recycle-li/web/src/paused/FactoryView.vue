<script setup lang="ts">
// 10 回收工廠（OR② 整數規劃）：孩子決定每種建築蓋幾個，星星＝孩子的綠意值 ÷ 最佳綠意值。
// 工廠長的提示分兩段：先說「你的 X 還沒用完」，第二次才顯示最佳組合。
// 資源配方與綠意值是遊戲設定，不代表真實的回收比例。
import { computed, reactive, ref } from 'vue'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import { buildings, resourceMeta } from '@/domain/catalog'
import type { ResourceId } from '@/domain/types'
import { useGame } from '@/stores/game'
import { feasible, hint, solve, stars, value, type Counts, type FactoryInput } from '@/solvers/factory'

const game = useGame()
const DIVERSITY = 2
const freeSlots = computed(() => game.slots.filter((s) => !s).length)
const usable = computed(() => buildings.filter((b) => !b.special || game.weekly.claimed.includes('weekly_own_cup') || game.resources.gold > 0))
const input = computed<FactoryInput>(() => ({ buildings: usable.value, resources: { ...game.resources }, slots: freeSlots.value, diversityBonus: DIVERSITY }))
const plan = reactive<Counts>({})
const best = computed(() => solve(input.value))
const mine = computed(() => value(input.value, plan))
const ok = computed(() => feasible(input.value, plan))
const star = computed(() => stars(mine.value, best.value.value))
const hints = ref(0)
const hintRes = computed(() => hint(input.value, plan))
const res: ResourceId[] = ['plastic', 'paper', 'metal', 'compost', 'gold']

function inc(id: string, d: number) {
  plan[id] = Math.max(0, (plan[id] ?? 0) + d)
  if (!plan[id]) delete plan[id]
}
function buildAll() {
  for (const [id, n] of Object.entries(plan)) {
    for (let k = 0; k < n; k++) {
      const slot = game.slots.findIndex((s) => !s)
      if (slot < 0 || !game.build(id, slot)) break
    }
  }
  game.say('🏗️', `蓋好了！${'⭐'.repeat(star.value)}`)
  Object.keys(plan).forEach((k) => delete plan[k])
  hints.value = 0
}
</script>

<template>
  <main class="page stack">
    <TopBar title="蓋什麼好？" back="/" />
    <ul class="res">
      <li v-for="r in res" :key="r"><span aria-hidden="true">{{ resourceMeta[r].emoji }}</span><span class="sr-only">{{ resourceMeta[r].label }}</span> {{ game.resources[r] }}</li>
      <li>🟩 空地 {{ freeSlots }}</li>
    </ul>
    <div class="stack">
      <div v-for="b in usable" :key="b.id" class="card row bcard">
        <span class="art" aria-hidden="true">{{ b.emoji }}</span>
        <div style="flex: 1">
          <strong>{{ b.name }}</strong>
          <p class="caption">
            <span v-for="(n, r) in b.cost" :key="r">{{ resourceMeta[r as ResourceId].emoji }}×{{ n }} </span>
            → 🌿{{ b.green }}
          </p>
        </div>
        <button class="btn" :aria-label="`少蓋一個${b.name}`" @click="inc(b.id, -1)">−</button>
        <strong class="cnt" aria-live="polite">{{ plan[b.id] ?? 0 }}</strong>
        <button class="btn" :aria-label="`多蓋一個${b.name}`" @click="inc(b.id, 1)">＋</button>
      </div>
    </div>
    <div class="card center">
      <p class="stars" :aria-label="`${star} 顆星`">{{ ok ? '⭐'.repeat(star) + '☆'.repeat(3 - star) : '❌ 資源或空地不夠' }}</p>
      <p class="muted">🌿 {{ mine }} ／ 最多 {{ best.value }}（多蓋不同種類 +{{ DIVERSITY }}）</p>
    </div>
    <Mascot v-if="hints === 1" mood="think" :size="44" :line="hintRes ? `你的${resourceMeta[hintRes].label}還沒用完` : '換一種組合試試'" />
    <Mascot v-if="hints >= 2" mood="happy" :size="44" :line="'最佳：' + Object.entries(best.counts).map(([id, n]) => (buildings.find((b) => b.id === id)?.emoji ?? '') + '×' + n).join(' ')" />
    <div class="grid2">
      <button class="btn" @click="hints++">🧑‍🏭 工廠長提示</button>
      <button class="btn primary" :disabled="!ok || !Object.keys(plan).length" @click="buildAll">🏗️ 蓋下去</button>
    </div>
    <p class="caption center">配方與綠意值是遊戲設定</p>
  </main>
</template>

<style scoped>
.res { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.res li { background: var(--white); border-radius: 999px; padding: 6px 10px; font-weight: 700; box-shadow: var(--shadow); }
.art { font-size: 2.4rem; }
.bcard { padding: 10px 12px; }
.caption { margin: 2px 0 0; }
.cnt { min-width: 24px; text-align: center; font-size: var(--fs-title); }
.stars { font-size: 2rem; margin: 0; }
</style>
