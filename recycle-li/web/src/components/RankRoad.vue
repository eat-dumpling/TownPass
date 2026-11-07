<script setup lang="ts">
// 等級之路：10 個等級排成一條路，每一級寫出會打開什麼（新建築、新的里、九個分類桶），
// 孩子一眼就知道「再拿幾顆星會得到什麼」。現在的等級會亮、自動捲到看得到。
import { computed, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import IsoThumb from './IsoThumb.vue'
import Zy from './Zy.vue'
import { buildings, lis, ranks } from '@/domain/catalog'
import { NINE_BINS_LEVEL, useGame } from '@/stores/game'

const game = useGame()
const road = computed(() =>
  ranks.map((r) => ({
    ...r,
    builds: buildings.filter((b) => b.unlock === r.lv),
    li: lis.find((l) => l.unlock === r.lv && l.unlock > 1),
    bins: r.lv === NINE_BINS_LEVEL,
    state: r.lv < game.level ? 'past' : r.lv === game.level ? 'now' : 'next',
  })),
)
const left = computed(() => (game.rank.next ? game.rank.span - game.rank.into : 0))
const box = ref<HTMLElement | null>(null)
onMounted(() => box.value?.querySelector('.now')?.scrollIntoView({ inline: 'center', block: 'nearest' }))
</script>

<template>
  <section class="road-card card">
    <p v-if="game.rank.next" class="left"><AppIcon name="Star" :size="20" class="st" /> <Zy :text="`再 ${left} 顆星升級`" /></p>
    <ol ref="box" class="road" aria-label="等級之路">
      <li v-for="r in road" :key="r.lv" :class="r.state" :aria-current="r.state === 'now' ? 'step' : undefined">
        <span class="badge"><AppIcon :name="r.icon" :size="24" :stroke="2" /><b>{{ r.lv }}</b></span>
        <span class="nm"><Zy :text="r.title" /></span>
        <span class="gets">
          <IsoThumb v-for="b in r.builds" :key="b.id" :id="b.id" :size="30" :ground="false" />
          <span v-if="r.li" class="tag"><AppIcon :name="r.li.icon" :size="16" /><Zy :text="r.li.name" /></span>
          <span v-if="r.bins" class="tag"><AppIcon name="Recycle" :size="16" /><Zy text="九個桶" /></span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.road-card { padding: 12px 8px 8px; }
.left { margin: 0 6px 8px; display: flex; align-items: center; gap: 6px; font-weight: 800; color: #AD7B2B; }
.st { color: #E7A43C; fill: #FCD56B; }
.road { list-style: none; margin: 0; padding: 4px 4px 8px; display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; position: relative; }
.road li { flex: none; width: 96px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; position: relative; }
.road li + li::before { content: ''; position: absolute; top: 26px; left: -10px; width: 10px; height: 4px; background: var(--gray-200); border-radius: 2px; }
.road li.past + li::before, .road li.now::before { background: #F5BA4B; }
.badge { position: relative; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--gray-100); color: var(--gray-500); }
.badge b { position: absolute; right: -4px; bottom: -4px; min-width: 22px; height: 22px; border-radius: 999px; background: var(--gray-300); color: #fff; font-size: .8rem; display: grid; place-items: center; border: 2px solid #fff; }
.past .badge { background: #FCE7B2; color: #AD7B2B; }
.past .badge b { background: #E7A43C; }
.now .badge { background: linear-gradient(160deg, #FFE7A8, #F5BA4B); color: #7A4E0E; box-shadow: 0 0 0 4px rgba(245, 186, 75, .35); }
.now .badge b { background: var(--primary-700); }
.nm { font-size: .8rem; font-weight: 800; color: var(--primary-900); line-height: 1.2; }
.next .nm { color: var(--gray-500); }
.gets { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px; }
.next .gets { filter: grayscale(.6); opacity: .8; }
.tag { display: inline-flex; align-items: center; gap: 2px; background: var(--primary-50); color: var(--primary-800); border-radius: 999px; padding: 1px 6px; font-size: .75rem; font-weight: 800; }
</style>
