<script setup lang="ts">
// 11 清運大作戰（OR③ 帶時間窗的路線最佳化）。
// 地圖上是「你家那班垃圾車」真實會停的 8–10 個點（取這班車經過你家附近的那一段）。
// 孩子依序點停靠點；在時間窗內到達變綠、太晚變紅；全部綠色才過關，路程越短星星越多。
// 過關後比較三條路線：孩子的、最佳解、清潔隊真實的排程。時間窗已等比例放寬，標明「遊戲時間」。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import L from 'leaflet'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import { loadStops } from '@/domain/stops'
import type { Stop } from '@/domain/types'
import { useGame } from '@/stores/game'
import { hhmm, tripStops } from '@/solvers/geo'
import { evaluate, solve, type RouteEval, type TwInput } from '@/solvers/tsptw'

const game = useGame()
const el = ref<HTMLDivElement>()
const map = shallowRef<L.Map>()
const stops = ref<Stop[]>([])
const mock = ref(false)
const order = ref<number[]>([])
const input = shallowRef<TwInput>()
const best = shallowRef<RouteEval | null>(null)
const error = ref('')
let layer: L.LayerGroup | null = null

const GAME_SPEED = 300 // 公尺／分鐘（遊戲車速）
const evalNow = computed(() => (input.value ? evaluate(input.value, order.value) : null))
const finished = computed(() => input.value && order.value.length === input.value.stops.length)
const real = computed(() => (input.value ? evaluate(input.value, input.value.stops.map((_, i) => i)) : null))
const star = computed(() => {
  const e = evalNow.value
  if (!finished.value || !e?.feasible || !best.value) return 0
  const r = best.value.distance / e.distance
  return r >= 0.98 ? 3 : r >= 0.85 ? 2 : 1
})
const clock = computed(() => (evalNow.value && order.value.length ? hhmm(evalNow.value.finish) : input.value ? hhmm(input.value.t0) : '--:--'))

onMounted(async () => {
  try {
    const district = game.settings.li?.district ?? '士林區'
    const data = await loadStops(district)
    mock.value = data.mock
    const my = game.settings.myTrip
    const first = data.stops[0]
    const trip = tripStops(data.stops, my?.route ?? first.route, my?.trip ?? first.trip)
    const n = Math.min(trip.length, 8 + Math.min(2, Math.floor(game.level / 4)))
    const center = Math.max(0, trip.findIndex((s) => s.id === my?.stopId))
    const from = Math.max(0, Math.min(trip.length - n, center - Math.floor(n / 2)))
    stops.value = trip.slice(from, from + n)
    const s0 = stops.value[0]
    input.value = {
      start: { lat: s0.lat - 0.0012, lng: s0.lng - 0.0012 },
      t0: s0.arrive - 5,
      speed: GAME_SPEED,
      stops: stops.value.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, e: s.arrive - 2, l: s.leave + 4, s: 1 })),
    }
    best.value = solve(input.value)
    draw()
  } catch (e) {
    error.value = String((e as Error).message ?? e)
  }
})
onBeforeUnmount(() => map.value?.remove())

function icon(i: number) {
  const pos = order.value.indexOf(i)
  const st = pos < 0 ? 'todo' : evalNow.value?.onTime[pos] ? 'ok' : 'late'
  const s = stops.value[i]
  return L.divIcon({
    className: '',
    html: `<div class="pin ${st}"><b>${pos < 0 ? '?' : pos + 1}</b><small>${hhmm(s.arrive - 2)}–${hhmm(s.leave + 4)}</small></div>`,
    iconSize: [72, 44],
    iconAnchor: [36, 44],
  })
}
function draw() {
  if (!el.value || !input.value) return
  if (!map.value) {
    map.value = L.map(el.value, { zoomControl: false, attributionControl: true })
    // OpenStreetMap 官方圖磚：Demo 可用；正式上線改用市府或自架圖磚（見 TODO）
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map.value)
    map.value.fitBounds(L.latLngBounds(stops.value.map((s) => [s.lat, s.lng] as [number, number])).pad(0.25))
  }
  layer?.remove()
  layer = L.layerGroup().addTo(map.value)
  const start = input.value.start
  const pts = (ord: number[]) => [[start.lat, start.lng], ...ord.map((i) => [stops.value[i].lat, stops.value[i].lng])] as [number, number][]
  if (finished.value && best.value && real.value) {
    L.polyline(pts(real.value.order), { color: '#738995', weight: 4, dashArray: '6 8' }).addTo(layer)
    L.polyline(pts(best.value.order), { color: '#5AB4C5', weight: 6, opacity: 0.8 }).addTo(layer)
  }
  if (order.value.length) L.polyline(pts(order.value), { color: '#FD853A', weight: 4 }).addTo(layer)
  const last = order.value.length ? stops.value[order.value[order.value.length - 1]] : start
  L.marker([last.lat, last.lng], { icon: L.divIcon({ className: '', html: '<div class="truck">🚛</div>', iconSize: [40, 40], iconAnchor: [20, 30] }), interactive: false }).addTo(layer)
  stops.value.forEach((s, i) => {
    const m = L.marker([s.lat, s.lng], { icon: icon(i), title: `${s.name} ${hhmm(s.arrive)}`, keyboard: true }).addTo(layer!)
    m.on('click', () => tap(i))
  })
}
function tap(i: number) {
  if (order.value.includes(i) || finished.value) return
  order.value = [...order.value, i]
  draw()
  if (finished.value && evalNow.value?.feasible) {
    game.emit('route_cleared')
    if (star.value === 3) game.emit('route_three_star')
  }
}
function reset() { order.value = []; draw() }
const lateNow = computed(() => evalNow.value?.onTime.some((x) => !x))
const km = (m?: number) => (m == null ? '-' : (m / 1000).toFixed(2))
</script>

<template>
  <main class="page stack">
    <TopBar title="準時收完！" back="/">
      <span class="clock" aria-label="遊戲時間">⏰ {{ clock }}</span>
    </TopBar>
    <p v-if="error" class="card">{{ error }}</p>
    <div ref="el" class="map" role="application" aria-label="清運地圖：依序點選停靠點"></div>
    <ol class="stoplist" aria-label="停靠點（也可以從這裡點）">
      <li v-for="(s, i) in stops" :key="s.id">
        <button class="btn" :disabled="order.includes(i) || !!finished" @click="tap(i)">
          {{ order.includes(i) ? order.indexOf(i) + 1 : '·' }} {{ s.name }} <small>{{ hhmm(s.arrive - 2) }}–{{ hhmm(s.leave + 4) }}</small>
        </button>
      </li>
    </ol>
    <Mascot v-if="lateNow && !finished" mood="oops" :size="44" line="垃圾車怎麼還沒來？" />
    <template v-if="finished">
      <div class="card center stack">
        <p class="stars">{{ evalNow?.feasible ? '⭐'.repeat(star) + '☆'.repeat(3 - star) : '有一站太晚了' }}</p>
        <p class="muted">🟠 你的 {{ km(evalNow?.distance) }} km ・ 🔵 最佳 {{ km(best?.distance) }} km ・ ⚪ 清潔隊排程 {{ km(real?.distance) }} km</p>
        <p class="caption">遊戲用直線距離計算，最佳解比較短不代表清潔隊排錯</p>
      </div>
    </template>
    <div class="grid2">
      <button class="btn" @click="reset">🔄 重來</button>
      <router-link to="/tonight" class="btn primary">🌙 今晚任務</router-link>
    </div>
    <p class="caption center">
      時間是遊戲時間（已放寬），不是垃圾車即時位置。
      <template v-if="mock">⚠️ 目前是模擬停靠點。</template>
      資料：臺北市垃圾車點位路線資訊（data.taipei）
    </p>
  </main>
</template>

<style scoped>
.map { height: 360px; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
.clock { font-weight: 800; font-size: var(--fs-title); background: var(--white); border-radius: 999px; padding: 6px 12px; }
.stars { font-size: 2rem; margin: 0; }
.stoplist { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; overflow-x: auto; }
.stoplist .btn { white-space: nowrap; font-size: var(--fs-body); }
:deep(.pin) { display: flex; flex-direction: column; align-items: center; background: var(--white); border: 3px solid var(--gray-300); border-radius: 12px; padding: 2px 4px; font-size: 12px; box-shadow: var(--shadow); }
:deep(.pin b) { font-size: 15px; }
:deep(.pin.ok) { border-color: #3E9B4F; background: #E6F6E8; }
:deep(.pin.late) { border-color: var(--red-500); background: #FAEEEE; }
:deep(.truck) { font-size: 30px; }
</style>
