<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
const { t, locale } = useI18n()
const route = useRoute()
watch(locale, (l) => {
  document.documentElement.lang = l === 'zh' ? 'zh-Hant-TW' : 'en'
  document.title = t('app')
}, { immediate: true })
</script>

<template>
  <router-view v-slot="{ Component }"><component :is="Component" :key="route.fullPath" /></router-view>
</template>
