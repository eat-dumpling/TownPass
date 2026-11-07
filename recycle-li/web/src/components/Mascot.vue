<script setup lang="ts">
// 吉祥物小里長（向量繪製的佔位版）：每個畫面都在，用表情和一句話回應孩子。M6 換成 mascot_{mood}.webp。
import Zy from '@/components/Zy.vue'
const props = withDefaults(defineProps<{ mood?: 'happy' | 'think' | 'cheer' | 'oops'; line?: string; size?: number }>(), { mood: 'happy', size: 64 })
</script>

<template>
  <div class="mascot">
    <svg class="bob" :width="props.size" :height="props.size" viewBox="0 0 64 64" role="img" aria-label="小里長">
      <!-- 葉子帽 -->
      <path d="M32 6c7 0 12 4 13 9-5 1-9-1-13-4-4 3-8 5-13 4 1-5 6-9 13-9z" fill="#5B9A4B" />
      <path d="M32 7v6" stroke="#3E7A33" stroke-width="2" stroke-linecap="round" />
      <!-- 臉 -->
      <circle cx="32" cy="36" r="21" fill="#FFE2C2" stroke="#E8B98F" stroke-width="2" />
      <circle cx="18" cy="40" r="3.5" fill="#F7B3A6" opacity=".7" />
      <circle cx="46" cy="40" r="3.5" fill="#F7B3A6" opacity=".7" />
      <!-- 眼睛 -->
      <template v-if="props.mood === 'cheer'">
        <path d="M21 33q4-5 8 0M35 33q4-5 8 0" stroke="#30383D" stroke-width="2.6" fill="none" stroke-linecap="round" />
      </template>
      <template v-else-if="props.mood === 'oops'">
        <path d="M21 31l6 4M27 31l-6 4M37 31l6 4M43 31l-6 4" stroke="#30383D" stroke-width="2.4" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="25" cy="33" r="3" fill="#30383D" /><circle cx="39" cy="33" r="3" fill="#30383D" />
        <path v-if="props.mood === 'think'" d="M35 26l8-2" stroke="#30383D" stroke-width="2" stroke-linecap="round" />
      </template>
      <!-- 嘴巴 -->
      <path v-if="props.mood === 'happy'" d="M25 43q7 6 14 0" stroke="#30383D" stroke-width="2.6" fill="none" stroke-linecap="round" />
      <path v-else-if="props.mood === 'cheer'" d="M24 42q8 10 16 0z" fill="#C2332F" />
      <circle v-else-if="props.mood === 'think'" cx="32" cy="45" r="2.6" fill="#30383D" />
      <path v-else d="M25 46q3.5-3 7 0t7 0" stroke="#30383D" stroke-width="2.4" fill="none" stroke-linecap="round" />
    </svg>
    <p v-if="line" class="bubble"><Zy :text="line" /></p>
  </div>
</template>

<style scoped>
.mascot { display: flex; align-items: center; gap: 10px; }
svg { flex: none; display: block; }
.bubble {
  margin: 0; background: var(--white); border-radius: 18px; padding: 10px 14px; box-shadow: var(--shadow);
  font-size: var(--fs-title); font-weight: 700; position: relative; color: var(--primary-900);
}
.bubble::before { content: ''; position: absolute; left: -8px; top: 50%; margin-top: -8px; border: 8px solid transparent; border-right-color: var(--white); border-left: 0; }
</style>
