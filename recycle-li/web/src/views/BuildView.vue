<script setup lang="ts">
// 蓋我的里：用星星蓋建築，里的綠意越來越高。升級會解鎖新建築和新的里（河濱里、老街里…）。
// 隨處蓋：點建築卡 → 地圖上出現可以蓋的位置 → 點哪裡就蓋在哪裡。點已經蓋好的建築可以搬家或拆掉（星星全部退回）。
// 星星不夠或等級不夠的卡是灰的。地圖可以放大（大的里比較好點）。
// 「工廠長建議」用 OR② 整數規劃（solvers/factory.ts）算出現有星星最好的蓋法，只是建議，不強迫。
// 星星價格與綠意值是遊戲設定，不代表真實的回收比例。
import { computed, ref } from 'vue'
import TopBar from '@/components/TopBar.vue'
import IsoLi from '@/components/IsoLi.vue'
import IsoThumb from '@/components/IsoThumb.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import RankBar from '@/components/RankBar.vue'
import Zy from '@/components/Zy.vue'
import { buildings, lis, ranks } from '@/domain/catalog'
import type { Building } from '@/domain/types'
import { useGame } from '@/stores/game'
import { solve } from '@/solvers/factory'

const game = useGame()
const area = computed(() => game.li)
const openSlots = computed(() => game.slots.map((s, i) => (!s && game.buildable(game.liId, i) ? i : -1)).filter((i) => i >= 0))
const justBuilt = ref<string | null>(null)
const justSlot = ref<number | null>(null)
const showTip = ref(false)
const placingId = ref<string | null>(null) // 選了要蓋的建築，等孩子點地圖
const selected = ref<number | null>(null) // 點了已經蓋好的建築
const moving = ref(false)
const zoom = ref(false)
const placingB = computed(() => buildings.find((b) => b.id === placingId.value) ?? null)
const selectedB = computed(() => (selected.value === null ? null : buildings.find((b) => b.id === game.slots[selected.value!]) ?? null))
const unlocked = (b: Building) => b.unlock <= game.level
const cost = (b: Building) => b.cost.star ?? 0
const canBuild = (b: Building) => openSlots.value.length > 0 && unlocked(b) && game.stars >= cost(b)
const sorted = computed(() => [...buildings].sort((a, b) => a.unlock - b.unlock || cost(a) - cost(b)))
const rankTitle = (lv: number) => ranks.find((r) => r.lv === lv)?.title ?? ''

// 工廠長建議：用手上的星星與這個里的空地，綠意最高的組合（多蓋不同種類加分）
const advice = computed(() => {
  const r = solve({ buildings: buildings.filter(unlocked), resources: { star: game.stars }, slots: openSlots.value.length, diversityBonus: 2 })
  return Object.entries(r.counts).filter(([, n]) => n > 0).map(([id, n]) => ({ b: buildings.find((x) => x.id === id)!, n }))
})

function pick(b: Building) {
  if (!canBuild(b)) return
  placingId.value = placingId.value === b.id ? null : b.id
  selected.value = null
  moving.value = false
}
function onCell(i: number) {
  const free = !game.slots[i] && game.buildable(game.liId, i)
  if (placingId.value) {
    if (!free) return
    const b = placingB.value!
    if (game.build(b.id, i)) {
      justBuilt.value = b.id
      justSlot.value = i
      game.say(b.icon, `蓋好了：${b.name}`)
    }
    placingId.value = null
    return
  }
  if (moving.value && selected.value !== null) {
    if (free && game.move(selected.value, i)) { justSlot.value = i; justBuilt.value = null }
    moving.value = false
    selected.value = null
    return
  }
  selected.value = game.slots[i] ? (selected.value === i ? null : i) : null
}
function removeSel() {
  if (selected.value === null) return
  game.remove(selected.value)
  selected.value = null
  justBuilt.value = null
}
function cancel() { placingId.value = null; selected.value = null; moving.value = false }
function switchLi(id: string) {
  if (!game.liOpen(id)) return
  game.liId = id
  justBuilt.value = null
  justSlot.value = null
  cancel()
}
const line = computed(() => {
  if (placingB.value) return `點地圖上的空地，把${placingB.value.name}蓋在那裡`
  if (moving.value) return '要搬到哪裡？點一塊空地'
  if (selectedB.value) return `${selectedB.value.name}：要搬家還是拆掉？`
  if (!openSlots.value.length) return '這個里蓋滿了！升級可以打開新的里'
  if (justBuilt.value) return buildings.find((b) => b.id === justBuilt.value)?.fact ?? '蓋好了！'
  if (!buildings.some(canBuild)) return '星星不夠，去掃垃圾、考考你拿星星吧'
  return '蓋什麼好？'
})
</script>

<template>
  <main class="page stack">
    <TopBar title="蓋我的里" back="/" />
    <RankBar compact />

    <!-- 里的切換：沒解鎖的顯示要幾級 -->
    <nav class="lis" aria-label="我的里">
      <button
        v-for="a in lis" :key="a.id" class="li-tab" :class="{ on: a.id === game.liId, locked: !game.liOpen(a.id) }"
        :aria-pressed="a.id === game.liId" :aria-disabled="!game.liOpen(a.id)" @click="switchLi(a.id)"
      >
        <AppIcon v-if="game.liOpen(a.id)" :name="a.icon" :size="22" />
        <AppIcon v-else name="Lock" :size="20" />
        <span><Zy :text="a.id === 'sprout' && game.settings.li ? game.settings.li.name : a.name" /></span>
        <small v-if="!game.liOpen(a.id)">Lv.{{ a.unlock }}</small>
      </button>
    </nav>

    <section class="li card" :aria-label="area.name">
      <div class="mapwrap" :class="{ zoom }">
        <IsoLi :li="area" :slots="game.slots" :pop="justSlot" :placing="!!placingId || moving" :selected="selected" @cell="onCell" />
      </div>
      <button class="btn ghost zoom-btn" :aria-label="zoom ? '縮小地圖' : '放大地圖'" @click="zoom = !zoom">
        <AppIcon v-if="zoom" name="ZoomOut" :size="24" /><AppIcon v-else name="ZoomIn" :size="24" />
      </button>
      <p class="green"><AppIcon name="Leaf" :size="18" /> <Zy text="綠意" /> {{ game.green }} ・ <Zy text="空地" /> {{ openSlots.length }}</p>
    </section>

    <Mascot :mood="justBuilt ? 'cheer' : placingId || moving ? 'think' : 'happy'" :size="48" :line="line" />

    <!-- 放置中、選了建築：動作列 -->
    <div v-if="placingId || moving" class="actions card"><button class="btn block" @click="cancel"><AppIcon name="X" /> <Zy text="不蓋了" /></button></div>
    <div v-else-if="selectedB" class="actions card grid3">
      <button class="btn" @click="moving = true"><AppIcon name="ArrowsMove" /> <Zy text="搬家" /></button>
      <button class="btn" @click="removeSel"><AppIcon name="Trash" /> <Zy text="拆掉" /> <span class="refund"><StarIcon :size="16" />+{{ cost(selectedB) }}</span></button>
      <button class="btn ghost" @click="cancel"><AppIcon name="X" /> <Zy text="取消" /></button>
    </div>

    <div class="grid2">
      <button v-for="b in sorted" :key="b.id" class="tile bcard" :class="{ off: !canBuild(b), locked: !unlocked(b), on: placingId === b.id }" :aria-disabled="!canBuild(b)" :aria-pressed="placingId === b.id" @click="pick(b)">
        <IsoThumb :id="b.id" :size="84" />
        <strong><Zy :text="b.name" /></strong>
        <span v-if="unlocked(b)" class="cost" :class="{ short: game.stars < cost(b) }"><StarIcon :size="18" /> {{ cost(b) }}</span>
        <span v-else class="lock"><AppIcon name="Lock" :size="16" /> Lv.{{ b.unlock }} <Zy :text="rankTitle(b.unlock)" /></span>
        <span class="g"><AppIcon name="Leaf" :size="14" /> +{{ b.green }}</span>
      </button>
    </div>

    <button class="btn" @click="showTip = !showTip"><AppIcon name="Bulb" /> <Zy text="工廠長建議" /></button>
    <div v-if="showTip" class="card tip">
      <template v-if="advice.length">
        <span><Zy text="用現在的星星，這樣蓋綠意最高：" /></span>
        <span v-for="a in advice" :key="a.b.id" class="chip"><AppIcon :name="a.b.icon" :size="18" /> <Zy :text="a.b.name" /> ×{{ a.n }}</span>
      </template>
      <span v-else><Zy text="先去拿星星吧" /></span>
    </div>
    <div class="grid2">
      <router-link to="/scan" class="btn primary"><AppIcon name="Camera" /> <Zy text="掃一掃" /></router-link>
      <router-link to="/quiz" class="btn"><AppIcon name="Map" /> <Zy text="考考你" /></router-link>
    </div>
    <p class="caption center">星星價格與綠意值是遊戲設定</p>
  </main>
</template>

<style scoped>
.lis { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: none; }
.li-tab {
  flex: none; min-height: var(--tap); border: 0; border-radius: 14px; padding: 6px 12px; background: var(--white); box-shadow: var(--shadow);
  display: flex; align-items: center; gap: 6px; font-weight: 800; color: var(--primary-800);
}
.li-tab.on { background: var(--primary-500); color: #fff; }
.li-tab.locked { background: var(--gray-50); color: var(--gray-500); box-shadow: none; }
.li-tab small { font-weight: 700; }
.mapwrap { overflow: auto; -webkit-overflow-scrolling: touch; border-radius: 14px; }
.mapwrap.zoom { max-height: 62vh; }
.mapwrap.zoom :deep(.iso) { width: 200%; }
.zoom-btn { position: absolute; top: 8px; right: 8px; width: var(--tap); padding: 0; background: rgba(255,255,255,.85); }
.actions { padding: 10px; gap: 8px; }
.refund { display: inline-flex; align-items: center; color: #AD7B2B; font-weight: 800; }
.bcard.on { outline: 4px solid var(--secondary-500); outline-offset: -2px; }
.li { position: relative; padding: 10px 6px 12px; background: radial-gradient(120% 90% at 50% 20%, #F4FBFD 0%, #E2F2F6 55%, #D3EBDA 100%); overflow: hidden; }
.green { margin: 6px 0 0 8px; font-weight: 700; color: #2F6B3A; display: flex; align-items: center; gap: 4px; }
.bcard { gap: 4px; min-height: 170px; color: var(--primary-900); }
.bcard.off { opacity: .55; }
.bcard.locked :deep(svg) { filter: grayscale(1); }
.cost { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; font-size: var(--fs-title); color: #AD7B2B; }
.cost.short { color: var(--red-500); }
.lock { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-body); font-weight: 700; color: var(--gray-600); }
.g { color: #2F6B3A; font-size: var(--fs-caption); font-weight: 700; display: inline-flex; align-items: center; gap: 2px; }
.tip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.chip { background: var(--primary-50); border-radius: 999px; padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
</style>
