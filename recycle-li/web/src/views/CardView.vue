<script setup lang="ts">
// 分辨卡：這個東西長什麼樣、跟誰容易搞混、怎麼分、丟之前要做什麼。讀完第一次送 1 顆星。
// 內容全部來自規則表（solvers/distinguish.ts）。
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import StepStrip from '@/components/StepStrip.vue'
import Zy from '@/components/Zy.vue'
import { itemById, visibleItems } from '@/domain/catalog'
import { binOf, cluesOf, lookAlikes } from '@/solvers/distinguish'
import { speciesCap, useGame, type Reward } from '@/stores/game'

const route = useRoute()
const router = useRouter()
const game = useGame()
const item = computed(() => itemById(route.params.id as string))
if (!item.value || !game.isFound(item.value.id)) router.replace('/codex')

const bin = computed(() => (item.value ? binOf(item.value, game.age) : null))
const clues = computed(() => (item.value ? cluesOf(item.value) : []))
const alikes = computed(() => (item.value ? lookAlikes(item.value, visibleItems(), game.age) : []))
const fruit = computed(() => (item.value ? game.codex[item.value.id]?.fruit ?? 0 : 0))
const got = ref<Reward | null>(null)
const wasRead = ref(!!(item.value && game.codex[item.value.id]?.read))
function done() {
  if (!item.value) return
  got.value = game.readCard(item.value)
  wasRead.value = true
}
</script>

<template>
  <main v-if="item && bin" class="page stack">
    <TopBar title="分辨卡" back="/codex" />

    <section class="card head" :style="{ '--k': bin.color }">
      <ItemArt :item="item" :size="88" />
      <div class="stack tight">
        <h2><Zy :text="item.name.zh" /></h2>
        <span class="kind"><AppIcon :name="bin.icon" :size="20" /> <Zy :text="bin.label" /></span>
        <span class="meter" :aria-label="`星星 ${fruit}/${speciesCap(item)}`"><i v-for="n in speciesCap(item)" :key="n" :class="{ on: n <= fruit }"></i></span>
      </div>
    </section>

    <template v-if="clues.length">
      <h3 class="h3"><AppIcon name="Eye" :size="20" /> <Zy text="長什麼樣" /></h3>
      <ul class="chips">
        <li v-for="c in clues" :key="c.q.id" :class="{ no: !c.yes }"><AppIcon :name="c.icon" :size="22" /> <Zy :text="c.label" /></li>
      </ul>
    </template>

    <template v-if="alikes.length">
      <h3 class="h3"><AppIcon name="Puzzle" :size="20" /> <Zy text="不要搞混" /></h3>
      <div v-for="a in alikes" :key="a.other.id" class="card vs">
        <div class="side">
          <ItemArt :item="item" :size="56" />
          <span class="tag" :style="{ background: bin.color }"><AppIcon :name="bin.icon" :size="16" /> <Zy :text="bin.label" /></span>
          <small v-if="a.diff"><AppIcon :name="a.diff.mine.icon" :size="16" /> <Zy :text="a.diff.mine.label" /></small>
        </div>
        <span class="mid"><Zy v-if="a.diff" :text="a.diff.q.text" /><AppIcon v-else name="ArrowsLeftRight" :size="26" /></span>
        <div class="side">
          <ItemArt :item="a.other" :size="56" :dim="!game.isFound(a.other.id)" />
          <span class="tag" :style="{ background: a.otherBin.color }"><AppIcon :name="a.otherBin.icon" :size="16" /> <Zy :text="a.otherBin.label" /></span>
          <small v-if="a.diff"><AppIcon :name="a.diff.theirs.icon" :size="16" /> <Zy :text="a.diff.theirs.label" /></small>
          <small class="nm"><Zy :text="game.isFound(a.other.id) ? a.other.name.zh : '還沒找到'" /></small>
        </div>
      </div>
    </template>

    <template v-if="item.steps.length">
      <h3 class="h3"><AppIcon name="ListNumbers" :size="20" /> <Zy text="丟之前" /></h3>
      <StepStrip :steps="item.steps" :color="bin.color" />
    </template>

    <p v-if="got" class="reward pop"><StarIcon :size="28" /> +{{ got.stars }} <Zy text="讀完了！" /></p>
    <Mascot v-else-if="wasRead" :size="44" line="已經讀過了，去找新的東西吧" />
    <button v-else class="btn primary block" @click="done"><AppIcon name="BookUpload" /> <Zy text="看完了" /> <StarIcon :size="22" /> +1</button>
  </main>
</template>

<style scoped>
.head { display: flex; gap: 14px; align-items: center; border-top: 8px solid var(--k); }
.tight { gap: 6px; align-items: flex-start; }
h2 { margin: 0; font-size: var(--fs-h2); }
.kind { color: #fff; background: var(--k); border-radius: 8px; padding: 4px 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; }
.meter { display: flex; gap: 3px; }
.meter i { width: 10px; height: 10px; border-radius: 50%; background: var(--gray-200); }
.meter i.on { background: #F5BA4B; }
.h3 { margin: 6px 0 0; font-size: var(--fs-title); display: flex; align-items: center; gap: 6px; color: var(--primary-900); }
.chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.chips li { background: var(--white); border-radius: 999px; padding: 8px 14px; font-weight: 800; box-shadow: var(--shadow); display: flex; align-items: center; gap: 6px; }
.chips li.no { color: var(--gray-600); }
.vs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: center; }
.side { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.side small { display: inline-flex; align-items: center; gap: 2px; font-weight: 700; }
.tag { color: #fff; border-radius: 8px; padding: 2px 8px; font-weight: 800; font-size: var(--fs-body); display: inline-flex; align-items: center; gap: 2px; }
.mid { max-width: 6.5em; text-align: center; font-weight: 800; color: var(--primary-700); }
.nm { color: var(--gray-600); }
.reward { margin: 0; text-align: center; font-size: var(--fs-h2); font-weight: 800; color: var(--secondary-700); display: flex; justify-content: center; align-items: center; gap: 6px; }
</style>
