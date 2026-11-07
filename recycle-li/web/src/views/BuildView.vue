<script setup lang="ts">
// 蓋我的里：用星星蓋建築，里的綠意越來越高。升級會解鎖新建築和新的里（河濱里、老街里…）。
// 隨處蓋：點建築卡 → 地圖上出現可以蓋的位置 → 點哪裡就蓋在哪裡。點已經蓋好的建築可以搬家或拆掉（星星全部退回）。
// 星星不夠或等級不夠的卡是灰的。地圖可以放大（大的里比較好點）。
// 「工廠長建議」用 OR② 整數規劃（solvers/factory.ts）算出現有星星最好的蓋法，只是建議，不強迫。
// 星星價格與綠意值是遊戲設定，不代表真實的回收比例。
import { computed, ref } from 'vue'
import KidHud from '@/components/KidHud.vue'
import IsoLi from '@/components/IsoLi.vue'
import IsoThumb from '@/components/IsoThumb.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import Zy from '@/components/Zy.vue'
import { buildings, lis } from '@/domain/catalog'
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
    <KidHud title="蓋我的里" />

    <section class="stage" :aria-label="area.name">
      <!-- 里的切換：小圓片，沒解鎖的上鎖、寫要幾級 -->
      <nav class="lis" aria-label="選一個里">
        <button
          v-for="a in lis" :key="a.id" class="chip" :class="{ on: a.id === game.liId, locked: !game.liOpen(a.id) }"
          :aria-pressed="a.id === game.liId" :aria-disabled="!game.liOpen(a.id)" :aria-label="game.liOpen(a.id) ? a.name : `${a.name}，Lv.${a.unlock} 打開`" @click="switchLi(a.id)"
        >
          <AppIcon v-if="game.liOpen(a.id)" :name="a.icon" :size="20" />
          <AppIcon v-else name="Lock" :size="18" />
          <span v-if="a.id === game.liId"><Zy :text="a.name" /></span>
          <small v-else-if="!game.liOpen(a.id)">{{ a.unlock }}</small>
        </button>
      </nav>

      <div class="mapwrap" :class="{ zoom }">
        <IsoLi :li="area" :slots="game.slots" :pop="justSlot" :placing="!!placingId || moving" :selected="selected" @cell="onCell" />
      </div>

      <div class="tools">
        <span class="green" :aria-label="`綠意 ${game.green}`"><AppIcon name="Leaf" :size="18" /> {{ game.green }}</span>
        <button class="round" :aria-label="zoom ? '縮小地圖' : '放大地圖'" @click="zoom = !zoom">
          <AppIcon v-if="zoom" name="ZoomOut" :size="24" /><AppIcon v-else name="ZoomIn" :size="24" />
        </button>
        <button class="round" :class="{ on: showTip }" aria-label="工廠長建議" @click="showTip = !showTip"><AppIcon name="Bulb" :size="24" /></button>
      </div>

      <!-- 浮在地圖上的動作列 -->
      <div v-if="placingId || moving" class="float">
        <span class="hint"><AppIcon name="HandFinger" :size="22" /> <Zy :text="moving ? '點空地搬過去' : '點空地蓋下去'" /></span>
        <button class="round" aria-label="不蓋了" @click="cancel"><AppIcon name="X" :size="22" /></button>
      </div>
      <div v-else-if="selectedB" class="float">
        <button class="pill" @click="moving = true"><AppIcon name="ArrowsMove" :size="20" /> <Zy text="搬家" /></button>
        <button class="pill" @click="removeSel"><AppIcon name="Trash" :size="20" /> <Zy text="拆掉" /> <StarIcon :size="16" />+{{ cost(selectedB) }}</button>
        <button class="round" aria-label="取消" @click="cancel"><AppIcon name="X" :size="22" /></button>
      </div>
      <div v-else-if="showTip" class="float tip">
        <template v-if="advice.length">
          <AppIcon name="Bulb" :size="20" />
          <span v-for="a in advice" :key="a.b.id" class="mini"><IsoThumb :id="a.b.id" :size="34" :ground="false" />×{{ a.n }}</span>
        </template>
        <span v-else><Zy text="先去拿星星吧" /></span>
      </div>
    </section>

    <Mascot :mood="justBuilt ? 'cheer' : placingId || moving ? 'think' : 'happy'" :size="44" :line="line" />

    <!-- 建築托盤：橫的捲動，像遊戲的建造列 -->
    <div class="tray" role="list" aria-label="可以蓋的建築">
      <button
        v-for="b in sorted" :key="b.id" role="listitem" class="bcard" :class="{ off: !canBuild(b), locked: !unlocked(b), on: placingId === b.id }"
        :aria-disabled="!canBuild(b)" :aria-pressed="placingId === b.id" :aria-label="unlocked(b) ? `${b.name}，${cost(b)} 顆星` : `${b.name}，Lv.${b.unlock} 才能蓋`" @click="pick(b)"
      >
        <IsoThumb :id="b.id" :size="72" :ground="false" />
        <span class="nm"><Zy :text="b.name" /></span>
        <span v-if="unlocked(b)" class="cost" :class="{ short: game.stars < cost(b) }"><StarIcon :size="16" />{{ cost(b) }}</span>
        <span v-else class="lock"><AppIcon name="Lock" :size="14" />Lv.{{ b.unlock }}</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
.stage {
  position: relative; border-radius: 28px; padding: 50px 4px 8px; overflow: hidden;
  background: radial-gradient(120% 80% at 50% 0%, #F7FCFF 0%, #DDF1F8 55%, #CFEBD6 100%);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .7), var(--shadow);
}
.lis { position: absolute; top: 10px; left: 10px; right: 10px; z-index: 3; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chip {
  flex: none; min-height: 40px; min-width: 40px; border: 0; border-radius: 999px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;
  background: rgba(255, 255, 255, .92); color: var(--primary-700); font-weight: 800; box-shadow: var(--shadow);
}
.chip.on { background: #4E9A57; color: #fff; }
.chip.locked { color: var(--gray-500); background: rgba(255, 255, 255, .6); box-shadow: none; }
.chip small { font-weight: 800; }
.mapwrap { overflow: auto; -webkit-overflow-scrolling: touch; border-radius: 18px; }
.mapwrap.zoom { max-height: 60vh; }
.mapwrap.zoom :deep(.iso) { width: 200%; }
.tools { position: absolute; right: 10px; bottom: 10px; z-index: 3; display: flex; gap: 8px; align-items: center; }
.green { display: inline-flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, .92); color: #2F6B3A; border-radius: 999px; padding: 6px 12px; font-weight: 800; box-shadow: var(--shadow); }
.round { width: var(--tap); height: var(--tap); border: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, .95); color: var(--primary-700); box-shadow: var(--shadow); }
.round.on { background: #F5BA4B; color: #3B2A06; }
.float {
  position: absolute; left: 10px; right: 10px; bottom: 66px; z-index: 4; display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;
  background: rgba(255, 255, 255, .96); border-radius: 22px; padding: 8px; box-shadow: 0 8px 24px rgba(17, 38, 41, .18);
}
.hint { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; color: var(--primary-800); flex: 1; justify-content: center; }
.pill { min-height: var(--tap); border: 0; border-radius: 999px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 4px; background: var(--primary-50); font-weight: 800; color: var(--primary-800); }
.tip { justify-content: flex-start; color: #AD7B2B; }
.mini { display: inline-flex; align-items: center; font-weight: 800; color: var(--primary-800); }
.tray { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 10px; scroll-snap-type: x mandatory; scrollbar-width: none; }
.bcard {
  flex: none; width: 104px; scroll-snap-align: start; border: 0; border-radius: 22px; background: #fff; box-shadow: var(--shadow);
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px 10px; color: var(--primary-900);
}
.bcard.on { outline: 4px solid #F5BA4B; outline-offset: -2px; transform: translateY(-4px); }
.bcard.off { opacity: .55; }
.bcard.locked :deep(img), .bcard.locked :deep(svg) { filter: grayscale(1) opacity(.5); }
.nm { font-size: .85rem; font-weight: 800; text-align: center; line-height: 1.2; min-height: 2.4em; display: grid; place-items: center; }
.cost { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; color: #AD7B2B; }
.cost.short { color: var(--red-500); }
.lock { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; color: var(--gray-500); font-size: .85rem; }
</style>
