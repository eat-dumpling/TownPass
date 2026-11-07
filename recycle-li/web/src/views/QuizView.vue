<script setup lang="ts">
// 考考你一關：5 題，題目由規則表產生（solvers/quiz.ts）。
// 答對：1 顆星＋算一次練習；答錯：告訴孩子正確答案（再學一次）。全部答完看星星與獎勵。
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import StarIcon from '@/components/StarIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import Zy from '@/components/Zy.vue'
import { itemById, visibleItems } from '@/domain/catalog'
import { LEVELS, explain, makeRound, starsFor, type QuizOption, type QuizQuestion } from '@/solvers/quiz'
import { useGame, type Reward } from '@/stores/game'

const route = useRoute()
const router = useRouter()
const game = useGame()
const level = computed(() => LEVELS.find((l) => l.id === Number(route.params.id)) ?? LEVELS[0])
if (!game.levelOpen(level.value.id)) router.replace('/quiz')

const qs = ref<QuizQuestion[]>([])
const idx = ref(0)
const picked = ref<string | null>(null)
const marks = ref<boolean[]>([])
const earned = ref(0)
const learned = ref<string[]>([])
const result = ref<ReturnType<typeof game.levelFinished> | null>(null)
function start() {
  qs.value = makeRound(level.value, visibleItems(), game.codex, game.age)
  idx.value = 0; picked.value = null; marks.value = []; earned.value = 0; learned.value = []; result.value = null
}
start()
watch(() => route.params.id, () => { if (route.name === 'quiz-level') start() })

const q = computed(() => qs.value[idx.value])
const item = computed(() => (q.value ? itemById(q.value.itemId)! : null))
const prompt = computed(() => {
  if (!q.value) return ''
  if (q.value.kind === 'bin') return '我要去哪個桶？'
  if (q.value.kind === 'prep') return '丟之前要先做什麼？'
  if (q.value.kind === 'pick') return `哪一個要丟進「${q.value.bin!.label}」？`
  return '哪一個要找大人幫忙？'
})
const ok = computed(() => picked.value !== null && picked.value === q.value?.answer)
const lastReward = ref<Reward | null>(null)

function choose(o: QuizOption) {
  if (picked.value || !q.value) return
  picked.value = o.key
  const right = o.key === q.value.answer
  marks.value.push(right)
  const r = game.quizAnswer(q.value.itemId, right)
  lastReward.value = r.reward
  if (r.reward) earned.value += r.reward.stars
  if (r.justLearned && item.value) learned.value.push(item.value.name.zh)
}
function next() {
  if (idx.value < qs.value.length - 1) { idx.value++; picked.value = null; lastReward.value = null; return }
  const score = marks.value.filter(Boolean).length
  result.value = game.levelFinished(level.value.id, score, qs.value.length)
  if (result.value.bonus) earned.value += result.value.bonus.stars
}
const score = computed(() => marks.value.filter(Boolean).length)
const nextLevel = computed(() => LEVELS.find((l) => l.id === level.value.id + 1))
const endLine = computed(() => {
  const s = result.value?.stars ?? 0
  if (!s) return '再試一次就會過關！'
  if (s === 3) return '全部答對，太厲害了！'
  return '過關了！'
})
</script>

<template>
  <main class="page stack">
    <TopBar :title="level.title" back="/quiz" />

    <!-- 進度：一題一顆點 -->
    <ol class="dots" :aria-label="`第 ${Math.min(idx + 1, qs.length)} 題，共 ${qs.length} 題`">
      <li v-for="(_, k) in qs" :key="k" :class="{ ok: marks[k] === true, no: marks[k] === false, cur: k === idx && !result }"></li>
    </ol>

    <template v-if="!result && q && item">
      <section class="card qcard center">
        <template v-if="q.kind === 'bin' || q.kind === 'prep'">
          <ItemArt :item="item" :size="104" class="pop" />
          <h2><Zy :text="item.name.zh" /></h2>
        </template>
        <span v-else-if="q.kind === 'pick'" class="binchip" :style="{ background: q.bin!.color }">
          <AppIcon :name="q.bin!.icon" :size="40" /> <Zy :text="q.bin!.label" />
        </span>
        <span v-else class="binchip adult"><AppIcon name="UserShield" :size="40" /> <Zy text="找大人" /></span>
      </section>

      <Mascot :mood="picked ? (ok ? 'cheer' : 'oops') : 'think'" :size="48" :line="picked ? (ok ? '答對了！' : explain(q, item, game.age)) : prompt" />

      <div class="grid3 opts">
        <button
          v-for="o in q.options" :key="o.key" class="tile opt"
          :class="{ right: picked && o.key === q.answer, wrong: picked === o.key && !ok, colored: !!o.color, dim: picked && o.key !== q.answer && picked !== o.key }"
          :style="o.color ? { '--c': o.color } : {}" :aria-disabled="!!picked" @click="choose(o)"
        >
          <ItemArt v-if="o.itemId" :item="itemById(o.itemId)!" :size="56" />
          <AppIcon v-else :name="o.icon" :size="44" :stroke="1.7" />
          <span><Zy :text="o.label" /></span>
          <AppIcon v-if="picked && o.key === q.answer" name="CircleCheck" :size="26" class="badge-ok" label="正確答案" />
        </button>
      </div>

      <template v-if="picked">
        <p v-if="lastReward" class="reward pop"><StarIcon :size="28" /> +{{ lastReward.stars }}</p>
        <button class="btn primary block" @click="next">
          <template v-if="idx < qs.length - 1"><AppIcon name="ArrowRight" /> <Zy text="下一題" /></template>
          <template v-else><AppIcon name="Flag" /> <Zy text="看結果" /></template>
        </button>
      </template>
    </template>

    <!-- 結果 -->
    <template v-else-if="result">
      <section class="card center stack done pop">
        <div class="bigstars" :aria-label="`${result.stars} 顆星`">
          <AppIcon v-for="k in 3" :key="k" name="Star" :size="56" :class="{ on: k <= result.stars }" />
        </div>
        <p class="sc">{{ score }} / {{ qs.length }}</p>
        <p class="got" :aria-label="`拿到 ${earned} 顆星`"><StarIcon :size="30" /> +{{ earned }}</p>
        <p v-if="learned.length" class="badge tag-draft"><AppIcon name="Award" :size="18" /> <Zy :text="`學會了：${learned.join('、')}`" /></p>
      </section>
      <Mascot :mood="result.stars ? 'cheer' : 'oops'" :size="52" :line="endLine" />
      <div class="grid2">
        <button class="btn" @click="start"><AppIcon name="Refresh" /> <Zy text="再玩一次" /></button>
        <router-link v-if="result.stars && nextLevel" :to="`/quiz/${nextLevel.id}`" class="btn primary"><AppIcon name="PlayerPlay" /> <Zy text="下一關" /></router-link>
        <router-link v-else to="/build" class="btn primary"><AppIcon name="Building" /> <Zy text="去蓋房子" /></router-link>
      </div>
      <router-link to="/quiz" class="btn ghost block"><AppIcon name="Map" /> <Zy text="回地圖" /></router-link>
    </template>
  </main>
</template>

<style scoped>
.dots { list-style: none; display: flex; justify-content: center; gap: 10px; margin: 0; padding: 0; }
.dots li { width: 18px; height: 18px; border-radius: 50%; background: var(--gray-100); border: 3px solid transparent; }
.dots li.cur { border-color: var(--primary-500); background: var(--white); }
.dots li.ok { background: #2F7A3A; }
.dots li.no { background: var(--red-500); }
.qcard { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
h2 { margin: 0; font-size: var(--fs-h2); }
.binchip { color: #fff; border-radius: 18px; padding: 14px 22px; font-size: var(--fs-h2); font-weight: 800; display: inline-flex; align-items: center; gap: 8px; }
.binchip.adult { background: var(--orange-600); }
.opts { gap: 10px; }
.opt { position: relative; gap: 6px; min-height: 128px; font-weight: 800; color: var(--primary-900); border: 3px solid transparent; }
.opt.colored { background: var(--c); color: #fff; }
.opt.right { border-color: #2F7A3A; box-shadow: 0 0 0 4px rgba(47, 122, 58, .25); }
.opt.wrong { border-color: var(--red-500); animation: shake .4s; }
.opt.dim { opacity: .5; }
.badge-ok { position: absolute; top: 6px; right: 6px; color: #2F7A3A; background: #fff; border-radius: 50%; }
.reward { margin: 0; text-align: center; font-size: var(--fs-h2); font-weight: 800; color: var(--secondary-700); display: flex; justify-content: center; align-items: center; gap: 6px; }
.done { background: linear-gradient(170deg, #FFF8E2, var(--white)); }
.bigstars { display: flex; justify-content: center; gap: 6px; color: var(--gray-200); }
.bigstars .on { color: var(--secondary-500); }
.sc { margin: 0; font-size: var(--fs-h1); font-weight: 800; color: var(--primary-700); }
.got { margin: 0; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: var(--fs-h2); font-weight: 800; color: #AD7B2B; }
@keyframes shake { 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
@media (prefers-reduced-motion: reduce) { .opt.wrong { animation: none; } }
</style>
