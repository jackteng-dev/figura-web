<script setup lang="ts">
// 首頁主視覺輪播：預購批次與現貨商品交錯。
// 自動播放 6 秒一張；滑鼠移入、鍵盤聚焦、分頁隱藏時暫停；系統要求減少動態時不自動播放。
// 提供上一張／下一張、指示點、暫停按鈕（WCAG 2.2.2），手機可左右滑動。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProductCover from './ProductCover.vue'
import type { HeroSlide } from './useCatalog'
const props = defineProps<{ slides: HeroSlide[] }>()
const INTERVAL = 6000

const index = ref(0)
const playing = ref(true)        // 使用者按暫停後為 false
const hovering = ref(false)
const focused = ref(false)
const hidden = ref(false)
const reduced = ref(false)
const count = computed(() => props.slides.length)
const active = computed(() => playing.value && !hovering.value && !focused.value && !hidden.value && !reduced.value && count.value > 1)

watch(count, n => { if (index.value >= n) index.value = 0 })

function go(i: number) { if (count.value) index.value = (i + count.value) % count.value }
const next = () => go(index.value + 1)
const prev = () => go(index.value - 1)

let timer: number | undefined
function schedule() {
  window.clearTimeout(timer)
  if (active.value) timer = window.setTimeout(() => { next(); schedule() }, INTERVAL)
}
watch([active, index], schedule)

let mq: MediaQueryList | undefined
const onMq = () => { reduced.value = !!mq?.matches }
const onVis = () => { hidden.value = document.hidden }
onMounted(() => {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)'); onMq(); mq.addEventListener('change', onMq)
  document.addEventListener('visibilitychange', onVis)
  schedule()
})
onBeforeUnmount(() => {
  window.clearTimeout(timer); mq?.removeEventListener('change', onMq); document.removeEventListener('visibilitychange', onVis)
})

// 觸控滑動：水平位移超過 40px 才換張，避免影響垂直捲動與點擊。
let startX = 0, startY = 0, tracking = false
function onPointerDown(e: PointerEvent) { if (e.pointerType === 'mouse') return; tracking = true; startX = e.clientX; startY = e.clientY }
function onPointerUp(e: PointerEvent) {
  if (!tracking) return; tracking = false
  const dx = e.clientX - startX, dy = e.clientY - startY
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prev()
}
function onFocusOut(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) focused.value = false
}
</script>

<template>
  <section class="hero-carousel" aria-roledescription="carousel" aria-label="精選商品"
    @mouseenter="hovering = true" @mouseleave="hovering = false"
    @focusin="focused = true" @focusout="onFocusOut"
    @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="tracking = false">
    <div class="viewport">
      <div class="track" :style="{ transform: `translateX(-${index * 100}%)` }" :class="{ still: reduced }">
        <router-link v-for="(s, i) in slides" :key="s.key" :to="s.to" class="slide"
          role="group" aria-roledescription="slide" :aria-label="`${i + 1} / ${count}：${s.title}`"
          :aria-hidden="i !== index" :tabindex="i === index ? 0 : -1" draggable="false">
          <div class="copy">
            <span class="pill">{{ s.pill }}</span>
            <span class="title">{{ s.title }}</span>
            <span class="sub">{{ s.sub }}</span>
            <span class="price">{{ s.price }}</span>
            <span class="cta">{{ s.cta }}</span>
          </div>
          <div class="art">
            <div v-if="s.image" class="backdrop" :style="{ backgroundImage: `url(${s.image.url})` }" aria-hidden="true"></div>
            <ProductCover :image="s.image" :category="s.category" eager />
          </div>
        </router-link>
      </div>
    </div>

    <div v-if="count > 1" class="controls">
      <button type="button" class="nav" aria-label="上一張" @click="prev">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="dots">
        <button v-for="(s, i) in slides" :key="s.key" type="button" class="dot" :class="{ on: i === index }"
          :aria-label="`第 ${i + 1} 張：${s.title}`" :aria-current="i === index ? 'true' : undefined" @click="go(i)"></button>
      </div>
      <button type="button" class="nav" aria-label="下一張" @click="next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button v-if="!reduced" type="button" class="nav play" :aria-label="playing ? '暫停輪播' : '繼續輪播'" @click="playing = !playing">
        <svg v-if="playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l10 6-10 6z" /></svg>
      </button>
    </div>
    <div v-if="active" :key="index" class="progress" aria-hidden="true"><span :style="{ animationDuration: INTERVAL + 'ms' }"></span></div>
  </section>
</template>

<style scoped>
.hero-carousel { position: relative; flex: 2 1 520px; min-width: 0; min-height: 340px; background: #1b1f3b; border-radius: 16px; overflow: hidden; color: #fff; display: flex; flex-direction: column; }
.viewport { overflow: hidden; flex: 1; display: flex; }
.track { display: flex; width: 100%; transition: transform .55s cubic-bezier(.4, 0, .2, 1); }
.track.still { transition: none; }
.slide { flex: 0 0 100%; display: flex; flex-wrap: wrap; color: #fff !important; min-width: 0; user-select: none; -webkit-user-drag: none; }
.slide:focus-visible { outline: 3px solid #ffd23f; outline-offset: -3px; }
.copy { flex: 1 1 280px; padding: 32px 32px 72px; display: flex; flex-direction: column; gap: 12px; justify-content: center; min-width: 0; }
.pill { align-self: flex-start; background: #ffd23f; color: #15161a; font-weight: 900; font-size: 13px; padding: 5px 12px; border-radius: 999px; }
.title { font-size: clamp(24px, 3vw, 34px); font-weight: 900; line-height: 1.3; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sub { font-size: 15px; color: #c9cce0; overflow-wrap: anywhere; }
.price { font-size: 28px; font-weight: 900; color: #ffd23f; }
.cta { align-self: flex-start; background: #fff; color: #1b1f3b; font-weight: 700; padding: 12px 22px; border-radius: 10px; margin-top: 4px; }
.art { position: relative; flex: 1 1 240px; min-height: 240px; padding: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #2a2f57; }
.backdrop { position: absolute; inset: -20px; background-size: cover; background-position: center; filter: blur(24px) saturate(1.1); opacity: .45; }
.art :deep(.cover) { position: relative; background: rgba(255, 255, 255, .06); max-width: 380px; }
.controls { position: absolute; left: 32px; bottom: 18px; display: flex; align-items: center; gap: 8px; }
.nav { width: 36px; height: 36px; border-radius: 999px; border: 0; background: rgba(255, 255, 255, .14); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.nav:hover { background: rgba(255, 255, 255, .26); }
.nav:focus-visible, .dot:focus-visible { outline: 3px solid #ffd23f; outline-offset: 2px; }
.nav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.play svg path[d^="M8"] { fill: currentColor; stroke: none; }
.dots { display: flex; gap: 6px; padding: 0 4px; }
.dot { width: 10px; height: 10px; padding: 0; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .35); cursor: pointer; transition: width .25s, background .25s; }
.dot.on { width: 26px; background: #ffd23f; }
.progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255, 255, 255, .08); }
.progress span { display: block; height: 100%; background: #ffd23f; width: 0; animation: grow linear forwards; }
@keyframes grow { to { width: 100%; } }
@media (max-width: 768px) {
  .hero-carousel { min-height: 0; }
  .copy { padding: 22px 22px 12px; gap: 10px; }
  .art { min-height: 0; padding: 0 22px 64px; background: transparent; }
  .backdrop { display: none; }
  .art :deep(.cover) { aspect-ratio: 16 / 9; max-width: none; background: #2a2f57; }
  .controls { left: 22px; bottom: 14px; }
}
@media (prefers-reduced-motion: reduce) { .track, .dot { transition: none; } }
</style>
