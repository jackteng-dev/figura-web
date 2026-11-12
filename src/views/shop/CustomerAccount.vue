<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { updateCustomer, logoutCustomer } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'
const store=useCustomerStore(),router=useRouter(),displayName=ref(store.profile?.displayName || ''),pending=ref(false),error=ref(''),success=ref('')
async function save() { if(pending.value)return;pending.value=true;error.value='';success.value='';try{store.profile=await updateCustomer(displayName.value.trim());success.value='暱稱已儲存。'}catch(e){error.value=e instanceof Error?e.message:'操作失敗'}finally{pending.value=false} }
async function logout() { if(pending.value)return;pending.value=true;error.value='';try{await logoutCustomer();store.clear();await router.replace('/shop/login')}catch(e){error.value=e instanceof Error?e.message:'登出失敗'}finally{pending.value=false} }
</script>
<template>
 <section class="shop-panel"><h1>我的會員資料</h1><p>帳號：<strong data-testid="member-username">{{ store.profile?.username }}</strong></p><p>你好，<span data-testid="member-name">{{ store.profile?.displayName }}</span>。</p>
 <form @submit.prevent="save"><label for="profile-name">暱稱</label><input id="profile-name" v-model="displayName" required maxlength="80" autocomplete="nickname"><p v-if="error" class="shop-error" role="alert">{{ error }}</p><p v-if="success" class="shop-success" role="status">{{ success }}</p><button class="shop-button" :disabled="pending">儲存暱稱</button></form>
 <p><router-link to="/shop/orders">我的訂單 →</router-link></p><p><router-link to="/shop/cart">我的購物車 →</router-link></p><p><router-link to="/shop/addresses">管理收件地址 →</router-link></p>
 <button class="shop-button" style="margin-top:24px;background:#4b5060" :disabled="pending" @click="logout">登出會員</button></section>
</template>
