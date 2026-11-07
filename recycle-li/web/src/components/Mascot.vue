<script setup lang="ts">
// 吉祥物「綠芽寶」（照台北通 Figma 的角色：TTH 元件）：圓頂的淺藍色小身體、深藍綠粗外框、白肚子，
// 頭上一根小莖長出一片綠葉。和台北垃圾生活助手共用同一個角色。
// 四種心情：happy 微笑、think 想一想、cheer 歡呼（閃光）、oops 哎呀（葉子垂下來）。
import Zy from '@/components/Zy.vue'
const props = withDefaults(defineProps<{ mood?: 'happy' | 'think' | 'cheer' | 'oops'; line?: string; size?: number }>(), { mood: 'happy', size: 64 })
</script>

<template>
  <div class="mascot">
    <svg class="bob" :width="props.size" :height="props.size" viewBox="0 0 64 64" role="img" aria-label="綠芽寶">
      <defs>
        <linearGradient id="lyBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#B9DFEA" /><stop offset="1" stop-color="#9CCCDC" />
        </linearGradient>
      </defs>
      <!-- 影子 -->
      <ellipse cx="32" cy="60.5" rx="18" ry="2.4" fill="#22474E" opacity=".12" />
      <!-- 小莖＋一片葉子（哎呀的時候垂下來） -->
      <g :class="['sprout', { droop: props.mood === 'oops' }]">
        <path d="M32 15 C32.5 11.5 34 9 36.5 7.5" stroke="#2F5F6E" stroke-width="2.2" fill="none" stroke-linecap="round" />
        <path d="M36 8 C38.5 3.5 44 2.5 47 4 C45.5 8.5 40.5 10.5 36 8 Z" fill="#6DBE6B" stroke="#2F5F6E" stroke-width="1.4" stroke-linejoin="round" />
      </g>
      <!-- 身體：圓頂、底部寬平 -->
      <path d="M32 14 C21 14 13 26 11 40 C9.6 50 13 57 20 58 L44 58 C51 57 54.4 50 53 40 C51 26 43 14 32 14 Z"
        fill="url(#lyBody)" stroke="#2F5F6E" stroke-width="2.6" stroke-linejoin="round" />
      <!-- 白肚子 -->
      <ellipse cx="32" cy="50.5" rx="13.5" ry="6" fill="#EAF6FA" />
      <!-- 臉頰 -->
      <ellipse cx="22.5" cy="38" rx="2.6" ry="1.7" fill="#F5B7A6" />
      <ellipse cx="41.5" cy="38" rx="2.6" ry="1.7" fill="#F5B7A6" />
      <!-- 眼睛 -->
      <template v-if="props.mood === 'cheer'">
        <path d="M24 34 q2.5 -3 5 0 M35 34 q2.5 -3 5 0" stroke="#2F5F6E" stroke-width="2.2" fill="none" stroke-linecap="round" />
      </template>
      <template v-else-if="props.mood === 'oops'">
        <path d="M23.5 30 l4.5 1.2 M40.5 30 l-4.5 1.2" stroke="#2F5F6E" stroke-width="1.6" stroke-linecap="round" />
        <ellipse cx="26.5" cy="34.5" rx="1.9" ry="2.2" fill="#2F5F6E" /><ellipse cx="37.5" cy="34.5" rx="1.9" ry="2.2" fill="#2F5F6E" />
      </template>
      <template v-else>
        <ellipse cx="26.5" cy="34" rx="2" ry="2.4" fill="#2F5F6E" /><ellipse cx="37.5" cy="34" rx="2" ry="2.4" fill="#2F5F6E" />
        <circle :cx="props.mood === 'think' ? 27.2 : 27" :cy="props.mood === 'think' ? 32.6 : 33.2" r=".75" fill="#fff" />
        <circle :cx="props.mood === 'think' ? 38.2 : 38" :cy="props.mood === 'think' ? 32.6 : 33.2" r=".75" fill="#fff" />
      </template>
      <!-- 嘴巴 -->
      <path v-if="props.mood === 'happy'" d="M29.5 38.5 q1.25 1.4 2.5 0 q1.25 1.4 2.5 0" stroke="#2F5F6E" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path v-else-if="props.mood === 'cheer'" d="M28.5 38 q3.5 5 7 0 z" fill="#E66B5B" stroke="#2F5F6E" stroke-width="1.3" stroke-linejoin="round" />
      <ellipse v-else-if="props.mood === 'think'" cx="32.5" cy="39.5" rx="1.4" ry="1.2" fill="#2F5F6E" />
      <path v-else d="M29 40 q1.5 -1.6 3 0 t3 0" stroke="#2F5F6E" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <!-- 歡呼的閃光、想一想的點點（顏色跟台北通一致） -->
      <g v-if="props.mood === 'cheer'" fill="#F5BA4B">
        <path d="M8 18 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 z" />
        <path d="M56 22 l1.1 2.2 2.2 1.1 -2.2 1.1 -1.1 2.2 -1.1 -2.2 -2.2 -1.1 2.2 -1.1 z" />
      </g>
      <g v-else-if="props.mood === 'think'" fill="#5AB4C5">
        <circle cx="51" cy="20" r="1.5" /><circle cx="55" cy="15" r="2.1" />
      </g>
    </svg>
    <p v-if="line" class="bubble"><Zy :text="line" /></p>
  </div>
</template>

<style scoped>
.mascot { display: flex; align-items: center; gap: 10px; }
svg { flex: none; display: block; overflow: visible; }
.sprout { transform-box: fill-box; transform-origin: 0% 100%; animation: sprout 3.2s ease-in-out infinite; }
.sprout.droop { animation: none; transform: rotate(18deg); }
@keyframes sprout { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@media (prefers-reduced-motion: reduce) { .sprout { animation: none; } }
.bubble {
  margin: 0; background: var(--white); border-radius: 18px; padding: 10px 14px; box-shadow: var(--shadow);
  font-size: var(--fs-title); font-weight: 700; position: relative; color: var(--primary-900);
}
.bubble::before { content: ''; position: absolute; left: -8px; top: 50%; margin-top: -8px; border: 8px solid transparent; border-right-color: var(--white); border-left: 0; }
</style>
