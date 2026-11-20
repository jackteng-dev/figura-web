<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {ProductImage} from '@/api/catalog'
import {imageTypeLabel,type GalleryImage} from '@/api/gallery'
import ProductCover from './ProductCover.vue'
const props=defineProps<{productId:string;image:ProductImage|null;category:string;images:GalleryImage[];error?:string}>()
const images=computed(()=>props.images),index=ref(0),dialog=ref<HTMLDialogElement>(),opener=ref<HTMLButtonElement>()
const current=computed(()=>images.value[index.value]||props.image)
const includesAi=computed(()=>[...images.value,props.image].some(image=>/AI\s*生成/.test(image?.alt||'')))
let startX=0,startY=0
watch(()=>[props.productId,props.images] as const,()=>{const primary=props.images.findIndex(i=>i.primary);index.value=Math.max(0,primary);dialog.value?.close()},{immediate:true})
function step(delta:number){if(images.value.length>1)index.value=(index.value+delta+images.value.length)%images.value.length}
function touchStart(e:TouchEvent){startX=e.changedTouches[0]!.clientX;startY=e.changedTouches[0]!.clientY}
function touchEnd(e:TouchEvent){const x=e.changedTouches[0]!.clientX-startX,y=e.changedTouches[0]!.clientY-startY;if(Math.abs(x)>50&&Math.abs(x)>Math.abs(y)*1.5)step(x<0?1:-1)}
function close(){dialog.value?.close();opener.value?.focus()}
</script>
<template>
 <section class="product-gallery" aria-label="商品展示圖片" @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
  <button ref="opener" class="expand" :disabled="!current" aria-label="放大商品圖片" @click="dialog?.showModal()" @touchstart.passive="touchStart" @touchend.passive="touchEnd"><ProductCover :image="current" :category="category" eager priority sizes="(max-width: 800px) 94vw, 560px"/><span v-if="current">點擊放大</span></button>
  <p v-if="error" class="gallery-note" role="status">{{error}} 目前仍可查看主圖。</p>
  <p v-if="includesAi" class="gallery-note">AI 生成示意圖，非實物攝影；此圖組不代表可操作的 3D 模型。</p>
  <div v-if="images.length>1" class="thumbnails" aria-label="選擇圖片">
   <button v-for="(image,i) in images" :key="image.id" :aria-label="`${imageTypeLabel[image.type]}，第 ${i+1} 張`" :aria-pressed="index===i" @click="index=i"><ProductCover :image="image" sizes="80px"/><small>{{imageTypeLabel[image.type]}}</small></button>
  </div>
  <p v-if="images.length>1" class="gallery-note" aria-live="polite">第 {{index+1}}／{{images.length}} 張 · 可使用左右方向鍵或滑動切換</p>
  <dialog ref="dialog" aria-label="放大商品圖片" @click="e=>{if(e.target===dialog)close()}" @close="opener?.focus()">
   <button class="close" autofocus @click="close">關閉放大圖片</button>
   <div @touchstart.passive="touchStart" @touchend.passive="touchEnd"><ProductCover :image="current" :category="category" eager sizes="90vw"/></div>
   <div v-if="images.length>1" class="dialog-controls"><button @click="step(-1)">上一張</button><span aria-live="polite">{{index+1}}／{{images.length}}</span><button @click="step(1)">下一張</button></div>
  </dialog>
 </section>
</template>
<style scoped>
.product-gallery{min-width:0}.expand{display:block;width:100%;padding:0;border:0;background:transparent;position:relative;cursor:zoom-in;touch-action:pan-y}.expand>span{position:absolute;right:12px;bottom:12px;background:#fffdf5e8;color:#172d4a;padding:5px 10px;border-radius:7px;font-size:12px}.thumbnails{display:flex;gap:10px;overflow-x:auto;padding:12px 2px}.thumbnails button{flex:0 0 86px;padding:4px;border:2px solid transparent;border-radius:10px;background:white;color:#263750}.thumbnails button[aria-pressed=true]{border-color:#e9a320}.thumbnails small{display:block;font-size:11px;margin-top:5px}.gallery-note{font-size:12px;color:#667085;margin:8px 0}.product-gallery button:focus-visible{outline:3px solid #efb83f;outline-offset:3px}dialog{width:min(94vw,960px);max-height:94dvh;overflow:auto;padding:16px;border:0;border-radius:14px;background:#fff;box-sizing:border-box}dialog::backdrop{background:#0b1425d9}dialog :deep(.cover){max-height:76dvh;aspect-ratio:1;max-width:76dvh;margin:auto}dialog :deep(img){object-fit:contain}.close{display:block;margin:0 0 12px auto}.dialog-controls{display:flex;justify-content:space-between;align-items:center;margin-top:12px}.dialog-controls button,.close{border:1px solid #c4cbd5;border-radius:6px;background:#fff;padding:9px 15px;color:#172d4a}
</style>
