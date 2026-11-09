<script setup lang="ts">
import {ref,watch} from 'vue'
import type {ProductImage} from '@/api/catalog'
const props=defineProps<{image:ProductImage|null|undefined;category?:string}>(),failed=ref(false)
watch(()=>props.image?.id,()=>failed.value=false)
</script>
<template><div class="cover"><img v-if="image&&!failed" :src="image.url" :alt="image.alt" loading="lazy" @error="failed=true"><div v-else class="placeholder"><span>{{ category }}</span><strong>ELPSY</strong><small>{{ failed?'商品圖片暫時無法載入':'商品圖片尚未提供' }}</small></div></div></template>
<style scoped>.cover{background:#e3e7d9;border-radius:12px;overflow:hidden;aspect-ratio:4/3;width:100%}.cover img{display:block;width:100%;height:100%;object-fit:contain}.placeholder{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;color:#64735c}.placeholder strong{font:40px Georgia;letter-spacing:5px}.placeholder small{font-size:12px}</style>
