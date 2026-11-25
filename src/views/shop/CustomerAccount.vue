<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { logoutCustomer, resendVerification, getCustomer } from '@/api/customer'
import { serverCount } from './guestCart'
import { useCustomerStore } from '@/stores/customer'
const store=useCustomerStore(),router=useRouter(),pending=ref(false),error=ref('')
const resendMsg=ref(''),resending=ref(false)
async function resend(){if(resending.value)return;resending.value=true;resendMsg.value='';error.value='';try{await resendVerification();resendMsg.value='驗證信已重新寄出，請到信箱開啟連結。'}catch(e){error.value=e instanceof Error?e.message:'重寄失敗'}finally{resending.value=false}}
// 重新讀取，取得最新的驗證狀態（例如剛在別的分頁完成驗證）
getCustomer().then(p=>{store.profile=p}).catch(()=>{})
async function logout() { if(pending.value)return;pending.value=true;error.value='';try{await logoutCustomer();store.clear();serverCount.value=null;await router.replace('/shop/login')}catch(e){error.value=e instanceof Error?e.message:'登出失敗'}finally{pending.value=false} }
</script>
<template>
 <section class="shop-panel"><h1>我的會員資料</h1>
 <dl class="contact">
  <template v-if="store.profile?.email"><dt>Email</dt><dd><span data-testid="member-username">{{ store.profile.email }}</span> <span :class="['badge', store.profile.emailVerified ? 'ok' : 'todo']" data-testid="email-status">{{ store.profile.emailVerified ? '已驗證' : '未驗證' }}</span>
   <button v-if="!store.profile.emailVerified" type="button" class="link-btn" :disabled="resending" @click="resend">重寄驗證信</button></dd></template>
  <template v-if="store.profile?.phone"><dt>手機</dt><dd>{{ store.profile.phone }}</dd></template>
 </dl>
 <p v-if="resendMsg" class="shop-success" role="status">{{ resendMsg }}</p><p v-if="error" class="shop-error" role="alert">{{ error }}</p>
 <p><router-link to="/shop/my-orders">我的訂單 →</router-link></p><p><router-link to="/shop/cart">我的購物車 →</router-link></p><p><router-link to="/shop/addresses">管理收件地址 →</router-link></p><p><router-link to="/shop/favorites">我的收藏 →</router-link></p><p><router-link to="/shop/notifications">通知與通知設定 →</router-link></p>
 <button class="shop-button" style="margin-top:24px;background:#4b5060" :disabled="pending" @click="logout">登出會員</button></section>
</template>
<style scoped>
.contact{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 16px;font-size:14px}.contact dt{color:#4b5060}.contact dd{margin:0;overflow-wrap:anywhere}
.badge{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px}.badge.ok{background:#e8eefc;color:#1e3a8a}.badge.todo{background:#fff1e8;color:#9a3412}
.link-btn{border:0;background:transparent;color:#1d4ed8;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer;padding:4px;margin-left:4px}.link-btn:disabled{opacity:.5}
</style>
