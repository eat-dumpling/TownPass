<script setup lang="ts">
// 星星（唯一的獎勵）：金色、填滿
import AppIcon from './AppIcon.vue'
withDefaults(defineProps<{ size?: number; label?: string }>(), { size: 20 })
</script>

<template>
  <AppIcon name="Star" class="star-ico" :size="size" :stroke="2" :label="label" />
</template>

<style scoped>
.star-ico { color: #E7A43C; fill: #FCD56B; }
</style>
