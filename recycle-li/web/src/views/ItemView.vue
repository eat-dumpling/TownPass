<script setup lang="ts">
// 品項卡：跟辨識結果用同一張指引卡（分類、什麼時候、交給誰、步驟、注意），再加上來源。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import Zy from '@/components/Zy.vue'
import { useGame } from '@/stores/game'
import ItemArt from '@/components/ItemArt.vue'
import StepStrip from '@/components/StepStrip.vue'
import { binMetaFor, collectionOf, itemById, safetyLabel } from '@/domain/catalog'
import { openLink } from '@/bridge/flutter'

const route = useRoute()
const item = computed(() => itemById(route.params.id as string)!)
const game = useGame()
const kind = computed(() => binMetaFor(item.value, game.age))
const coll = computed(() => collectionOf(item.value))
</script>

<template>
  <main class="page stack" v-if="item">
    <TopBar :title="item.name.zh" back="/guide" />
    <section class="card stack guide" :class="{ 'danger-frame': item.safety !== 'none' }" :style="{ borderTopColor: kind.color }">
      <div class="center"><ItemArt :item="item" :size="120" class="pop" /></div>
      <div class="center"><span class="kind" :style="{ background: kind.color }"><AppIcon :name="kind.icon" :size="20" /> <Zy :text="kind.label" /></span></div>
      <p v-if="item.safety !== 'none'" class="center"><span class="badge tag-adult"><AppIcon name="AlertTriangle" :size="14" /> <Zy :text="safetyLabel[item.safety]" /></span></p>
      <StepStrip v-if="item.safety !== 'no_touch'" :steps="item.steps" :color="kind.color" />
      <p v-if="item.notes" class="note"><AppIcon name="Bulb" :size="18" /> <Zy :text="item.notes" /></p>
      <details v-if="coll.when" class="more">
        <summary><AppIcon name="Calendar" :size="18" /> <Zy text="什麼時候收" /></summary>
        <p><Zy :text="coll.when" /></p>
      </details>
    </section>
    <p class="caption"><Zy :text="`來源：${item.source}${coll.source ? '；' + coll.source : ''}`" />
      <span v-if="item.status !== 'verified'" class="badge tag-draft"><Zy text="未核對" /></span></p>
    <button class="btn ghost" @click="openLink('https://dep-recycle.gov.taipei/')"><AppIcon name="ExternalLink" /> <Zy text="回收一點通" /></button>
  </main>
</template>

<style scoped>
.guide { border-top: 8px solid; }
.kind { color: #fff; border-radius: 8px; padding: 6px 12px; font-weight: 800; font-size: var(--fs-title); display: inline-flex; align-items: center; gap: 6px; }
.more { color: var(--gray-600); }
.more summary { min-height: 48px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.more p { margin: 0 0 4px; font-weight: 700; color: var(--gray-800); }
.note { margin: 0; background: var(--secondary-50); border-radius: 12px; padding: 10px 12px; font-weight: 600; display: flex; gap: 6px; }
</style>
