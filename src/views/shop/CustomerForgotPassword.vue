<script setup lang="ts">
import { ref } from 'vue'
import { forgotPassword } from '@/api/customer'
const email=ref(''),pending=ref(false),error=ref(''),sent=ref(false)
async function submit(){
 if(pending.value)return;pending.value=true;error.value=''
 try{await forgotPassword(email.value.trim());sent.value=true}
 catch(e){error.value=e instanceof Error?e.message:'送出失敗，請稍後再試'}
 finally{pending.value=false}
}
</script>
<template>
 <section class="shop-panel"><h1>忘記密碼</h1>
  <template v-if="!sent">
   <p>輸入註冊時的 Email，我們會寄出重設密碼連結（30 分鐘內有效）。</p>
   <form @submit.prevent="submit"><label for="forgot-email">Email</label><input id="forgot-email" v-model="email" type="email" autocomplete="email" required maxlength="254">
    <p v-if="error" class="shop-error" role="alert">{{ error }}</p><button class="shop-button" :disabled="pending">{{ pending?'送出中…':'寄送重設連結' }}</button></form>
  </template>
  <!-- 不論 Email 是否註冊都顯示相同結果，避免被用來查詢帳號是否存在 -->
  <p v-else class="shop-success" role="status">如果這個 Email 已註冊，重設密碼連結已寄出，請在 30 分鐘內開啟。沒收到可以稍後再試一次。</p>
  <p style="margin-top:24px"><router-link to="/shop/login">← 回到登入</router-link></p>
 </section>
</template>
