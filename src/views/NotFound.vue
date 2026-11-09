<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
<template>
    <div>
        <h1>找不到這個頁面 😢</h1>
        <router-link :to="route.path.startsWith('/shop') ? '/shop' : '/'">返回首頁</router-link>
    </div>
</template>