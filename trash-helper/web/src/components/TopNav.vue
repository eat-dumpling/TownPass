<script setup lang="ts">
// 每頁一個標題（無障礙）；返回鍵 48×48；右上角切換語言（越南文、印尼文預留，尚未開放）。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { LANGS, type LangId } from '~/i18n'
defineProps<{ title: string; back?: string | false }>()
const { t, locale } = useI18n()
const router = useRouter()
const open = ref(false)
function setLang(l: LangId) {
  locale.value = l
  try { localStorage.setItem('tth-lang', l) } catch { /* 無法儲存就只在這次有效 */ }
  open.value = false
}
</script>

<template>
  <header class="nav">
    <button v-if="back !== false" class="btn ghost icon" :aria-label="t('back')" @click="back ? router.push(back) : router.back()"><AppIcon name="ChevronLeft" :size="28" /></button>
    <h1>{{ title }}</h1>
    <button class="btn ghost lang" :aria-label="t('lang')" :aria-expanded="open" @click="open = !open"><AppIcon name="Language" /> {{ locale === 'zh' ? '中' : 'EN' }}</button>
    <ul v-if="open" class="menu" role="menu">
      <li v-for="l in LANGS" :key="l.id">
        <button role="menuitemradio" :aria-checked="locale === l.id" :disabled="!l.ready" @click="setLang(l.id)">
          {{ l.label }}<small v-if="!l.ready"> · {{ t('soon') }}</small>
        </button>
      </li>
    </ul>
  </header>
</template>

<style scoped>
.nav { display: flex; align-items: center; gap: 4px; min-height: 56px; position: relative; }
h1 { flex: 1; margin: 0; font-size: var(--fs-h2); color: var(--primary-900); }
.icon { width: var(--tap); padding: 0; }
.lang { font-size: var(--fs-body); gap: 4px; }
.menu { position: absolute; right: 0; top: 52px; z-index: 10; list-style: none; margin: 0; padding: 6px; background: var(--white); border-radius: 14px; box-shadow: var(--shadow); min-width: 200px; }
.menu button { width: 100%; min-height: var(--tap); border: 0; background: none; text-align: left; padding: 0 12px; border-radius: 10px; font-size: var(--fs-h3); }
.menu button[aria-checked='true'] { background: var(--primary-100); font-weight: 700; }
.menu button:disabled { color: var(--gray-300); }
</style>
