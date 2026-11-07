<script setup lang="ts">
// 遊戲式的頂部狀態列：左邊等級（圓圈是離下一級的進度）、右邊手上的星星和任務獎盃。
// 有任務做完了，獎盃上會有一個小紅點。
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import Zy from './Zy.vue'
import { missions } from '@/domain/catalog'
import { useGame } from '@/stores/game'
import { backToDiudiu } from '@/bridge/back'

defineProps<{ title?: string }>()
const game = useGame()
const back = backToDiudiu()
const r = computed(() => game.rank)
const pct = computed(() => (r.value.next ? Math.min(1, r.value.into / r.value.span) : 1))
const ring = 2 * Math.PI * 25
// 有新完成的任務（今天打開任務頁之後才完成的）就亮小紅點
const fresh = computed(() => missions.filter((m) => game.missionProgress(m.id).done).length > (game.daily.seen ?? 0))
</script>

<template>
  <header class="hud">
    <router-link to="/missions" class="lv" :aria-label="`等級 ${r.lv}，${r.title}`">
      <svg viewBox="0 0 60 60" class="ring" aria-hidden="true">
        <circle cx="30" cy="30" r="25" fill="none" stroke="#E3E7E9" stroke-width="6" />
        <circle cx="30" cy="30" r="25" fill="none" stroke="#F5BA4B" stroke-width="6" stroke-linecap="round"
          :stroke-dasharray="`${ring * pct} ${ring}`" transform="rotate(-90 30 30)" />
      </svg>
      <span class="ico"><AppIcon :name="r.icon" :size="22" :stroke="2" /></span>
      <b class="n">{{ r.lv }}</b>
    </router-link>
    <div class="mid">
      <h1 v-if="title" class="t"><Zy :text="title" /></h1>
      <span v-else class="rt"><Zy :text="r.title" /></span>
    </div>
    <span class="stars" :aria-label="`手上有 ${game.stars} 顆星`"><AppIcon name="Star" :size="22" :stroke="2" class="st" /> {{ game.stars }}</span>
    <a v-if="back" :href="back" class="cup home" aria-label="回到丟丟">
      <AppIcon name="ArrowLeft" :size="24" :stroke="2.2" />
    </a>
    <router-link v-else to="/missions" class="cup" aria-label="任務與成就">
      <AppIcon name="Trophy" :size="24" :stroke="2" /><i v-if="fresh" class="dot"></i>
    </router-link>
  </header>
</template>

<style scoped>
.hud { display: flex; align-items: center; gap: 8px; min-height: 60px; }
.lv { position: relative; width: 56px; height: 56px; flex: none; display: grid; place-items: center; text-decoration: none; }
.ring { position: absolute; inset: 0; }
.ico { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(160deg, #FFE7A8, #F5BA4B); color: #7A4E0E; }
.n { position: absolute; right: -2px; bottom: -2px; min-width: 22px; height: 22px; border-radius: 999px; background: var(--primary-700); color: #fff; font-size: .8rem; display: grid; place-items: center; border: 2px solid #fff; }
.mid { flex: 1; min-width: 0; }
.t { margin: 0; font-size: var(--fs-title); color: var(--primary-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rt { font-weight: 800; color: var(--primary-800); font-size: var(--fs-title); }
.stars { display: inline-flex; align-items: center; gap: 4px; background: #fff; border-radius: 999px; padding: 6px 12px 6px 8px; font-weight: 800; font-size: var(--fs-title); color: #AD7B2B; box-shadow: var(--shadow); }
.st { color: #E7A43C; fill: #FCD56B; }
.cup { position: relative; width: var(--tap); height: var(--tap); border-radius: 50%; display: grid; place-items: center; background: #fff; box-shadow: var(--shadow); color: var(--primary-700); }
.home { color: #7A5200; background: #FFF4D6; }
.dot { position: absolute; top: 6px; right: 6px; width: 11px; height: 11px; border-radius: 50%; background: var(--red-500); border: 2px solid #fff; }
</style>
