<script setup lang="ts">
// 把垃圾怪拖進桶（Pointer Events，不用拖拉套件）。桶子本身也是按鈕：點一下也能選（無障礙替代操作）。
import Zy from '@/components/Zy.vue'
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'
import ItemArt from './ItemArt.vue'
import type { BinMeta, BinId } from '@/domain/catalog'
import type { Item } from '@/domain/types'

const props = defineProps<{ item: Item; bins: BinMeta[]; shakeBin?: BinId | null }>()
const emit = defineEmits<{ drop: [bin: BinId] }>()

const dx = ref(0)
const dy = ref(0)
const dragging = ref(false)
const over = ref<BinId | null>(null)
const binsEl = ref<HTMLElement>()
let sx = 0
let sy = 0

// 用桶子的矩形判斷落點（elementFromPoint 會打到正在拖的怪物本身）
function binAt(x: number, y: number): BinId | null {
  const els = binsEl.value?.querySelectorAll<HTMLElement>('[data-bin]') ?? []
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right && y >= r.top - 24 && y <= r.bottom) return el.dataset.bin as BinId
  }
  return null
}
function down(e: PointerEvent) {
  e.preventDefault()
  dragging.value = true
  sx = e.clientX
  sy = e.clientY
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
function move(e: PointerEvent) {
  if (!dragging.value) return
  dx.value = e.clientX - sx
  dy.value = e.clientY - sy
  over.value = binAt(e.clientX, e.clientY)
}
function up(e: PointerEvent) {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  window.removeEventListener('pointercancel', up)
  if (!dragging.value) return
  dragging.value = false
  const b = binAt(e.clientX, e.clientY)
  dx.value = 0
  dy.value = 0
  over.value = null
  if (b) emit('drop', b)
}
</script>

<template>
  <div class="area">
    <div
      class="monster"
      :class="{ dragging }"
      :style="{ transform: `translate(${dx}px, ${dy}px) scale(${dragging ? 1.1 : 1})` }"
      role="img"
      :aria-label="props.item.name.zh"
      @pointerdown="down"
    >
      <ItemArt class="bob" :item="props.item" :size="84" />
    </div>
    <div ref="binsEl" class="bins" :class="{ many: bins.length > 3 }">
      <button
        v-for="b in bins"
        :key="b.id"
        class="bin"
        :class="{ over: over === b.id, shake: shakeBin === b.id }"
        :data-bin="b.id"
        :style="{ background: b.color }"
        :aria-label="`放進${b.label}`"
        @click="emit('drop', b.id)"
      >
        <span class="lid"><AppIcon :name="b.icon" :size="bins.length > 3 ? 24 : 34" :color="b.color" /></span>
        <span class="name"><Zy :text="b.label" /></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.area { display: flex; flex-direction: column; align-items: center; gap: 14px; touch-action: none; user-select: none; }
.monster { cursor: grab; touch-action: none; transition: transform .15s; z-index: 5; padding: 8px; }
.monster.dragging { transition: none; cursor: grabbing; filter: drop-shadow(0 10px 12px rgba(0,0,0,.2)); }
.bins { display: grid; gap: 8px; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
/* 參考回收標誌：彩色底、白色框線、上方白色標題區放圖示 */
.bin { border: 0; border-radius: 8px; min-height: 104px; padding: 8px; display: flex; flex-direction: column; align-items: stretch; gap: 8px; position: relative; transition: transform .15s; box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 5px rgba(0,0,0,.08), var(--shadow); color: #fff; }
.bins.many .bin { min-height: 70px; padding: 6px; gap: 4px; }
.bin.over { transform: scale(1.08); }
.lid { background: #fff; border-radius: 4px; display: grid; place-items: center; padding: 8px 0; }
.bins.many .lid { padding: 4px 0; }
.name { font-weight: 800; font-size: var(--fs-h3); text-align: center; line-height: 1.2; }
.bins.many .name { font-size: var(--fs-body); }
</style>
