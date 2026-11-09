<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { registerCustomer } from '@/api/customer'
const router=useRouter(),username=ref(''),password=ref(''),displayName=ref(''),pending=ref(false),error=ref('')
async function submit() {
 if(pending.value)return
 if(new TextEncoder().encode(password.value).length>72){error.value='密碼過長，請縮短後再試';return}
 pending.value=true;error.value=''
 try { await registerCustomer({username:username.value.trim(),password:password.value,displayName:displayName.value.trim()});password.value='';await router.replace({path:'/shop/login',query:{registered:'1',username:username.value.trim()}}) }
 catch(e){error.value=e instanceof Error?e.message:'建立帳號失敗，請稍後再試'}
 finally{pending.value=false}
}
</script>
<template>
 <section class="shop-panel"><h1>建立顧客帳號</h1><p>為你的收藏旅程，留下一個起點。</p><form @submit.prevent="submit">
  <label for="new-username">顧客帳號</label><input id="new-username" v-model="username" autocomplete="username" required pattern="[A-Za-z0-9_]{3,32}" minlength="3" maxlength="32"><p style="font-size:12px;margin:8px 0">3–32 個英數或底線，大小寫視為同一帳號。</p>
  <label for="new-name">暱稱</label><input id="new-name" v-model="displayName" autocomplete="nickname" required maxlength="80">
  <label for="new-password">密碼</label><input id="new-password" v-model="password" type="password" autocomplete="new-password" required minlength="12"><p style="font-size:12px;margin:8px 0">至少 12 個字元。</p>
  <p v-if="error" class="shop-error" role="alert">{{ error }}</p><button class="shop-button" :disabled="pending">{{ pending?'建立中…':'建立帳號' }}</button>
 </form><p style="margin-top:24px">已有帳號？<router-link to="/shop/login">顧客登入</router-link></p></section>
</template>
