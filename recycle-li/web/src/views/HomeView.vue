<script setup lang="ts">
// 首頁＝我的里的風景：上面是等級和星星，中間是會動的小島（點了去蓋房子，右下角有「蓋房子」），
// 下面小里長只說一句話、只給一個「現在做這個」的大按鈕。其他功能在底部選單。
import { computed } from 'vue'
import { FULL_GAME } from '@/focus'
import Zy from '@/components/Zy.vue'
import Mascot from '@/components/Mascot.vue'
import IsoLi from '@/components/IsoLi.vue'
import KidHud from '@/components/KidHud.vue'
import AppIcon from '@/components/AppIcon.vue'
import { missions } from '@/domain/catalog'
import { LEVELS } from '@/solvers/quiz'
import { useGame } from '@/stores/game'

const game = useGame()
const liName = computed(() => game.li.name)
const nextLevel = computed(() => LEVELS.find((l) => game.levelOpen(l.id) && !(game.levels[l.id]?.stars ?? 0)))

// 今天的任務：只用圖示和進度圈，不用讀字
const today = computed(() => missions.filter((m) => m.type.startsWith('daily')).map((m) => ({ m, p: game.missionProgress(m.id) })))
const R = 21
const C = 2 * Math.PI * R

// 現在最適合做的一件事
const next = computed(() => {
  // 學習主線（掃一掃 → 怎麼丟 → 考考你）；蓋房子只在底部選單和上面的小島
  if (!FULL_GAME || !game.missionProgress('daily_scan3').done) return { to: '/scan', icon: 'Camera', text: '掃一掃', line: '找一個要丟的東西，掃掃看！', c: 'scan' }
  if (nextLevel.value) return { to: `/quiz/${nextLevel.value.id}`, icon: 'Map', text: `第 ${nextLevel.value.id} 關`, line: '來考考你，答對拿星星！', c: 'quiz' }
  return { to: '/scan', icon: 'Camera', text: '掃一掃', line: '找一個要丟的東西，掃掃看！', c: 'scan' }
})
</script>

<template>
  <main class="page stack">
    <h1 class="sr-only">回收小里長</h1>
    <KidHud />

    <!-- 小島是風景；右下角的「蓋房子」按鈕一律保留（src/focus.ts） -->
    <div class="scene">
      <span class="name"><AppIcon :name="game.li.icon" :size="18" /> <Zy :text="liName" /></span>
      <span v-if="FULL_GAME" class="green"><AppIcon name="Leaf" :size="16" /> {{ game.green }}</span>
      <IsoLi :li="game.li" :slots="game.slots" label="我的里" />
      <router-link to="/build" class="build-chip" aria-label="蓋房子"><AppIcon name="Building" :size="20" :stroke="2" /> <Zy text="蓋房子" /></router-link>
    </div>

    <section class="talk">
      <Mascot :size="60" :line="next.line" />
      <router-link :to="next.to" class="go" :class="next.c">
        <AppIcon :name="next.icon" :size="34" :stroke="2" />
        <span><Zy :text="next.text" /></span>
        <AppIcon name="ChevronRight" :size="28" :stroke="2.4" />
      </router-link>
    </section>

    <router-link v-if="FULL_GAME" to="/missions" class="today" aria-label="今天的任務">
      <span class="lbl"><AppIcon name="Sun" :size="22" /> <Zy text="今天" /></span>
      <span v-for="t in today" :key="t.m.id" class="ring" :class="{ done: t.p.done }" :aria-label="`${t.m.title} ${t.p.count}/${t.p.goal}`">
        <svg viewBox="0 0 50 50" aria-hidden="true">
          <circle cx="25" cy="25" :r="R" fill="none" stroke="#E3E7E9" stroke-width="5" />
          <circle cx="25" cy="25" :r="R" fill="none" :stroke="t.p.done ? '#4E9A57' : '#F5BA4B'" stroke-width="5" stroke-linecap="round"
            :stroke-dasharray="`${(C * t.p.count) / t.p.goal} ${C}`" transform="rotate(-90 25 25)" />
        </svg>
        <AppIcon v-if="t.p.done" name="Check" :size="22" :stroke="3" class="ico" />
        <AppIcon v-else :name="t.m.icon" :size="22" :stroke="2" class="ico" />
      </span>
    </router-link>
  </main>
</template>

<style scoped>
.scene {
  position: relative; display: block; text-decoration: none; border-radius: 28px; padding: 26px 4px 6px;
  background: radial-gradient(120% 80% at 50% 0%, #F7FCFF 0%, #DDF1F8 55%, #CFEBD6 100%);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .7), var(--shadow);
}
.name, .green {
  position: absolute; top: 10px; z-index: 2; display: inline-flex; align-items: center; gap: 4px;
  background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 4px 12px; font-weight: 800; box-shadow: var(--shadow);
}
.name { left: 12px; color: var(--primary-800); }
.green { right: 12px; color: #2F6B3A; }
.build-chip {
  position: absolute; right: 12px; bottom: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 4px;
  min-height: 48px; padding: 4px 14px; border-radius: 999px; background: #F5BA4B; text-decoration: none; color: #3B2A06; font-weight: 800; box-shadow: var(--shadow);
}
.talk { display: flex; flex-direction: column; gap: 12px; }
.go {
  display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 12px 18px; border-radius: 24px;
  text-decoration: none; color: #fff; font-size: var(--fs-h2); font-weight: 800; background: var(--c);
  box-shadow: 0 6px 0 color-mix(in srgb, var(--c) 70%, black), 0 10px 20px color-mix(in srgb, var(--c) 30%, transparent);
}
.go span { flex: 1; }
.go:active { transform: translateY(3px); box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 70%, black); }
/* 照台北通 Figma：一般動作用主色藍綠；花星星（蓋房子）用黃色，像「餵食」 */
.go { --c: #5AB4C5; }
.go.build { --c: #F5BA4B; color: #3B2A06; }
.today { display: flex; align-items: center; gap: 10px; text-decoration: none; background: rgba(255, 255, 255, .75); border-radius: 22px; padding: 8px 14px; box-shadow: var(--shadow); }
.lbl { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #AD7B2B; margin-right: auto; white-space: nowrap; flex: none; width: max-content; }
.ring { position: relative; width: 50px; height: 50px; display: grid; place-items: center; color: var(--primary-700); }
.ring svg { position: absolute; inset: 0; }
.ring :deep(.ico) { position: absolute; inset: 0; margin: auto; }
.ring.done { color: #2F7A3A; }
</style>
