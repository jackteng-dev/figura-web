<script setup lang="ts">
import { onMounted,reactive,ref } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getAddresses,saveAddress,deleteAddress,type AddressView,type AddressWrite } from '@/api/shopping'
const router=useRouter(),addresses=ref<AddressView[]>([]),busy=ref(false),error=ref(''),success=ref(''),editing=ref(''),needsReload=ref(false),loaded=ref(false)
const form=reactive<AddressWrite>({expectedVersion:0,recipientName:'',phone:'',postalCode:'',city:'',district:'',street:''})
function edit(a?:AddressView){if(busy.value||needsReload.value)return;editing.value=a?.id||crypto.randomUUID();Object.assign(form,{expectedVersion:a?.version||0,recipientName:a?.recipientName||'',phone:a?.phone||'',postalCode:a?.postalCode||'',city:a?.city||'',district:a?.district||'',street:a?.street||''});success.value='';error.value=''}
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(e instanceof CustomerApiError&&e.status===401)await router.replace('/shop/login')}
async function load(){if(busy.value)return;busy.value=true;error.value='';try{addresses.value=await getAddresses();loaded.value=true;needsReload.value=false;editing.value=''}catch(e){await failure(e)}finally{busy.value=false}}
async function save(){if(busy.value||needsReload.value)return;busy.value=true;error.value='';success.value='';try{await saveAddress(editing.value,{...form});addresses.value=await getAddresses();editing.value='';success.value='地址已儲存。'}catch(e){needsReload.value=!(e instanceof CustomerApiError&&e.status===400);await failure(e);if(!(e instanceof CustomerApiError))error.value='回應未確認，請重新核對地址後再操作。'}finally{busy.value=false}}
async function remove(a:AddressView){if(busy.value||needsReload.value||!window.confirm('確定刪除此收件地址？'))return;busy.value=true;error.value='';success.value='';try{await deleteAddress(a.id,a.version);addresses.value=await getAddresses();if(editing.value===a.id)editing.value='';success.value='地址已刪除。'}catch(e){needsReload.value=!(e instanceof CustomerApiError&&e.status===400);await failure(e)}finally{busy.value=false}}
onMounted(load)
</script>
<template>
 <section><h1>我的收件地址</h1><p>目前保存台灣收件資料，最多 10 個地址。地址尚未連接訂單或物流服務。</p><p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="success" role="status" class="shop-success">{{ success }}</p>
 <div class="address-actions"><button class="shop-button" :disabled="busy||needsReload||!loaded||addresses.length>=10" @click="edit()">新增地址</button><button class="shop-button" :disabled="busy" @click="load">重新核對地址</button></div>
 <p v-if="loaded&&!addresses.length" data-testid="addresses-empty">尚未保存收件地址。</p>
 <div class="address-grid"><article v-for="a in addresses" :key="a.id" :data-testid="'address-'+a.id" class="address-card"><h2>{{ a.recipientName }}</h2><p>{{ a.phone }}</p><p>{{ a.postalCode }} {{ a.city }}{{ a.district }}{{ a.street }}</p><div class="address-actions"><button class="shop-button" :disabled="busy||needsReload" @click="edit(a)">編輯地址</button><button class="shop-button" :disabled="busy||needsReload" @click="remove(a)">刪除地址</button></div></article></div>
 <form v-if="editing" class="address-form" @submit.prevent="save"><h2>{{ form.expectedVersion?'編輯收件地址':'新增收件地址' }}</h2><fieldset :disabled="busy||needsReload">
 <label for="recipient">收件人</label><input id="recipient" v-model="form.recipientName" required maxlength="80" autocomplete="shipping name">
 <label for="phone">電話</label><input id="phone" v-model="form.phone" type="tel" required pattern="\+?[0-9]{8,15}" maxlength="16" autocomplete="shipping tel"><small>8–15 位數字，可加國碼 +；不含空格或連字號。</small>
 <label for="postal">郵遞區號</label><input id="postal" v-model="form.postalCode" required pattern="[0-9]{3}([0-9]{2}|[0-9]{3})?" maxlength="6" inputmode="numeric" autocomplete="shipping postal-code">
 <label for="city">縣市</label><input id="city" v-model="form.city" required maxlength="40" autocomplete="shipping address-level1">
 <label for="district">鄉鎮市區</label><input id="district" v-model="form.district" required maxlength="40" autocomplete="shipping address-level2">
 <label for="street">街道與門牌</label><input id="street" v-model="form.street" required maxlength="200" autocomplete="shipping address-line1">
 <div class="address-actions"><button class="shop-button">儲存地址</button><button class="shop-button" type="button" @click="editing=''">取消編輯</button></div></fieldset></form>
 </section>
</template>
<style scoped>
.address-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.address-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;margin-top:24px}.address-card,.address-form{background:#ffffff;padding:24px;border:1px solid #e3e5ec;border-radius:12px;overflow-wrap:anywhere}.address-card h2,.address-form h2{font-size:22px}.address-form{max-width:560px;margin-top:32px}.address-form fieldset{border:0;padding:0;min-width:0}.address-form small{display:block;margin-top:8px}
</style>
