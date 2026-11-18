<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { registerCustomer } from '@/api/customer'
import PasswordField from '@/components/PasswordField.vue'
import SocialLogin from './SocialLogin.vue'
const router=useRouter(),phone=ref(''),email=ref(''),password=ref(''),pending=ref(false),error=ref('')
// 台灣手機：允許空白或連字號，送出時由後端正規化為 09xxxxxxxx
const phoneOk=(v:string)=>/^(?:\+?886|0)?9\d{8}$/.test(v.replace(/[\s-]/g,''))
async function submit() {
 if(pending.value)return
 if(!phoneOk(phone.value)){error.value='手機號碼格式不正確，請輸入 09 開頭的 10 碼手機';return}
 if(new TextEncoder().encode(password.value).length>72){error.value='密碼過長，請縮短後再試';return}
 pending.value=true;error.value=''
 try {
  const created=await registerCustomer({phone:phone.value.trim(),email:email.value.trim(),password:password.value})
  password.value=''
  await router.replace({path:'/shop/login',query:{registered:'1',login:created.email||email.value.trim()}})
 }
 catch(e){error.value=e instanceof Error?e.message:'建立帳號失敗，請稍後再試'}
 finally{pending.value=false}
}
</script>
<template>
 <section class="shop-panel"><h1>註冊會員</h1><p>填寫手機、Email 與密碼即可建立帳號；註冊後會寄出 Email 驗證信。</p><form @submit.prevent="submit">
  <label for="new-phone">手機號碼</label>
  <div class="phone-row"><span class="cc" aria-hidden="true">TW +886</span><input id="new-phone" v-model="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="0912 345 678" required maxlength="20"></div>
  <label for="new-email">Email</label><input id="new-email" v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@example.com">
  <label for="new-password">密碼</label><PasswordField id="new-password" v-model="password" autocomplete="new-password" required minlength="12" /><p class="hint">至少 12 個字元。</p>
  <p v-if="error" class="shop-error" role="alert">{{ error }}</p><button class="shop-button" :disabled="pending">{{ pending?'建立中…':'建立帳號' }}</button>
 </form>
 <SocialLogin />
 <p style="margin-top:24px">已有帳號？<router-link to="/shop/login">顧客登入</router-link></p></section>
</template>
<style scoped>
.phone-row{display:flex;align-items:stretch;gap:8px}.phone-row input{flex:1;min-width:0}
.cc{display:inline-flex;align-items:center;padding:0 12px;border:1px solid #d5d8e1;border-radius:10px;background:#f3f4f8;font-size:14px;color:#15161a;white-space:nowrap}
.hint{font-size:12px;margin:8px 0}
</style>
