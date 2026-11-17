<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { loginCustomer, CustomerApiError } from '@/api/customer'
import PasswordField from '@/components/PasswordField.vue'
import { useCustomerStore } from '@/stores/customer'
import { guestLines, mergeGuestCart, takeReturn, reloadGuest } from './guestCart'
import SocialLogin from './SocialLogin.vue'
const router=useRouter(),route=useRoute(),store=useCustomerStore()
const username=ref(typeof route.query.username==='string'?route.query.username:''),password=ref(''),remember=ref(false),pending=ref(false),error=ref('')
async function submit() {
  if(pending.value)return
  pending.value=true;error.value=''
  try {
    const deviceId=localStorage.getItem('customerDeviceId') || crypto.randomUUID();localStorage.setItem('customerDeviceId',deviceId)
    store.profile=await loginCustomer({username:username.value.trim(),password:password.value,deviceId,rememberMe:remember.value})
    password.value=''
    // 有訪客購物車就合併進本人購物車；結果在購物車頁顯示，不阻擋登入
    reloadGuest()
    const hadGuest=guestLines.value.length>0
    if(hadGuest&&store.profile)await mergeGuestCart(store.profile.id).catch(()=>null)
    await router.replace(takeReturn()||(hadGuest?'/shop/cart':'/shop/account'))
  } catch(e) {
    // 401：一律只說帳號或密碼不正確，不透露帳號是否存在、是否為其他身分（如員工）的帳號
    error.value=e instanceof CustomerApiError&&e.status===401?'帳號或密碼不正確。':e instanceof Error?e.message:'登入失敗，請稍後再試'
  }
  finally { pending.value=false }
}
</script>
<template>
  <section class="shop-panel"><h1>顧客登入</h1><p>登入後管理會員資料；購物車裡的商品會自動保留。</p><p v-if="route.query.registered==='1'" class="shop-success" role="status">帳號已建立，請登入。驗證信已寄到你的 Email。</p><p v-if="route.query.reset==='1'" class="shop-success" role="status">密碼已重設，請用新密碼登入。</p>
    <form @submit.prevent="submit"><label for="customer-username">手機或 Email</label><input id="customer-username" v-model="username" autocomplete="username" required maxlength="254" placeholder="0912345678 或 name@example.com">
      <label for="customer-password">密碼</label><PasswordField id="customer-password" v-model="password" autocomplete="current-password" required />
      <div class="login-row"><label class="shop-check"><input v-model="remember" type="checkbox">保持登入</label><router-link to="/shop/forgot-password" class="forgot">忘記密碼？</router-link></div>
      <p v-if="error" class="shop-error" role="alert">{{ error }}</p><button class="shop-button" :disabled="pending">{{ pending?'登入中…':'登入會員' }}</button>
    </form>
    <SocialLogin />
    <p style="margin-top:24px">還沒有帳號？<router-link to="/shop/register">建立顧客帳號</router-link></p>
  </section>
</template>
<style scoped>
.login-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.forgot{font-size:14px}
</style>
