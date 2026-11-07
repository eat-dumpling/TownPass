// 影像模型（CLIP 或 SigLIP）放在 Web Worker 跑：推論不會卡住相機畫面與框的動畫。
// 網頁 ↔ worker：{ type: 'init', base, allowRemote, model, vision, visionOut } → { type: 'ready', threads }
//                { type: 'embed', id, data, width, height } → { type: 'vec', id, vec } 或 { type: 'error', id, message }
import { AutoImageProcessor, CLIPVisionModelWithProjection, RawImage, SiglipVisionModel, env } from '@huggingface/transformers'

type Processor = (img: unknown) => Promise<Record<string, unknown>>
type Model = (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>
const VISION = { CLIPVisionModelWithProjection, SiglipVisionModel }
let ready: Promise<{ processor: Processor; model: Model; out: string }> | null = null

const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  if (m.type === 'init') {
    ready ??= (async () => {
      env.allowLocalModels = true
      env.localModelPath = new URL('models/', m.base).href
      env.allowRemoteModels = !!m.allowRemote
      env.useBrowserCache = true
      const wasm = env.backends.onnx.wasm
      if (wasm) {
        wasm.wasmPaths = new URL('ort/', m.base).href
        // 實測：在 Worker 裡開多執行緒（numThreads > 1）會卡在建立模型，所以固定單執行緒（約 0.5 秒／張）
        wasm.numThreads = m.threads ?? 1
      }
      const id: string = m.model ?? 'Xenova/clip-vit-base-patch32'
      const Vision = VISION[(m.vision ?? 'CLIPVisionModelWithProjection') as keyof typeof VISION]
      const processor = (await AutoImageProcessor.from_pretrained(id)) as unknown as Processor
      // q8 在 WebGPU 上輸出壞掉（實測），固定 WASM
      const model = (await Vision.from_pretrained(id, {
        dtype: 'q8', device: 'wasm',
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === 'progress' && p.progress != null) post({ type: 'progress', pct: p.progress })
        },
      })) as unknown as Model
      return { processor, model, out: m.visionOut ?? 'image_embeds' }
    })()
    try {
      await ready
      post({ type: 'ready', threads: env.backends.onnx.wasm?.numThreads ?? 1 })
    } catch (err) {
      ready = null
      post({ type: 'error', id: -1, message: String((err as Error)?.message ?? err) })
    }
    return
  }
  if (m.type === 'embed') {
    try {
      const { processor, model, out } = await ready!
      const image = new RawImage(new Uint8ClampedArray(m.data), m.width, m.height, 4).rgb()
      const vec = new Float32Array((await model(await processor(image)))[out].data)
      post({ type: 'vec', id: m.id, vec }, [vec.buffer])
    } catch (err) {
      post({ type: 'error', id: m.id, message: String((err as Error)?.message ?? err) })
    }
  }
}
