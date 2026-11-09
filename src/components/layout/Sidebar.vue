<script setup lang="ts">
import { computed } from "vue";
import { useUserInfoStore } from "@/stores/userInfo.js";
import type { Permission } from "@/types/user";

const transferDataToTree = (data: Permission[]) => {
  const itemsMap = new Map(); // 用于快速查找节点
  const rootItems: any[] = []; // 存储根节点

  // 首先，初始化每个节点，并将其存储到Map中
  data.forEach((item) => {
    itemsMap.set(item.id, { ...item, children: [] });
  });

  // 然后，遍历每个节点，将其放入父节点的children数组或根数组
  data.forEach((item) => {
    const parent = itemsMap.get(item.parentId);
    if (parent) {
      parent.children.push(itemsMap.get(item.id));
    } else {
      // 如果没有找到父节点，那么它是顶级节点
      rootItems.push(itemsMap.get(item.id));
    }
  });

  return rootItems;
};
const userInfoStore = useUserInfoStore();
const leftbarData = computed(() => transferDataToTree(userInfoStore.permissions));

</script>
<template>
  <nav class="pc-sidebar">
    <div class="navbar-wrapper">
      <div class="m-header">
        <router-link to="/home" class="b-brand text-primary">
          <img src="@/brand/figura-logo.svg" class="img-fluid logo-lg" alt="Figura">
        </router-link>
      </div>
      <div class="navbar-content">
        <ul class="pc-navbar">
          <li class="pc-item"><router-link to="/home" class="pc-link"><span class="pc-mtext">工作首頁</span></router-link></li>
          <li v-for="item in leftbarData.filter(item => item.adminRouter || item.children.length)" :key="item.id"
              class="pc-item" :class="{ 'pc-hasmenu': item.children.length }">
            <template v-if="item.children.length">
              <a href="#!" @click.prevent class="pc-link"><span class="pc-mtext">{{ item.name }}</span><span class="pc-arrow"><i data-feather="chevron-right"></i></span></a>
              <ul class="pc-submenu">
                <li v-for="child in item.children" :key="child.id" class="pc-item">
                  <router-link class="pc-link" :to="child.adminRouter">{{ child.name }}</router-link>
                </li>
              </ul>
            </template>
            <router-link v-else class="pc-link" :to="item.adminRouter"><span class="pc-mtext">{{ item.name }}</span></router-link>
          </li>
          <li class="pc-item pc-caption"><label>後續功能待實作</label></li>
        </ul>
      </div>
    </div>
  </nav>
</template>
