<script setup lang="ts">
// 家長關卡：確認任務、改設定、切換語言前先回答一題大人題。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'
const emit = defineEmits<{ pass: [] }>()
const { t } = useI18n()
const a = 6 + Math.floor(Math.random() * 13)
const b = 7 + Math.floor(Math.random() * 12)
const v = ref('')
const wrong = ref(false)
function check() {
  if (Number(v.value) === a + b) emit('pass')
  else { wrong.value = true; v.value = '' }
}
</script>

<template>
  <form class="card stack gate" @submit.prevent="check">
    <label for="gate" class="q"><AppIcon name="UserShield" /> {{ t('gate', { a, b }) }}</label>
    <input id="gate" v-model="v" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="in" :class="{ shake: wrong }" />
    <p v-if="wrong" class="muted" role="alert">{{ t('gateWrong') }}</p>
    <button class="btn primary block" type="submit">OK</button>
  </form>
</template>

<style scoped>
.q { font-size: var(--fs-title); font-weight: 700; }
.in { min-height: var(--tap); font-size: var(--fs-h2); border-radius: 14px; border: 2px solid var(--gray-200); padding: 8px 12px; text-align: center; }
</style>
