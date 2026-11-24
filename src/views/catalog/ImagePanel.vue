<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {useUserInfoStore} from '@/stores/userInfo'
import {catalogError,type AdminProduct} from '@/api/catalog'
import {galleryDetail,uploadGallery,commandGallery,imageTypeLabel,type GalleryDetail,type GalleryUpload,type GalleryCommand,type ImageType} from '@/api/gallery'
import {getUserInfoService} from '@/api/user'
import ProductCover from '@/views/shop/ProductCover.vue'
const props=defineProps<{product:AdminProduct;canEdit:boolean;disabled:boolean;refresh:()=>Promise<void>}>(),emit=defineEmits<{locked:[value:boolean]}>(),user=useUserInfoStore()
interface Draft {file:File;url:string;alt:string;type:ImageType;imageId?:string}
type Pending={actorId:number;kind:'upload';input:GalleryUpload;draft:Draft}|{actorId:number;kind:'command';input:GalleryCommand}
const detail=ref<GalleryDetail>(),drafts=ref<Draft[]>([]),pending=ref<Pending>(),busy=ref(false),error=ref(''),notice=ref(''),needsReload=ref(false),input=ref<HTMLInputElement>(),replaceTarget=ref<string>()
const has=(code:string)=>user.permissions.some(p=>p.code===code)
const editable=computed(()=>!props.disabled&&!busy.value&&!pending.value&&!needsReload.value&&props.canEdit&&detail.value?.enabled&&detail.value.status==='DRAFT')
function locked(){emit('locked',!!pending.value||needsReload.value)}
function discard(){for(const d of drafts.value)URL.revokeObjectURL(d.url);drafts.value=[];replaceTarget.value=undefined;if(input.value)input.value.value=''}
onBeforeUnmount(discard)
function pick(e:Event){
 const files=Array.from((e.target as HTMLInputElement).files||[]);error.value=''
 if(!files.length)return
 if(files.some(f=>!['image/png','image/jpeg'].includes(f.type)||!f.size||f.size>5242880)){error.value='請選擇5MB以內的 PNG／JPEG 圖片。';return}
 if(replaceTarget.value&&files.length!==1){error.value='替換時請只選一張圖片。';return}
 if(!replaceTarget.value&&files.length+(detail.value?.images.length||0)>6){error.value='每件商品最多六張圖片。';return}
 const target=replaceTarget.value;discard()
 drafts.value=files.map(file=>({file,url:URL.createObjectURL(file),alt:'',type:'DETAIL',imageId:target}))
}
function chooseReplace(id:string){if(!editable.value)return;discard();replaceTarget.value=id;input.value?.click()}
async function load(){
 if(busy.value||props.disabled)return;busy.value=true;error.value=''
 try{detail.value=await galleryDetail(props.product.id);await props.refresh();needsReload.value=false}
 catch(e){needsReload.value=true;error.value=catalogError(e)}
 finally{busy.value=false;locked()}
}
async function send(){
 if(!pending.value||busy.value||props.disabled||needsReload.value)return
 busy.value=true;locked();error.value='';let acknowledged=false
 try{
  const op=pending.value
  const me=await getUserInfoService()
  if(Number(me.data.id)!==op.actorId){error.value='登入員工已變更，請原員工重新登入後核對原操作。';return}
  const result=op.kind==='upload'?await uploadGallery(props.product.id,op.input,op.draft.file):await commandGallery(props.product.id,op.input)
  acknowledged=true;pending.value=undefined;detail.value=result.current
  if(op.kind==='upload'){URL.revokeObjectURL(op.draft.url);drafts.value=drafts.value.filter(d=>d!==op.draft)}
  notice.value=result.replayed?'已核對原圖片操作，沒有重複新增。':'商品圖組已更新。'
  await props.refresh();detail.value=await galleryDetail(props.product.id)
 }catch(e:any){
  if(acknowledged){needsReload.value=true;error.value='圖片操作已確認，讀取失敗，請重新核對；不會再次送出。'}
  else if(String(e.response?.data?.message||'').includes('登入員工已變更')){error.value='登入員工已變更，請原員工重新登入後核對原操作。'}
  else if([400,403,404,409,413].includes(e.response?.status)){pending.value=undefined;needsReload.value=true;error.value=catalogError(e)}
  else{error.value='圖片操作回應未確認，請保留此頁並重試同一操作。'}
 }finally{busy.value=false;locked()}
}
async function uploadAll(){
 if(!editable.value||!drafts.value.length||drafts.value.some(d=>!d.alt.trim())||!user.info?.id)return
 const actorId=user.info.id
 while(drafts.value.length){
  const d=drafts.value[0]!
  pending.value={actorId,kind:'upload',draft:d,input:{requestId:crypto.randomUUID(),expectedVersion:detail.value!.version,expectedActorId:actorId,operation:d.imageId?'REPLACE':'ADD',...(d.imageId?{imageId:d.imageId}:{}),type:d.type,alt:d.alt.trim()}}
  await send()
  if(pending.value||needsReload.value||error.value)break
 }
}
async function command(action:GalleryCommand['action'],imageId?:string,imageIds?:string[]){
 if(!editable.value||!user.info?.id)return
 if(action==='REMOVE'&&!window.confirm('移除此圖片？歷史操作仍會保留。'))return
 pending.value={actorId:user.info.id,kind:'command',input:{requestId:crypto.randomUUID(),expectedVersion:detail.value!.version,expectedActorId:user.info.id,action,...(imageId?{imageId}:{}),...(imageIds?{imageIds}:{})}}
 await send()
}
function move(index:number,delta:number){const ids=detail.value!.images.map(i=>i.id);const target=index+delta;if(target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target]!,ids[index]!];command('REORDER',undefined,ids)}
watch(()=>props.disabled,value=>{if(!value&&!detail.value&&!busy.value)load()})
onMounted(load)
</script>
<template>
 <section class="image-panel" data-testid="image-panel"><h3>商品圖片</h3>
  <p>每件最多六張；PNG／JPEG、每張5MB、每邊4096像素。只能在草稿管理圖片；上傳時產生較小尺寸。主圖沿用商品列表與 App。</p>
  <p v-if="error" role="alert" class="alert alert-danger">{{error}}</p><p v-if="notice" role="status" class="alert alert-success">{{notice}}</p>
  <button class="btn btn-outline-primary" :disabled="busy||disabled" @click="load">核對圖片</button>
  <button v-if="pending" class="btn btn-primary" :disabled="busy||disabled||needsReload" @click="send">重試同一圖片操作</button>
  <p v-if="pending">尚未確認操作結果，請保留此頁；重新整理後先核對圖組與紀錄。</p>
  <p v-if="detail&&!detail.enabled">此環境未啟用圖片儲存。</p><p v-if="!canEdit&&product.status==='DRAFT'">請先儲存或重新載入商品表單，再管理圖片。</p>
  <div class="image-grid gallery-assets"><article v-for="(image,i) in detail?.images" :key="image.id">
   <ProductCover :image="image" sizes="(max-width: 600px) 42vw, 240px"/><p><b>{{image.primary?'主圖 · ':''}}{{imageTypeLabel[image.type]}}</b><br>{{image.alt}}</p>
   <template v-if="has('catalog.images.upload')"><button :disabled="!editable||image.primary" @click="command('COVER',image.id)">設為主圖</button><button :disabled="!editable" @click="chooseReplace(image.id)">替換圖片</button><button :disabled="!editable||i===0" :aria-label="`將第 ${i+1} 張向前移`" @click="move(i,-1)">向前</button><button :disabled="!editable||i===detail!.images.length-1" :aria-label="`將第 ${i+1} 張向後移`" @click="move(i,1)">向後</button></template>
   <button v-if="has('catalog.images.remove')" :disabled="!editable" @click="command('REMOVE',image.id)">移除圖片</button>
  </article></div>
  <div v-if="has('catalog.images.upload')"><label for="product-image-file">選擇商品圖片（可多選；每張填寫替代文字）</label><input id="product-image-file" ref="input" type="file" multiple accept="image/png,image/jpeg" :disabled="!editable" @change="pick" @cancel="replaceTarget=undefined"><p v-if="replaceTarget">正在選擇替換圖片，可按「清除待上傳」取消。</p>
   <div class="image-grid draft-images"><article v-for="(draft,i) in drafts" :key="draft.url"><img :src="draft.url" alt="待上傳預覽" width="240" height="240"><p>{{draft.imageId?'替換圖片':'新增圖片'}}</p><label :for="`image-alt-${i}`">圖片替代文字</label><input :id="`image-alt-${i}`" v-model="draft.alt" maxlength="160" :disabled="!editable"><label :for="`image-type-${i}`">圖片類型</label><select :id="`image-type-${i}`" v-model="draft.type" :disabled="!editable"><option v-for="(label,value) in imageTypeLabel" :key="value" :value="value">{{label}}</option></select></article></div>
   <button class="btn btn-primary" :disabled="!editable||!drafts.length||drafts.some(d=>!d.alt.trim())" @click="uploadAll">上傳商品圖片</button><button :disabled="!editable||(!drafts.length&&!replaceTarget)" @click="discard">清除待上傳</button>
  </div>
  <ol><li v-for="e in detail?.events" :key="e.requestId">{{e.action}} · {{e.actorUsername}} · 版本 {{e.beforeVersion}} → {{e.afterVersion}}<small>{{e.requestId}}</small></li></ol>
 </section>
</template>
<style scoped>
.image-panel{margin-top:28px;border-top:1px solid #e3e5ec;padding-top:8px;overflow-wrap:anywhere}.image-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:16px 0}.image-grid article{max-width:320px;min-width:0;border:1px solid #dce1e8;border-radius:10px;padding:10px}.image-grid img{width:100%;height:auto;aspect-ratio:1;object-fit:contain}.image-panel label{display:block;margin:10px 0 6px}.image-panel input,.image-panel select{width:100%;max-width:100%;box-sizing:border-box}.image-panel button{margin:6px 6px 6px 0;border-radius:6px}.image-panel small{display:block;margin-top:5px}.image-panel li{margin-top:12px}.image-panel ol{padding-left:20px}
</style>
