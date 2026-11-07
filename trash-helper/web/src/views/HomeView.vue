<script setup lang="ts">
// 首頁：三件事，各一個大按鈕。
import { useI18n } from 'vue-i18n'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
const { t } = useI18n()
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('app')" :back="false" />
    <p class="big-q">{{ t('home_q') }}</p>
    <router-link to="/identify" class="choice">
      <span class="ic" style="background: var(--primary-500)"><AppIcon name="Camera" :size="32" /></span>
      <span><b>{{ t('home_sort') }}</b><small>{{ t('home_sort_sub') }}</small></span>
    </router-link>
    <router-link to="/today" class="choice">
      <span class="ic" style="background: #1F7A4D"><AppIcon name="CalendarCheck" :size="32" /></span>
      <span><b>{{ t('home_today') }}</b><small>{{ t('home_today_sub') }}</small></span>
    </router-link>
    <router-link to="/first-time" class="choice">
      <span class="ic" style="background: var(--secondary-600)"><AppIcon name="Truck" :size="32" /></span>
      <span><b>{{ t('home_first') }}</b><small>{{ t('home_first_sub') }}</small></span>
    </router-link>
    <p class="caption center">{{ t('prototype') }}</p>
  </main>
</template>
