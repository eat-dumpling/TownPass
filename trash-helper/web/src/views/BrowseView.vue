<script setup lang="ts">
// 從清單選：先選大類（圖），或直接搜尋（中英文都可以）。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import ItemArt from '~/components/ItemArt.vue'
import { groups, kindMeta } from '@/domain/catalog'
import type { GroupId } from '@/domain/types'
import { itemName, items } from '~/lib/rules'
import type { LangId } from '~/i18n'

const { t, locale } = useI18n()
const q = ref('')
const group = ref<GroupId | null>(null)
const all = items()
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (s) return all.filter((i) => i.name.zh.includes(s) || i.name.en.toLowerCase().includes(s) || i.prompts.some((p) => p.includes(s)))
  return group.value ? all.filter((i) => i.group === group.value) : []
})
const lang = computed(() => locale.value as LangId)
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('id_browse')" back="/identify" />
    <input v-model="q" class="search" type="search" :placeholder="t('search')" :aria-label="t('search')" />
    <div v-if="!q && !group" class="grid2">
      <button v-for="g in groups" :key="g.id" class="tile" @click="group = g.id">
        <AppIcon :name="g.icon" :size="44" :stroke="1.6" /><span>{{ t(`groups.${g.id}`) }}</span>
      </button>
    </div>
    <template v-else>
      <button v-if="group && !q" class="btn ghost" @click="group = null"><AppIcon name="ArrowBackUp" /> {{ t(`groups.${group}`) }}</button>
      <p v-if="!list.length" class="muted">{{ t('no_match') }}</p>
      <ul class="list">
        <li v-for="it in list" :key="it.id">
          <router-link :to="`/item/${it.id}`" class="row-item">
            <ItemArt :item="it" :size="48" />
            <span class="txt"><b>{{ itemName(it, lang) }}</b><small :style="{ color: kindMeta[it.kind].color }">{{ t(`kinds.${it.kind}`) }}</small></span>
            <AppIcon name="ChevronRight" />
          </router-link>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.search { min-height: 52px; border-radius: 14px; border: 2px solid var(--gray-200); padding: 0 14px; font-size: var(--fs-h3); }
.tile { min-height: 104px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row-item { display: flex; align-items: center; gap: 12px; background: var(--white); border-radius: 14px; padding: 8px 12px; box-shadow: var(--shadow); text-decoration: none; color: var(--gray-900); min-height: 64px; }
.txt { flex: 1; display: flex; flex-direction: column; }
.txt small { font-weight: 700; }
</style>
