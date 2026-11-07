<script setup lang="ts">
// 國字＋注音（直排在字的右邊，跟國小課本一樣）。設定裡可以關掉（大一點的孩子不需要）。
// 注音只是視覺輔助：螢幕閱讀器只念國字（aria-hidden）。
import { computed } from 'vue'
import { annotate, splitZhuyin } from '@/zhuyin'
import { useGame } from '@/stores/game'

const props = defineProps<{ text: string | number }>()
const game = useGame()
const on = computed(() => game.settings.zhuyin)
// 斷行單位：一個國字＋後面的收尾標點（，。！」）；開頭標點（「（）跟著下一個字。標點不會跑到行首。
const CLOSE = /[，。！？、：；」』）…—～]/
const OPEN = /[「『（]/
type Tok = { ch: string; zy: ReturnType<typeof splitZhuyin> | null }
// 注音欄的列：輕聲點一列（矮一點）＋每個符號一列
const rowsOf = (z: NonNullable<Tok['zy']>) => [...(z.light ? ['.5em'] : []), ...z.symbols.map(() => '1em')].join(' ')
const groups = computed(() => {
  const out: Tok[][] = []
  let pending: Tok[] = []
  for (const t of annotate(String(props.text))) {
    const tok: Tok = { ch: t.ch, zy: t.zy ? splitZhuyin(t.zy) : null }
    const last = out[out.length - 1]
    if (CLOSE.test(t.ch) && last && !pending.length) last.push(tok)
    else if (OPEN.test(t.ch)) pending.push(tok)
    else if (!tok.zy && !/\s/.test(t.ch) && last && !last.some((x) => x.zy) && !pending.length) last.push(tok) // 數字英文連在一起
    else { out.push([...pending, tok]); pending = [] }
  }
  if (pending.length) out.push(pending)
  return out
})
</script>

<template>
  <span v-if="!on">{{ text }}</span>
  <span v-else class="zy-line"><template v-for="(g, gi) in groups" :key="gi"><wbr v-if="gi" /><span class="zg"><template v-for="(t, i) in g" :key="i"><span v-if="t.zy" class="zc"><span class="zh">{{ t.ch }}</span><span class="zb" aria-hidden="true" :style="{ gridTemplateRows: rowsOf(t.zy) }"><span v-if="t.zy.light" class="zl">˙</span><span v-for="(s, k) in t.zy.symbols" :key="k" class="zs" :style="{ gridRow: k + 1 + (t.zy.light ? 1 : 0) }">{{ s }}</span><span v-if="t.zy.tone" class="zt" :style="{ gridRow: t.zy.symbols.length + (t.zy.light ? 1 : 0) }">{{ t.zy.tone }}</span></span></span><template v-else>{{ t.ch }}</template></template></span></template></span>
</template>

<style scoped>
.zy-line { font-family: var(--font-kai); }
.zg { white-space: nowrap; }
/* 每組之間放 <wbr>：WebKit（iOS 的 WebView）不會在 inline-flex 之間自己換行。
   一個字＝國字＋右邊直排的注音。用 baseline 對齊，國字跟旁邊的數字、標點在同一條線上 */
.zc { display: inline-flex; align-items: center; vertical-align: baseline; line-height: 1; }
.zh { display: inline-block; line-height: 1; }
/* 注音欄（國小課本的直式）：符號一列一個；聲調在最後一個符號的右上；輕聲點在最上面。
   兩欄固定寬度，每個字的間距都一樣，聲調不會壓到下一個字 */
.zb {
  display: inline-grid; grid-template-columns: 1em .42em; align-content: center;
  font-size: .4em; line-height: 1; margin: 0 .12em 0 .06em; font-weight: 500;
}
.zs, .zl { grid-column: 1; text-align: center; height: 1em; }
.zl { grid-row: 1; height: .5em; line-height: .5em; }
.zt { grid-column: 2; align-self: start; line-height: .9; margin-top: -.08em; }
</style>
