<script setup lang="ts">
// 品項卡：跟辨識結果用同一張指引卡（分類、什麼時候、交給誰、步驟、注意），再加上來源。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import StepStrip from '@/components/StepStrip.vue'
import { collectionOf, itemById, kindMeta, safetyLabel, whereMeta } from '@/domain/catalog'
import { openLink } from '@/bridge/flutter'

const route = useRoute()
const item = computed(() => itemById(route.params.id as string)!)
const kind = computed(() => kindMeta[item.value.kind])
const coll = computed(() => collectionOf(item.value))
</script>

<template>
  <main class="page stack" v-if="item">
    <TopBar :title="item.name.zh" back="/guide" />
    <section class="card stack guide" :class="{ 'danger-frame': item.safety !== 'none' }" :style="{ borderTopColor: kind.color }">
      <div class="center"><ItemArt :item="item" :size="120" class="pop" /></div>
      <div class="center"><span class="kind" :style="{ background: kind.color }"><AppIcon :name="kind.icon" :size="20" /> {{ kind.label }}</span></div>
      <p v-if="item.safety !== 'none'" class="center"><span class="badge tag-adult"><AppIcon name="AlertTriangle" :size="14" /> {{ safetyLabel[item.safety] }}</span></p>
      <dl class="facts">
        <div><dt>臺北分類</dt><dd>{{ coll.label }}</dd></div>
        <div v-if="coll.when"><dt>什麼時候</dt><dd>{{ coll.when }}</dd></div>
        <div v-if="item.where.length"><dt>交給</dt><dd class="where"><span v-for="w in item.where" :key="w"><AppIcon :name="whereMeta[w].icon" :size="18" /> {{ whereMeta[w].label }}</span></dd></div>
      </dl>
      <StepStrip v-if="item.safety !== 'no_touch'" :steps="item.steps" :color="kind.color" />
      <p v-if="item.notes" class="note"><AppIcon name="Bulb" :size="18" /> {{ item.notes }}</p>
    </section>
    <p class="caption">來源：{{ item.source }}<template v-if="coll.source">；{{ coll.source }}</template>
      <span v-if="item.status !== 'verified'" class="badge tag-draft">未核對</span></p>
    <button class="btn ghost" @click="openLink('https://dep-recycle.gov.taipei/')"><AppIcon name="ExternalLink" /> 回收一點通</button>
  </main>
</template>

<style scoped>
.guide { border-top: 8px solid; }
.kind { color: #fff; border-radius: 8px; padding: 6px 12px; font-weight: 800; font-size: var(--fs-title); display: inline-flex; align-items: center; gap: 6px; }
.facts { margin: 0; display: grid; gap: 8px; }
.facts > div { display: grid; grid-template-columns: 6em 1fr; gap: 8px; }
dt { color: var(--gray-600); }
dd { margin: 0; font-weight: 700; }
.where { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.where span { display: inline-flex; align-items: center; gap: 4px; }
.note { margin: 0; background: var(--secondary-50); border-radius: 12px; padding: 10px 12px; font-weight: 600; display: flex; gap: 6px; }
</style>
