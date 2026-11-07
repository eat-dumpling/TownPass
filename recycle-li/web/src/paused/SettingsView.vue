<script setup lang="ts">
// 設定（家長關卡後）：分齡、住哪個里（只存里的名稱）、暱稱。
import { ref } from 'vue'
import TopBar from '@/components/TopBar.vue'
import ParentGate from '@/components/ParentGate.vue'
import AppIcon from '@/components/AppIcon.vue'
import { DISTRICTS } from '@/domain/stops'
import { useGame } from '@/stores/game'
import { inTownPass } from '@/bridge/flutter'

const game = useGame()
const passed = ref(false)
const district = ref(game.settings.li?.district ?? '士林區')
const liName = ref(game.settings.li?.name ?? '')
function saveLi() { game.settings.li = liName.value.trim() ? { district: district.value, name: liName.value.trim() } : null; game.say('Check', '已儲存') }
function resetAll() {
  if (!window.confirm('清除這支手機上的所有進度？')) return
  indexedDB.deleteDatabase('keyval-store')
  location.reload()
}
</script>

<template>
  <main class="page stack">
    <TopBar title="設定" back="/" :zy="false" />
    <ParentGate v-if="!passed" @pass="passed = true" />
    <template v-else>
      <div class="card stack">
        <strong>孩子的年齡</strong>
        <div class="grid2">
          <button class="btn" :class="{ primary: game.settings.age === 'young' }" @click="game.settings.age = 'young'">5–8 歲（三個桶）</button>
          <button class="btn" :class="{ primary: game.settings.age === 'older' }" @click="game.settings.age = 'older'">9–12 歲（九個桶）</button>
        </div>
      </div>
      <div class="card stack">
        <strong>注音</strong>
        <div class="grid2">
          <button class="btn" :class="{ primary: game.settings.zhuyin }" @click="game.settings.zhuyin = true">國字＋注音</button>
          <button class="btn" :class="{ primary: !game.settings.zhuyin }" @click="game.settings.zhuyin = false">只有國字</button>
        </div>
      </div>
      <div class="card stack">
        <strong>住哪個里</strong>
        <select v-model="district" class="sel" aria-label="行政區"><option v-for="d in DISTRICTS" :key="d">{{ d }}</option></select>
        <input v-model="liName" class="sel" placeholder="例如：天母里" aria-label="里名" />
        <button class="btn primary" @click="saveLi">儲存</button>
        <p class="caption">只存里的名稱，不存位置。里界地圖：待接資料（見 TODO）。</p>
      </div>
      <div class="card stack">
        <label class="row"><input v-model="game.settings.nickname" class="sel" aria-label="暱稱" /></label>
        <p class="caption">執行環境：{{ inTownPass() ? '台北通 App' : '一般瀏覽器（模擬 flutterObject）' }}</p>
        <router-link to="/lab" class="btn"><AppIcon name="Flask" /> 辨識測試室（開發用）</router-link>
        <button class="btn ghost" @click="resetAll"><AppIcon name="Trash" /> 清除進度</button>
      </div>
    </template>
  </main>
</template>

<style scoped>.sel { min-height: var(--tap); border-radius: 14px; border: 2px solid var(--gray-200); font-size: var(--fs-h3); padding: 0 12px; width: 100%; }</style>
