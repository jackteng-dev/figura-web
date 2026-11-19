<script setup lang="ts">
// 收件地址表單：地址頁與結帳頁共用。只負責欄位與瀏覽器端格式檢查，儲存（含版本核對）由使用的頁面呼叫 API。
import { reactive, watch } from 'vue'
import type { AddressView, AddressWrite } from '@/api/shopping'
const props = withDefaults(defineProps<{ address?: AddressView; disabled?: boolean; idPrefix?: string; saveLabel?: string }>(), { idPrefix: '', saveLabel: '儲存地址' })
const emit = defineEmits<{ save: [AddressWrite]; cancel: [] }>()
const form = reactive<AddressWrite>({ expectedVersion: 0, recipientName: '', phone: '', postalCode: '', city: '', district: '', street: '' })
watch(() => props.address, a => Object.assign(form, { expectedVersion: a?.version || 0, recipientName: a?.recipientName || '', phone: a?.phone || '', postalCode: a?.postalCode || '', city: a?.city || '', district: a?.district || '', street: a?.street || '' }), { immediate: true })
const id = (name: string) => props.idPrefix + name
function submit() { emit('save', { ...form, recipientName: form.recipientName.trim(), phone: form.phone.trim(), postalCode: form.postalCode.trim(), city: form.city.trim(), district: form.district.trim(), street: form.street.trim() }) }
</script>
<template>
 <form class="address-form" @submit.prevent="submit">
  <h2>{{ form.expectedVersion ? '編輯收件地址' : '新增收件地址' }}</h2>
  <fieldset :disabled="disabled">
   <label :for="id('recipient')">收件人</label><input :id="id('recipient')" v-model="form.recipientName" required maxlength="80" autocomplete="shipping name">
   <label :for="id('phone')">電話</label><input :id="id('phone')" v-model="form.phone" type="tel" required pattern="\+?[0-9]{8,15}" maxlength="16" autocomplete="shipping tel" :aria-describedby="id('phone-hint')"><small :id="id('phone-hint')">8–15 位數字，可加國碼 +；不含空格或連字號。</small>
   <label :for="id('postal')">郵遞區號</label><input :id="id('postal')" v-model="form.postalCode" required pattern="[0-9]{3}([0-9]{2}|[0-9]{3})?" maxlength="6" inputmode="numeric" autocomplete="shipping postal-code">
   <label :for="id('city')">縣市</label><input :id="id('city')" v-model="form.city" required maxlength="40" autocomplete="shipping address-level1">
   <label :for="id('district')">鄉鎮市區</label><input :id="id('district')" v-model="form.district" required maxlength="40" autocomplete="shipping address-level2">
   <label :for="id('street')">街道與門牌</label><input :id="id('street')" v-model="form.street" required maxlength="200" autocomplete="shipping address-line1">
   <div class="address-actions"><button class="shop-button">{{ saveLabel }}</button><button class="shop-button" type="button" @click="emit('cancel')">取消編輯</button></div>
  </fieldset>
 </form>
</template>
<style scoped>
.address-form{background:#ffffff;padding:24px;border:1px solid #e3e5ec;border-radius:12px;overflow-wrap:anywhere}.address-form h2{font-size:22px}
.address-form fieldset{border:0;padding:0;margin:0;min-width:0}.address-form small{display:block;margin-top:8px}
.address-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0 0}
</style>
