<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import InventoryPanel from './InventoryPanel.vue'
import ImagePanel from './ImagePanel.vue'
const imageLocked=ref(false)
const imageClean=computed(()=>!!selected.value&&!!form.value&&JSON.stringify(form.value)===JSON.stringify(productWrite(selected.value)))
import { adminProducts, adminProduct, saveProduct, publishProduct, archiveProduct, catalogError, money, type AdminProduct, type ProductWrite, type Page, productWrite } from '@/api/catalog'
import { masterOptions, type Master } from '@/api/masters'
const brands=ref<Master[]>([]),categories=ref<Master[]>([]),works=ref<Master[]>([])
async function options(){[brands.value,categories.value,works.value]=await Promise.all([masterOptions('BRAND'),masterOptions('CATEGORY'),masterOptions('WORK')])}
const user = useUserInfoStore(), result = ref<Page<AdminProduct>>(), selected = ref<AdminProduct>(), form = ref<ProductWrite>(), page = ref(1), busy = ref(false), error = ref(''), notice = ref('')
const has = (code: string) => user.permissions.some(p => p.code === code)
const canSave = computed(() => selected.value ? has('catalog.write.update') : has('catalog.write.create'))
const canPublish = computed(() => has('catalog.publish'))
const editable = computed(() => !selected.value || selected.value.status === 'DRAFT')
const statusLabel = (status: string) => ({ DRAFT: '草稿', PUBLISHED: '已上架', ARCHIVED: '已封存' }[status] || status)
function choose(product: AdminProduct) { selected.value = product; form.value = productWrite(product) }
function create() { selected.value = undefined; form.value = { title: '', brand: '', category: '', description: '', brandId:'',categoryId:'',workId:null,expectedVersion: 0, skus: [{ code: '', label: '', priceTwd: 1, enabled: true }] }; error.value = ''; notice.value = '' }
async function load(next = page.value) { result.value = await adminProducts(next); page.value = next }
async function action(run: () => Promise<void>) { busy.value = true; error.value = ''; notice.value = ''; try { await run() } catch (e) { error.value = catalogError(e) } finally { busy.value = false } }
async function open(product: AdminProduct) { await action(async () => choose(await adminProduct(product.id))) }
async function save() { if (!form.value || !canSave.value) return; await action(async () => { choose(await saveProduct(selected.value?.id, form.value!)); await load(1); notice.value = '商品草稿已儲存。' }) }
async function publish(published: boolean) { if (!selected.value) return; await action(async () => { choose(await publishProduct(selected.value!, published)); await load(); notice.value = published ? '商品已上架，顧客現在可瀏覽。' : '商品已下架。' }) }
async function archive() { if (!selected.value || !window.confirm('封存後無法再編輯或上架，確認封存此商品？')) return; await action(async () => { await archiveProduct(selected.value!); selected.value = undefined; form.value = undefined; await load(); notice.value = '商品已封存，SKU 識別資料保留。' }) }
async function reloadImages(){busy.value=true;try{await load();if(selected.value)choose(await adminProduct(selected.value.id))}finally{busy.value=false}}
async function reload() { await action(async () => { await options(); await load(); if (selected.value) choose(await adminProduct(selected.value.id)) }) }
onMounted(() => action(async () => {await options();await load()}))
</script>
<template>
  <div class="catalog-admin"><div class="catalog-heading"><div><h1>商品管理</h1><p>建立草稿與款式，再由具上架權限的店長發布。金額為新台幣整數元。</p></div><button v-if="has('catalog.write.create')" class="btn btn-primary" :disabled="busy||imageLocked" @click="create">新增商品</button></div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }} <button class="btn btn-outline-dark btn-sm" :disabled="busy||imageLocked" @click="reload">重新載入商品</button><p class="mb-0 mt-2">重新載入會以伺服器資料取代目前表單。</p></div>
    <p v-if="notice" class="alert alert-success" role="status">{{ notice }}</p>
    <div class="catalog-workspace"><section class="card"><div class="card-body"><h2>商品列表</h2><p v-if="!result" role="status">載入中…</p><p v-else-if="!result.items.length">尚未建立商品。</p>
      <button v-for="product in result?.items" :key="product.id" class="product-row" :class="{ on: selected?.id === product.id }" :disabled="busy||imageLocked" @click="open(product)"><span><strong>{{ product.title }}</strong><small>{{ product.brand }} · {{ product.category }}</small></span><span class="row-status"><span class="status-pill" :class="'s-' + product.status">{{ statusLabel(product.status) }}</span><small>版本 {{ product.version }}</small></span></button>
      <div v-if="result && result.total > result.pageSize" class="admin-pagination"><button class="btn btn-outline-primary" :disabled="busy||imageLocked || page === 1" @click="action(() => load(page-1))">上一頁</button><span>第 {{ page }} 頁</span><button class="btn btn-outline-primary" :disabled="busy||imageLocked || page*result.pageSize >= result.total" @click="action(() => load(page+1))">下一頁</button></div>
    </div></section>
    <section class="card"><div class="card-body"><h2>{{ selected ? '商品詳情' : form ? '新增商品草稿' : '選擇商品開始管理' }}</h2><template v-if="form">
      <p v-if="selected">{{ statusLabel(selected.status) }} · 版本 {{ selected.version }} <router-link v-if="selected.status === 'PUBLISHED'" :to="'/shop/products/' + selected.id">查看公開頁面 →</router-link></p>
      <p v-if="!editable">{{ selected?.status === 'PUBLISHED' ? '需先下架才能修改商品內容與 SKU。' : '此商品已封存，保留資料供查核。' }}</p>
      <form @submit.prevent="save"><fieldset :disabled="busy||imageLocked || !editable || !canSave"><label for="product-title">商品名稱</label><input id="product-title" v-model="form.title" class="form-control" required maxlength="120"><div class="metadata-grid"><div><label for="product-brand">品牌</label><select id="product-brand" v-model="form.brandId" class="form-control" required><option value="" disabled>選擇品牌</option><option v-for="m in brands" :key="m.id" :value="m.id" :disabled="!m.enabled&&m.id!==selected?.brandId">{{m.name}}{{m.enabled?'':'（停用）'}}</option></select></div><div><label for="product-category">分類</label><select id="product-category" v-model="form.categoryId" class="form-control" required><option value="" disabled>選擇分類</option><option v-for="m in categories" :key="m.id" :value="m.id" :disabled="!m.enabled&&m.id!==selected?.categoryId">{{m.name}}{{m.enabled?'':'（停用）'}}</option></select></div></div><label for="product-work">作品（選填）</label><select id="product-work" v-model="form.workId" class="form-control"><option :value="null">未指定作品</option><option v-for="m in works" :key="m.id" :value="m.id" :disabled="!m.enabled&&m.id!==selected?.workId">{{m.name}}{{m.enabled?'':'（停用）'}}</option></select><p>停用主檔可保留既有草稿關聯；重新上架前必須更換或啟用。</p><label for="product-description">商品說明</label><textarea id="product-description" v-model="form.description" class="form-control" rows="5" required maxlength="8000" />
      <h3>SKU 款式</h3><p>既有 SKU 編碼不可變更或刪除；不販售的款式請停用。</p><section v-for="(sku,index) in form.skus" :key="sku.id || index" class="sku-editor"><label :for="'sku-code-' + index">SKU 編碼 {{ index+1 }}</label><input :id="'sku-code-' + index" v-model="sku.code" class="form-control" required maxlength="64" pattern="[A-Za-z0-9_-]+" :readonly="!!sku.id"><label :for="'sku-label-' + index">款式名稱 {{ index+1 }}</label><input :id="'sku-label-' + index" v-model="sku.label" class="form-control" required maxlength="80"><label :for="'sku-price-' + index">價格（TWD）{{ index+1 }}</label><input :id="'sku-price-' + index" v-model.number="sku.priceTwd" type="number" class="form-control" min="1" max="99999999" step="1" required><label class="sku-enabled"><input v-model="sku.enabled" type="checkbox"> 啟用此款式 · {{ money(sku.priceTwd || 0) }}</label><button v-if="!sku.id && form.skus.length > 1" type="button" class="btn btn-outline-danger btn-sm" @click="form.skus.splice(index,1)">移除未儲存款式</button></section>
      <button v-if="form.skus.length < 50" type="button" class="btn btn-outline-primary" @click="form.skus.push({ code: '',label: '',priceTwd: 1,enabled: true })">新增 SKU</button><button class="btn btn-primary ms-2" type="submit">{{ busy ? '處理中…' : '儲存草稿' }}</button></fieldset></form>
      <div v-if="selected" class="publication-actions"><button v-if="canPublish && selected.status !== 'ARCHIVED'" class="btn btn-success" :disabled="busy||imageLocked" @click="publish(selected.status !== 'PUBLISHED')">{{ selected.status === 'PUBLISHED' ? '下架商品' : '上架商品' }}</button><p v-else-if="!canPublish">目前帳號沒有上架／下架權限。</p><button v-if="has('catalog.write.archive') && selected.status === 'DRAFT'" class="btn btn-outline-danger" :disabled="busy||imageLocked" @click="archive">封存商品</button></div>
      <ImagePanel v-if="selected&&has('catalog.images.read')" :key="selected.id" :product="selected" :can-edit="editable&&imageClean" :disabled="busy" :refresh="reloadImages" @locked="imageLocked=$event" />
      <InventoryPanel v-if="selected && has('inventory.read')" :key="selected.id" :product-id="selected.id" :skus="selected.skus" :archived="selected.status === 'ARCHIVED'" />
    </template></div></section></div>
  </div>
</template>
<style scoped>
.catalog-admin { max-width:1400px; }.catalog-heading { display:flex;justify-content:space-between;align-items:start;gap:20px;margin-bottom:24px; }.catalog-heading h1 { font-size:28px; }.catalog-heading p { max-width:680px; }.catalog-workspace { display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:24px; }.catalog-workspace h2 { font-size:20px;margin-bottom:20px; }.catalog-workspace h3 { font-size:18px;margin:24px 0 12px; }.product-row { width:100%;border:0;border-bottom:1px solid #eceef4;background:white;padding:16px 0;text-align:left;display:flex;justify-content:space-between;gap:20px;overflow-wrap:anywhere; }.product-row small { display:block;font-size:12px;color:#4b5060;margin-top:6px; }.catalog-admin label { display:block;margin:16px 0 8px; }.metadata-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }.sku-editor { padding:0 16px 16px;border:1px solid #e3e5ec;border-radius:6px;margin-bottom:16px; }.sku-editor .sku-enabled { display:flex;gap:8px;align-items:center; }.publication-actions { display:flex;flex-wrap:wrap;gap:16px;margin-top:28px;border-top:1px solid #e3e5ec;padding-top:20px; }.admin-pagination { display:flex;align-items:center;justify-content:space-between;margin-top:20px; }.catalog-admin input,textarea { min-width:0; }@media(max-width:950px) { .catalog-workspace { grid-template-columns:1fr; } }@media(max-width:500px) { .catalog-heading { flex-direction:column; }.metadata-grid { grid-template-columns:1fr; } }
/* 新版後台：列表選取狀態與狀態標籤 */
.product-row { padding: 12px 10px !important; border-radius: 10px; border-bottom: 1px solid #eceef4; cursor: pointer; align-items: center; }
.product-row:hover:not(:disabled) { background: #f3f4f8 !important; }
.product-row.on { background: #fffbea !important; box-shadow: inset 3px 0 0 #1b1f3b; }
.row-status { text-align: right; flex: none; }
.status-pill { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #eceef4; color: #4b5060; white-space: nowrap; }
.status-pill.s-PUBLISHED { background: #e8eefc; color: #1e3a8a; }
.status-pill.s-DRAFT { background: #fff1e8; color: #9a3412; }
</style>
