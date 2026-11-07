<script setup lang="ts">
// 掃描結果＝清楚的處理指引：它是哪一類（回收標誌的顏色）→ 臺北怎麼收 → 處理步驟 → 交給誰 → 拖進桶 → 獎勵資源。
// 一般品項：孩子親手把它拖進正確的桶，就拿到資源（拿去蓋自己的里）；不同天分對 3 次就學會了。
// Boss 怪（要大人幫忙）：孩子的任務是「認出來、會去找大人」，按「我會找大人」就拿星星（孩子介面，沒有家長功能）。
// 不要碰（針頭、藥品）：不出現遊戲畫面，直接顯示去處。官方說法衝突：告訴孩子「請大人問清潔隊」。
import Zy from '@/components/Zy.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goBackTo } from '@/nav'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import StepStrip from '@/components/StepStrip.vue'
import BinDrop from '@/components/BinDrop.vue'
import {
  binMetaFor, binsFor, collectionOf, correctBin, factFor, isBoss, isNoTouch, itemById, safetyLabel, type BinId,
} from '@/domain/catalog'
import { LEARN_THRESHOLD, useGame } from '@/stores/game'
import { FULL_GAME } from '@/focus'

const route = useRoute()
const router = useRouter()
const game = useGame()
const item = computed(() => itemById(route.params.id as string)!)
const bins = computed(() => binsFor(game.age))
const bin = computed(() => binMetaFor(item.value, game.age))
const coll = computed(() => collectionOf(item.value))
const fact = computed(() => factFor(item.value.category))

const phase = ref<'drop' | 'done' | 'bossDone'>('drop')
const wrongBin = ref<BinId | null>(null)
const retried = ref(false)
const result = ref<ReturnType<typeof game.catchItem> | null>(null)
const bossReward = ref<ReturnType<typeof game.bossConfirmed>>(null)
const progress = computed(() => Math.min(LEARN_THRESHOLD, game.codex[item.value.id]?.correct ?? 0))
// 看到掃描結果＝在圖鑑裡「找到了」這種東西
if (item.value) game.discover(item.value)
const unread = computed(() => !game.codex[item.value.id]?.read)

const flow = computed(() => {
  const it = item.value
  if (it.status === 'conflict' || it.category === 'unknown') return 'ask'
  if (isNoTouch(it)) return 'notouch'
  if (isBoss(it) || correctBin(it, game.age) === null) return 'boss'
  return 'normal'
})
const title = computed(() =>
  flow.value === 'ask' ? '問問清潔隊' : flow.value === 'notouch' ? '不要碰！' : flow.value === 'boss' ? '要大人幫忙' : phase.value === 'done' ? '做對了！' : '送它回家！',
)
const binLabel = computed(() => bins.value.find((b) => b.id === correctBin(item.value, game.age))?.label ?? bin.value.label)

function drop(b: BinId) {
  if (correctBin(item.value, game.age) !== b) {
    wrongBin.value = b
    retried.value = true
    game.markWrong(item.value)
    window.setTimeout(() => (wrongBin.value = null), 800)
    return
  }
  result.value = game.catchItem(item.value, retried.value)
  phase.value = 'done'
}
function bossPass() {
  bossReward.value = game.bossConfirmed(item.value)
  phase.value = 'bossDone'
}
</script>

<template>
  <main class="page stack" v-if="item">
    <TopBar :title="title" back="/" />

    <!-- 指引卡：每一種流程都先清楚說明 -->
    <section class="guide card" :class="{ 'danger-frame': item.safety !== 'none' }" :style="{ '--k': bin.color }" aria-label="處理指引">
      <div class="head">
        <ItemArt :item="item" :size="72" class="pop" />
        <div class="stack tight">
          <h2><Zy :text="item.name.zh" /></h2>
          <span class="kind" :style="{ background: bin.color }"><AppIcon :name="bin.icon" :size="20" /> <Zy :text="bin.label" /></span>
          <span v-if="item.safety !== 'none'" class="badge tag-adult"><AppIcon name="AlertTriangle" :size="14" /> <Zy :text="safetyLabel[item.safety]" /></span>
        </div>
      </div>
      <template v-if="flow !== 'notouch' && item.steps.length">
        <StepStrip :steps="item.steps" :color="bin.color" />
      </template>
      <p v-if="item.notes" class="note"><AppIcon name="Bulb" :size="18" /> <Zy :text="item.notes" /></p>
      <!-- 臺北的子類和回收日：大人才需要，收起來 -->
      <details v-if="coll.when" class="more">
        <summary><AppIcon name="Calendar" :size="18" /> <Zy text="什麼時候收" /></summary>
        <p><Zy :text="coll.when" /></p>
      </details>
    </section>

    <!-- 請洽清潔隊 -->
    <template v-if="flow === 'ask'">
      <Mascot mood="think" :size="52" line="這個連大人也不確定，請大人問清潔隊" />
      <router-link to="/scan" replace class="btn primary block"><AppIcon name="Camera" /> <Zy text="掃別的東西" /></router-link>
    </template>

    <!-- 不要碰 -->
    <template v-else-if="flow === 'notouch'">
      <div class="stop center"><AppIcon name="HandStop" :size="64" /><p><Zy text="不要碰，請大人處理" /></p></div>
      <router-link to="/" class="btn block" @click.prevent="goBackTo(router, '/')"><AppIcon name="Home" /> <Zy text="回首頁" /></router-link>
    </template>

    <!-- Boss 怪 -->
    <template v-else-if="flow === 'boss'">
      <template v-if="phase === 'drop'">
        <Mascot :size="52" line="你認出來了！這個要找大人一起處理" />
        <button class="btn secondary block" @click="bossPass"><AppIcon name="UserShield" /> <Zy text="我會找大人" /></button>
      </template>
      <template v-else>
        <Mascot mood="cheer" :size="56" line="你是安全小專家！" />
        <p v-if="bossReward" class="reward pop"><StarIcon :size="30" /> +{{ bossReward.stars }}</p>
        <div class="grid2">
          <router-link to="/scan" replace class="btn" :class="{ primary: !FULL_GAME }"><AppIcon name="Camera" /> <Zy text="再掃一個" /></router-link>
          <router-link v-if="FULL_GAME" to="/quiz" class="btn primary"><AppIcon name="Map" /> <Zy text="考考你" /></router-link>
          <router-link v-else to="/codex" class="btn"><AppIcon name="Book" /> <Zy text="圖鑑" /></router-link>
        </div>
      </template>
    </template>

    <!-- 一般：拖進桶 -->
    <template v-else>
      <template v-if="phase === 'drop'">
        <Mascot :mood="wrongBin ? 'oops' : 'happy'" :size="48" :line="wrongBin ? '我不住這裡喔，再看一次上面' : `把我拖進「${binLabel}」`" />
        <BinDrop :item="item" :bins="bins" :shake-bin="wrongBin" @drop="drop" />
      </template>
      <template v-else>
        <div class="card center stack success pop">
          <p class="ok"><AppIcon name="CircleCheck" :size="28" /> <Zy :text="`放進「${binLabel}」`" /></p>
          <p v-if="fact" class="fact"><Zy :text="`它會${fact.text.replace(/^會/, '')}`" /></p>
          <!-- 獎勵：星星 -->
          <p v-if="result?.reward" class="reward pop">
            <StarIcon :size="30" /> +{{ result.reward.stars }}
          </p>
          <p v-else-if="result && 'capped' in result" class="muted"><Zy text="這種東西的星星拿完了，去找新的東西吧！" /></p>
          <p v-else-if="result && 'todayDone' in result" class="muted"><Zy text="今天已經拿過它的獎勵了，掃別的東西吧" /></p>
          <p v-else-if="result && 'limit' in result" class="muted"><Zy text="今天的獎勵拿完了，明天再來" /></p>
          <p v-if="result?.justLearned" class="badge tag-draft big"><AppIcon name="Award" :size="18" /> <Zy text="學會了！" /></p>
          <div v-else-if="!result?.already" class="learn" :aria-label="`學會進度 ${progress}/${LEARN_THRESHOLD}`">
            <div><span v-for="n in LEARN_THRESHOLD" :key="n" :class="{ on: n <= progress }"><AppIcon name="Star" :size="26" /></span></div>
            <small><Zy :text="`不同天再分對 ${LEARN_THRESHOLD - progress} 次就學會`" /></small>
          </div>
        </div>
        <Mascot mood="cheer" :size="52" line="做得好！" />
        <router-link :to="`/codex/${item.id}`" class="btn block card-btn"><AppIcon name="Book" /> <Zy text="看分辨卡" /><span v-if="unread" class="plus"><StarIcon :size="18" />+1</span></router-link>
        <div class="grid2">
          <router-link to="/scan" replace class="btn" :class="{ primary: !FULL_GAME }"><AppIcon name="Camera" /> <Zy text="再掃一個" /></router-link>
          <router-link v-if="FULL_GAME" to="/quiz" class="btn primary"><AppIcon name="Map" /> <Zy text="考考你" /></router-link>
          <router-link v-else to="/codex" class="btn"><AppIcon name="Book" /> <Zy text="圖鑑" /></router-link>
        </div>
      </template>
    </template>
  </main>
</template>

<style scoped>
.guide { border-top: 8px solid var(--k); display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.head { display: flex; gap: 14px; align-items: center; }
.tight { gap: 6px; align-items: flex-start; }
h2 { margin: 0; font-size: var(--fs-h2); }
.kind { color: #fff; border-radius: 8px; padding: 4px 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; box-shadow: inset 0 0 0 2px rgba(255,255,255,.6); }
.more { color: var(--gray-600); }
.more summary { min-height: 48px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.more p { margin: 0 0 4px; font-weight: 700; color: var(--gray-800); }
.note { margin: 0; background: var(--secondary-50); border-radius: 12px; padding: 10px 12px; font-weight: 600; display: flex; gap: 6px; }
.stop { color: var(--orange-600); font-size: var(--fs-h2); font-weight: 800; }
.stop p { margin: 4px 0 0; }
.success { background: linear-gradient(170deg, #FFF8E2, var(--white)); }
.ok { margin: 0; font-size: var(--fs-h2); font-weight: 800; color: #2F7A3A; display: flex; align-items: center; justify-content: center; gap: 6px; }
.reward { margin: 0; font-size: var(--fs-h2); font-weight: 800; color: var(--secondary-700); display: flex; align-items: center; justify-content: center; gap: 6px; }
.fact { font-size: var(--fs-title); font-weight: 700; margin: 0; color: var(--primary-700); }
.big { font-size: var(--fs-h3); padding: 6px 12px; }
.plus { display: inline-flex; align-items: center; gap: 2px; color: #AD7B2B; font-weight: 800; margin-left: 4px; }
.learn { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.learn span { color: var(--gray-200); display: inline-block; }
.learn span.on { color: var(--secondary-500); }
.learn small { color: var(--gray-600); }
</style>
