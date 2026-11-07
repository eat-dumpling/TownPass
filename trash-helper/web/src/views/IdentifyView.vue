<script setup lang="ts">
// 第一步：怎麼告訴我們是什麼——相機、照片、或從清單選。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import { items } from '~/lib/rules'
import { INPUT_SIZE, recognize } from '@/vision/clip'
import { salientBox } from '@/vision/saliency'
import { squareCrop } from '@/vision/detector'

const { t } = useI18n()
const router = useRouter()
const fileIn = ref<HTMLInputElement>()
const busy = ref(false)

// 上傳照片：先找出畫面中的主要物品（顯著物體框），裁切後交給手機上的 CLIP；照片不上傳、不保存
async function fromFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  busy.value = true
  try {
    const bmp = await createImageBitmap(f)
    const c = document.createElement('canvas')
    const s = Math.min(1, 900 / Math.max(bmp.width, bmp.height))
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const box = salientBox(c, c.width, c.height) ?? { x: 0, y: 0, w: c.width, h: c.height }
    const r = squareCrop(box, c.width, c.height, box.w === c.width ? 0 : 0.12)
    const crop = document.createElement('canvas')
    crop.width = crop.height = INPUT_SIZE
    crop.getContext('2d')!.drawImage(c, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
    const res = await recognize(crop, items())
    const nothing = (res.negative?.p ?? 0) > (res.top[0]?.p ?? 0)
    if (!res.top[0] || nothing || res.top[0].p < 0.12) router.push('/browse')
    else router.push({ path: `/item/${res.top[0].item.id}`, query: { alt: res.top.slice(1, 4).map((x) => x.item.id).join(',') } })
  } catch (err) {
    console.warn(err)
    router.push('/browse')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('id_title')" back="/" />
    <router-link to="/scan" class="choice">
      <span class="ic" style="background: var(--primary-500)"><AppIcon name="Camera" :size="32" /></span>
      <span><b>{{ t('id_camera') }}</b></span>
    </router-link>
    <button class="choice" :disabled="busy" @click="fileIn?.click()">
      <span class="ic" style="background: var(--primary-700)"><AppIcon name="Photo" :size="32" /></span>
      <span><b>{{ busy ? t('scan_looking') : t('id_photo') }}</b></span>
    </button>
    <input ref="fileIn" class="sr-only" type="file" accept="image/*" @change="fromFile" />
    <router-link to="/browse" class="choice">
      <span class="ic" style="background: var(--secondary-600)"><AppIcon name="LayoutGrid" :size="32" /></span>
      <span><b>{{ t('id_browse') }}</b></span>
    </router-link>
  </main>
</template>
