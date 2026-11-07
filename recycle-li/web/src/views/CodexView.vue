<script setup lang="ts">
// 圖鑑（探索）：依回收標誌的分類排列。找到的東西是彩色、可以點開分辨卡；沒找到的是剪影，給一個「去哪找」的提示。
// 每種東西有星星上限（speciesCap），拿完了就要去找新的東西；一個分類全部找到多 5 顆星。
import { computed } from 'vue'
import Zy from '@/components/Zy.vue'
import KidHud from '@/components/KidHud.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import { groups, kindMeta, visibleItems } from '@/domain/catalog'
import type { Item, KindId } from '@/domain/types'
import { speciesCap, useGame } from '@/stores/game'

const game = useGame()
const items = visibleItems().filter((i) => i.status !== 'conflict')
const KINDS: KindId[] = ['paper', 'plastic', 'glass', 'can', 'tetra', 'metal', 'other', 'food', 'general', 'hazard', 'bulky', 'special']
const sections = computed(() =>
  KINDS.map((k) => {
    const list = items.filter((i) => i.kind === k)
    return { k, list, found: list.filter((i) => game.isFound(i.id)).length, done: game.collections.includes(k) }
  }).filter((s) => s.list.length),
)
const found = computed(() => items.filter((i) => game.isFound(i.id)).length)
const learned = computed(() => items.filter((i) => game.codex[i.id]?.learned).length)
const groupOf = (i: Item) => groups.find((g) => g.id === i.group)
const fruitOf = (i: Item) => game.codex[i.id]?.fruit ?? 0
</script>

<template>
  <main class="page stack">
    <KidHud title="圖鑑" />

    <section class="card sum">
      <div><strong>{{ found }}</strong><span>/{{ items.length }}</span><small><AppIcon name="Search" :size="16" /> <Zy text="找到" /></small></div>
      <div><strong>{{ learned }}</strong><small><AppIcon name="Award" :size="16" /> <Zy text="學會" /></small></div>
      <div><strong>{{ game.collections.length }}</strong><small><StarIcon :size="16" /> <Zy text="集滿" /></small></div>
    </section>

    <template v-for="s in sections" :key="s.k">
      <h2 class="h2" :style="{ '--k': kindMeta[s.k].color }">
        <AppIcon :name="kindMeta[s.k].icon" :size="20" /> <Zy :text="kindMeta[s.k].label" />
        <span class="cnt">{{ s.found }}/{{ s.list.length }}</span>
        <AppIcon v-if="s.done" name="CircleCheck" :size="20" label="集滿了" />
        <span v-else class="bonus"><StarIcon :size="18" />+5</span>
      </h2>
      <div class="bar"><i :style="{ width: (s.found / s.list.length) * 100 + '%', background: kindMeta[s.k].color }"></i></div>
      <div class="grid3">
        <template v-for="it in s.list" :key="it.id">
          <router-link v-if="game.isFound(it.id)" :to="`/codex/${it.id}`" class="tile cell" :class="{ gold: game.codex[it.id]?.learned }">
            <ItemArt :item="it" :size="52" />
            <span class="nm"><Zy :text="it.name.zh" /></span>
            <span class="meter" :aria-label="`星星 ${fruitOf(it)}/${speciesCap(it)}`">
              <i v-for="n in speciesCap(it)" :key="n" :class="{ on: n <= fruitOf(it) }"></i>
            </span>
            <AppIcon v-if="!game.codex[it.id]?.read" name="Book" :size="18" class="unread" label="分辨卡還沒讀" />
          </router-link>
          <div v-else class="tile cell hidden" :aria-label="`還沒找到，提示：${groupOf(it)?.label}`">
            <span class="sil"><ItemArt :item="it" :size="52" /></span>
            <span class="nm">？？？</span>
            <small class="hint"><AppIcon :name="groupOf(it)?.icon ?? 'Search'" :size="14" /> <Zy :text="groupOf(it)?.label ?? ''" /></small>
          </div>
        </template>
      </div>
    </template>
    <router-link to="/guide" class="btn block"><AppIcon name="Book2" /> <Zy text="分類指南" /></router-link>
  </main>
</template>

<style scoped>
.sum { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 6px; }
.sum strong { font-size: var(--fs-h1); color: var(--primary-700); }
.sum span { color: var(--gray-500); font-weight: 700; }
.sum small { display: flex; justify-content: center; align-items: center; gap: 4px; color: var(--gray-600); }
.h2 { font-size: var(--fs-h3); margin: 10px 0 0; color: #fff; background: var(--k); border-radius: 10px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; }
.h2 .cnt { margin-left: auto; font-weight: 800; }
.bonus { background: #fff; color: #AD7B2B; border-radius: 999px; padding: 0 8px 0 4px; display: inline-flex; align-items: center; font-weight: 800; }
.bar { height: 8px; }
.cell { position: relative; gap: 4px; min-height: 132px; }
.nm { font-size: var(--fs-body); text-align: center; font-weight: 700; }
.meter { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; max-width: 80px; }
.meter i { width: 7px; height: 7px; border-radius: 50%; background: var(--gray-200); }
.meter i.on { background: #F5BA4B; }
.unread { position: absolute; top: 6px; right: 6px; color: var(--secondary-600); }
.hidden { background: var(--gray-50); box-shadow: none; border: 2px dashed var(--gray-200); }
.sil { filter: brightness(0) opacity(.18); }
.hint { color: var(--gray-600); display: inline-flex; align-items: center; gap: 2px; }
</style>
