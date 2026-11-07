<script setup lang="ts">
// 用選的：不出題目。掃描不確定時直接給最可能的幾張圖卡；沒掃描就先選大圖卡（喝的、吃的…），再點品項卡。
import Zy from '@/components/Zy.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import { groups, itemById, visibleItems } from '@/domain/catalog'
import type { GroupId, Item } from '@/domain/types'

const route = useRoute()
const router = useRouter()

// 掃描傳來的候選（id:機率），取最可能的 4 個
function fromQuery(): Item[] | null {
  const c = route.query.c as string | undefined
  if (!c) return null
  const out = c.split(',').map((part) => itemById(part.split(':')[0])).filter((i): i is Item => !!i)
  return out.length ? out.slice(0, 4) : null
}
const scanned = fromQuery()
const useScan = ref(!!scanned)
const group = ref<GroupId | null>(null)
const cards = computed<Item[] | null>(() => {
  if (group.value) return visibleItems().filter((i) => i.group === group.value)
  return useScan.value ? scanned : null
})
const leaving = ref(false)
function go(id: string) { leaving.value = true; router.replace(`/catch/${id}`) }
</script>

<template>
  <main v-if="!leaving" class="page stack">
    <TopBar :title="cards ? '是哪一個？' : '它是哪一種？'" back="/" />

    <template v-if="!cards">
      <Mascot mood="think" :size="48" line="它是哪一種？" />
      <div class="grid2">
        <button v-for="g in groups" :key="g.id" class="tile" :class="{ 'danger-frame': g.id === 'danger' }" @click="group = g.id">
          <AppIcon :name="g.icon" :size="48" :stroke="1.6" /><Zy :text="g.label" />
        </button>
      </div>
    </template>

    <template v-else>
      <Mascot mood="think" :size="48" line="是哪一個？點它" />
      <div class="grid3">
        <button v-for="it in cards" :key="it.id" class="tile pop" @click="go(it.id)">
          <ItemArt :item="it" :size="64" /><Zy :text="it.name.zh" />
        </button>
      </div>
      <button class="btn ghost" @click="group = null; useScan = false"><AppIcon name="ArrowBackUp" /> <Zy text="都不是，換一種" /></button>
    </template>
  </main>
</template>
