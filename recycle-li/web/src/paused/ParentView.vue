<script setup lang="ts">
// 14 家長確認：大人題 → 倒了幾袋與專用袋尺寸 → 確認，孩子拿到金色資源。家長可切換自己的語言。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import ParentGate from '@/components/ParentGate.vue'
import { BAG_SIZES, today, useGame } from '@/stores/game'
import type { Lang } from '@/domain/types'

const game = useGame()
const { t, locale } = useI18n()
locale.value = game.settings.parentLang
const passed = ref(false)
const done = ref(false)
const generalBags = ref(1)
const size = ref<number>(14)
const recycleBags = ref(game.tonight?.bags.some((c) => c.startsWith('recycle')) ? 1 : 0)
const foodBags = ref(0)
const langs: { id: Lang; label: string }[] = [
  { id: 'zh', label: '中文' }, { id: 'en', label: 'English' }, { id: 'vi', label: 'Tiếng Việt' }, { id: 'id', label: 'Bahasa Indonesia' },
]
function setLang(l: Lang) { game.settings.parentLang = l; locale.value = l }
function confirm() {
  const tonight = game.tonight?.date === today() ? game.tonight : null
  // 準時：今天有派今晚任務且尚未完成（之後可改成比對排定停靠時間）
  const onTime = !!tonight && !tonight.done
  game.confirmDisposal({ generalLiters: generalBags.value * size.value, recycleBags: recycleBags.value, foodBags: foodBags.value, onTime })
  done.value = true
}
</script>

<template>
  <main class="page stack">
    <TopBar :title="t('howMany')" back="/" />
    <ParentGate v-if="!passed" @pass="passed = true" />
    <template v-else-if="!done">
      <div class="langs" role="group" :aria-label="t('lang')">
        <button v-for="l in langs" :key="l.id" class="btn" :class="{ primary: locale === l.id }" @click="setLang(l.id)">{{ l.label }}</button>
      </div>
      <div class="card stack">
        <div class="row cnt"><span>🗑️ {{ t('generalBags') }}</span><button class="btn" aria-label="-1" @click="generalBags = Math.max(0, generalBags - 1)">−</button><b>{{ generalBags }}</b><button class="btn" aria-label="+1" @click="generalBags++">＋</button></div>
        <label class="stack"><span>{{ t('bagSize') }}</span>
          <div class="sizes"><button v-for="s in BAG_SIZES" :key="s" class="btn" :class="{ secondary: size === s }" @click="size = s">{{ s }}{{ t('liters') }}</button></div>
        </label>
        <div class="row cnt"><span>♻️ {{ t('recycleBags') }}</span><button class="btn" aria-label="-1" @click="recycleBags = Math.max(0, recycleBags - 1)">−</button><b>{{ recycleBags }}</b><button class="btn" aria-label="+1" @click="recycleBags++">＋</button></div>
        <div class="row cnt"><span>🥬 {{ t('foodBags') }}</span><button class="btn" aria-label="-1" @click="foodBags = Math.max(0, foodBags - 1)">−</button><b>{{ foodBags }}</b><button class="btn" aria-label="+1" @click="foodBags++">＋</button></div>
        <p class="caption">{{ t('estimate') }}</p>
      </div>
      <button class="btn primary block" @click="confirm">✅ {{ t('confirm') }}</button>
    </template>
    <template v-else>
      <Mascot mood="cheer" line="拿到金色資源 🌟" />
      <router-link to="/factory" class="btn secondary block">🏗️ 去蓋特別建築</router-link>
      <router-link to="/report" class="btn block">📊 本週報告</router-link>
    </template>
  </main>
</template>

<style scoped>
.langs { display: flex; gap: 6px; flex-wrap: wrap; }
.cnt { justify-content: space-between; font-size: var(--fs-h3); font-weight: 700; }
.cnt span { flex: 1; }
.sizes { display: flex; gap: 6px; flex-wrap: wrap; }
.sizes .btn { min-width: 64px; }
</style>
