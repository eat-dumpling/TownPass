<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGame } from '@/stores/game'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const game = useGame()
const title = computed(() => (route.meta.title as string) ?? '回收小里長')
watch(title, (t) => (document.title = `${t}｜回收小里長`), { immediate: true })
</script>

<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" :key="route.fullPath" />
  </router-view>
  <div v-if="game.toast" class="toast pop" role="status" aria-live="polite">
    <AppIcon :name="game.toast.icon" /> {{ game.toast.text }}
  </div>
</template>

<style scoped>
.toast {
  position: fixed; left: 16px; right: 16px; margin: 0 auto; width: fit-content; bottom: calc(20px + env(safe-area-inset-bottom));
  background: var(--primary-900); color: var(--white); padding: 12px 18px; border-radius: 999px;
  font-weight: 600; box-shadow: var(--shadow); z-index: 1000; max-width: 90vw;
}
</style>
