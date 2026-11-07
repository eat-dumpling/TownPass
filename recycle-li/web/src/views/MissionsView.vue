<script setup lang="ts">
import { onMounted } from 'vue'
// 任務與成就：只跟「掃描分對」和「蓋里」有關，全部自動判定、不需要家長確認。
// 任務完成、成就升級（銅、銀、金）都給星星；星星累積決定等級。
import Zy from '@/components/Zy.vue'
import KidHud from '@/components/KidHud.vue'
import AppIcon from '@/components/AppIcon.vue'
import RankRoad from '@/components/RankRoad.vue'
import { achievements, missions } from '@/domain/catalog'
import type { Mission } from '@/domain/types'
import { TIER_BONUS, useGame } from '@/stores/game'

const game = useGame()
// 打開任務頁＝看過了，獎盃上的小紅點消失
onMounted(() => { game.daily.seen = missions.filter((m) => game.missionProgress(m.id).done).length })
const daily = missions.filter((m) => m.type.startsWith('daily'))
const weekly = missions.filter((m) => m.type.startsWith('weekly'))
const tierColor = ['#CAD1D5', '#C98B54', '#ADB8BE', '#F5BA4B']
const tierName = ['', '銅', '銀', '金']
const rewardText = (m: Mission) => `+${m.reward.stars}`
const titleOf = (title: string, tier: number) => title.split('／')[Math.max(0, Math.min(title.split('／').length - 1, tier - 1))]
</script>

<template>
  <main class="page stack">
    <KidHud title="任務" />

    <RankRoad />

    <template v-for="[title, list] in ([['今天', daily], ['這週', weekly]] as const)" :key="title">
      <h2 class="h2"><AppIcon v-if="title === '今天'" name="Sun" :size="20" /><AppIcon v-else name="Calendar" :size="20" /> <Zy :text="title" /></h2>
      <ul class="list">
        <li v-for="m in list" :key="m.id" class="card row" :class="{ done: game.missionProgress(m.id).done }">
          <AppIcon :name="m.icon" :size="36" :stroke="1.6" />
          <div style="flex: 1" class="stack tight">
            <strong><Zy :text="m.title" /></strong>
            <div class="bar"><i :style="{ width: (game.missionProgress(m.id).count / game.missionProgress(m.id).goal) * 100 + '%' }"></i></div>
            <small class="muted reward"><AppIcon name="Star" :size="14" /> {{ rewardText(m) }}</small>
          </div>
          <AppIcon v-if="game.missionProgress(m.id).done" name="CircleCheck" :size="30" label="完成" class="ok" />
          <span v-else class="cnt">{{ game.missionProgress(m.id).count }}/{{ game.missionProgress(m.id).goal }}</span>
        </li>
      </ul>
    </template>

    <h2 class="h2"><AppIcon name="Trophy" :size="20" /> <Zy text="成就" /></h2>
    <div class="grid3">
      <div v-for="a in achievements" :key="a.id" class="tile badge-tile" :style="{ borderColor: tierColor[game.achievementTier(a.id).tier] }">
        <AppIcon :name="a.icon" :size="40" :stroke="1.6" :class="{ off: !game.achievementTier(a.id).tier }" />
        <span class="nm"><Zy :text="titleOf(a.title, game.achievementTier(a.id).tier)" /></span>
        <span class="caption">
          <template v-if="game.achievementTier(a.id).tier">{{ tierName[game.achievementTier(a.id).tier] }}・</template>{{ game.achievementTier(a.id).n }}<template v-if="game.achievementTier(a.id).next">/{{ game.achievementTier(a.id).next }}</template>
        </span>
        <small v-if="game.achievementTier(a.id).next" class="reward"><AppIcon name="Star" :size="12" /> +{{ TIER_BONUS[game.achievementTier(a.id).tier + 1] }}</small>
      </div>
    </div>
  </main>
</template>

<style scoped>
.reward { display: inline-flex; align-items: center; gap: 2px; color: #AD7B2B; font-weight: 800; }
.h2 { font-size: var(--fs-title); margin: 8px 0 0; display: flex; align-items: center; gap: 6px; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.tight { gap: 4px; }
.done { background: #F0FAF0; }
.ok { color: #2F7A3A; }
.cnt { font-weight: 800; color: var(--primary-700); }
.badge-tile { border: 4px solid; }
.off { opacity: .3; }
.nm { font-size: var(--fs-body); text-align: center; }
</style>
