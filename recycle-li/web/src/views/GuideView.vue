<script setup lang="ts">
// 完整分類指南：分頁依臺北市環保局「資源回收分類方式」的大類（立體類、平面類、其他類、一般垃圾、特殊）。
// 每張卡用回收標誌的顏色；學會的卡變金色。9–12 歲可以打字搜尋。
import { computed, ref } from 'vue'
import TopBar from '@/components/TopBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import { categoryMeta, daysText, kindMeta, officialCategories, safetyLabel, visibleItems } from '@/domain/catalog'
import type { Item } from '@/domain/types'
import { useGame } from '@/stores/game'

const game = useGame()
type Tab = 'recycle_3d' | 'recycle_flat' | 'other' | 'general' | 'special'
const tabs: { id: Tab; label: string }[] = [
  { id: 'recycle_3d', label: '立體類' },
  { id: 'recycle_flat', label: '平面類' },
  { id: 'other', label: '其他類' },
  { id: 'general', label: '一般垃圾' },
  { id: 'special', label: '特殊' },
]
const tab = ref<Tab>('recycle_3d')
const q = ref('')

function tabOf(i: Item): Tab {
  if (i.category === 'food') return 'other' // 官方：廚餘屬其他類
  if (i.category === 'bulky' || i.category === 'special' || i.category === 'unknown') return 'special'
  return i.category as Tab
}
const list = computed(() => {
  const all = visibleItems()
  const t = q.value.trim().toLowerCase()
  if (t) return all.filter((i) => i.name.zh.includes(t) || i.name.en.toLowerCase().includes(t))
  return all.filter((i) => tabOf(i) === tab.value)
})
// 分頁頂端：這一大類有哪些官方子類、星期幾收
const subs = computed(() => {
  const major = { recycle_3d: '立體類', recycle_flat: '平面類', other: '其他類', general: '不可回收', special: '大型家具、家電暨四機類' }[tab.value]
  return officialCategories.filter((c) => c.major === major)
})
const tabColor = (t: Tab) => (t === 'general' ? categoryMeta.general.color : categoryMeta[t].color)
</script>

<template>
  <main class="page stack">
    <TopBar title="分類指南" back="/" />
    <input v-if="game.age === 'older'" v-model="q" class="search" type="search" placeholder="找品項" aria-label="搜尋品項" />
    <div class="tabs" role="tablist">
      <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="tab === t.id" class="tabbtn"
        :style="tab === t.id ? { background: tabColor(t.id), color: '#fff' } : {}" @click="tab = t.id; q = ''">
        {{ t.label }}
      </button>
    </div>
    <ul v-if="!q" class="subs">
      <li v-for="s in subs" :key="s.id"><b>{{ s.sub }}</b> <span>{{ s.days.length ? daysText(s.days) + '回收' : s.when }}</span></li>
    </ul>
    <div class="grid3" role="tabpanel">
      <router-link v-for="it in list" :key="it.id" :to="`/guide/${it.id}`" class="tile item"
        :class="{ gold: game.codex[it.id]?.learned, 'danger-frame': it.safety !== 'none' }">
        <ItemArt :item="it" :size="64" />
        <span class="nm">{{ it.name.zh }}</span>
        <span class="kind" :style="{ color: kindMeta[it.kind].color }">{{ kindMeta[it.kind].label }}</span>
        <span v-if="it.safety !== 'none'" class="badge tag-adult">{{ safetyLabel[it.safety] }}</span>
      </router-link>
    </div>
    <p class="caption">分類依臺北市環保局「資源回收分類方式」與「回收一點通」整理。</p>
  </main>
</template>

<style scoped>
.search { min-height: var(--tap); border-radius: 14px; border: 2px solid var(--gray-200); padding: 0 14px; font-size: var(--fs-h3); }
.tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.tabbtn { min-height: var(--tap); border: 0; border-radius: 12px; background: var(--white); font-weight: 700; box-shadow: var(--shadow); font-size: var(--fs-body); padding: 0 2px; }
.subs { list-style: none; margin: 0; padding: 10px 12px; background: var(--white); border-radius: 14px; display: grid; gap: 4px; font-size: var(--fs-body); }
.subs span { color: var(--gray-600); }
.item { min-height: 150px; text-align: center; gap: 4px; }
.nm { font-size: var(--fs-body); }
.kind { font-size: var(--fs-caption); font-weight: 800; }
</style>
