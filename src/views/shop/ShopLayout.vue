<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/customer'
import { useCatalog } from './useCatalog'
import { getCustomer } from '@/api/customer'
const route = useRoute(), router = useRouter(), customer = useCustomerStore(), { categories, load } = useCatalog()
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(() => route.query.q, q => { keyword.value = typeof q === 'string' ? q : '' })
const navCategories = computed(() => categories.value.slice(0, 6))
const memberName = computed(() => customer.profile?.displayName || customer.profile?.username || '')
function search() {
  const q = keyword.value.trim()
  router.push({ path: '/shop/products', query: q ? { q } : {} })
}
const isActive = (query: Record<string, string>) => route.path === '/shop/products' && Object.entries(query).every(([k, v]) => route.query[k] === v) && Object.keys(route.query).filter(k => k !== 'page').length === Object.keys(query).length
// 靜默讀取登入狀態，只用於頁首顯示會員名稱；未登入時忽略錯誤。
onMounted(() => {
  load()
  if (!customer.profile) getCustomer().then(p => { customer.profile = p }).catch(() => {})
})
</script>

<template>
  <div class="shop-shell">
    <a class="skip-link" href="#shop-main">跳到主要內容</a>
    <div class="shop-notice">現貨下單保留庫存 30 分鐘・預購截單前保留配額<span class="hide-sm">・本站付款與配送為模擬演練，不會實際收款</span></div>

    <header class="shop-header">
      <div class="shop-header-row">
        <router-link class="shop-logo" to="/shop" aria-label="Figura 首頁">
          <span class="shop-logo-mark" aria-hidden="true">F</span>
          <span class="shop-logo-text">Figura<span>.</span></span>
        </router-link>
        <form class="shop-search" role="search" @submit.prevent="search">
          <label for="shop-search-input" class="visually-hidden">搜尋商品</label>
          <input id="shop-search-input" v-model="keyword" type="search" placeholder="輸入角色、作品、品牌" autocomplete="off">
          <button type="submit">搜尋</button>
        </form>
        <nav class="shop-member" aria-label="會員">
          <router-link v-if="memberName" to="/shop/account" class="member-link">{{ memberName }}</router-link>
          <router-link v-else to="/shop/login" class="member-link">登入 / 註冊</router-link>
          <router-link to="/shop/orders" class="member-link hide-sm">我的訂單</router-link>
          <router-link to="/shop/preorder-orders" class="member-link hide-sm">我的預購</router-link>
          <router-link to="/shop/cart" class="cart-link">購物車</router-link>
        </nav>
      </div>
      <nav class="shop-cats" aria-label="商品分類">
        <div class="shop-cats-row">
          <router-link to="/shop/preorders" :class="{ on: route.path.startsWith('/shop/preorders') }">預購情報</router-link>
          <router-link :to="{ path: '/shop/products', query: { type: 'stock' } }" :class="{ on: isActive({ type: 'stock' }) }">現貨商品</router-link>
          <router-link to="/shop/products" :class="{ on: isActive({}) }">所有商品</router-link>
          <router-link v-for="c in navCategories" :key="c.name" :to="{ path: '/shop/products', query: { category: c.name } }" :class="{ on: isActive({ category: c.name }) }">{{ c.name }}</router-link>
        </div>
      </nav>
    </header>

    <main id="shop-main" class="shop-main"><router-view /></main>

    <section class="shop-trust" aria-label="購物保障">
      <div><span class="ico blue" aria-hidden="true">正</span><span><b>正版商品</b><br>只賣品牌正規通路商品</span></div>
      <div><span class="ico orange" aria-hidden="true">預</span><span><b>配額保留</b><br>預購下單保留配額 30 分鐘</span></div>
      <div><span class="ico blue" aria-hidden="true">貨</span><span><b>進度可查</b><br>到貨、分配、出貨即時更新</span></div>
      <div><span class="ico orange" aria-hidden="true">退</span><span><b>未出貨可退款</b><br>整筆申請（模擬演練）</span></div>
    </section>

    <footer class="shop-footer">
      <div class="shop-footer-grid">
        <div><div class="foot-logo">Figura<span>.</span></div>公仔・PVC・GK 收藏專門店</div>
        <div><div class="foot-title">購物</div><router-link to="/shop/products">所有商品</router-link><br><router-link to="/shop/preorders">預購情報</router-link><br><router-link to="/shop/cart">購物車</router-link></div>
        <div><div class="foot-title">會員</div><router-link to="/shop/orders">我的訂單</router-link><br><router-link to="/shop/preorder-orders">我的預購</router-link><br><router-link to="/shop/addresses">收件地址</router-link></div>
        <div><div class="foot-title">其他</div><router-link to="/shop/account">會員中心</router-link><br><router-link to="/admin/login">員工入口</router-link></div>
      </div>
      <p class="foot-note">付款、配送、退貨與退款皆為模擬演練，不會實際收款或轉帳。</p>
    </footer>

    <nav class="shop-tabbar" aria-label="快速導覽">
      <router-link to="/shop" :class="{ on: route.path === '/shop' }"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></svg>首頁</router-link>
      <router-link to="/shop/products" :class="{ on: route.path.startsWith('/shop/products') }"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg>商品</router-link>
      <router-link to="/shop/preorder-orders" :class="{ on: route.path.startsWith('/shop/preorder-orders') }"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>我的預購</router-link>
      <router-link to="/shop/account" :class="{ on: route.path.startsWith('/shop/account') }"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>會員</router-link>
    </nav>
  </div>
</template>

<style>
/* ===== Figura 商店主題（B 熱血玩具屋）。全部以 .shop-shell 為範圍，避免影響員工後台。 ===== */
.shop-shell {
  --ink: #15161a; --muted: #4b5060; --subtle: #6b7080; --line: #e3e5ec; --bg: #f3f4f8; --card: #fff;
  --navy: #1b1f3b; --yellow: #ffd23f; --orange: #c2410c; --orange-soft: #fff1e8; --orange-ink: #9a3412;
  --blue: #1d4ed8; --blue-soft: #e8eefc; --blue-ink: #1e3a8a; --danger: #8a1c1c; --danger-soft: #fdecec;
  min-height: 100vh; background: var(--bg); color: var(--ink);
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
  font-size: 15px; line-height: 1.6;
}
.shop-shell a { color: var(--blue); text-decoration: none; }
.shop-shell a:hover { color: var(--blue-ink); }
.shop-shell .visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.shop-shell .skip-link { position: absolute; left: -9999px; top: 8px; z-index: 50; background: var(--navy); color: #fff; padding: 10px 16px; border-radius: 8px; }
.shop-shell .skip-link:focus { left: 8px; }
.shop-shell :focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }

.shop-notice { background: var(--yellow); color: var(--ink); font-size: 13px; font-weight: 700; text-align: center; padding: 8px 16px; }

.shop-header { background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 20; }
.shop-header-row { max-width: 1320px; margin: 0 auto; padding: 14px 24px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
.shop-shell .shop-logo { display: flex; align-items: center; gap: 10px; color: var(--ink); }
.shop-logo-mark { width: 40px; height: 40px; background: var(--navy); color: var(--yellow); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; }
.shop-logo-text { font-weight: 900; font-size: 24px; letter-spacing: .5px; }
.shop-logo-text span { color: var(--orange); }
.shop-search { flex: 1 1 320px; display: flex; min-width: 0; }
.shop-shell .shop-search input { flex: 1; min-width: 0; width: auto; border: 2px solid var(--navy); border-right: 0; border-radius: 10px 0 0 10px; padding: 10px 14px; font: inherit; background: #fff; color: var(--ink); margin: 0; }
.shop-search button { background: var(--navy); color: #fff; border: 0; border-radius: 0 10px 10px 0; padding: 0 22px; font: inherit; font-weight: 700; cursor: pointer; }
.shop-member { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.shop-shell .member-link { color: var(--ink); font-size: 14px; padding: 10px 10px; border-radius: 8px; }
.shop-shell .member-link:hover { background: var(--bg); color: var(--ink); }
.shop-shell .cart-link { background: var(--orange); color: #fff; font-size: 14px; font-weight: 700; padding: 10px 18px; border-radius: 10px; }
.shop-shell .cart-link:hover { background: #9a3412; color: #fff; }

.shop-cats { background: var(--navy); }
.shop-cats-row { max-width: 1320px; margin: 0 auto; padding: 0 16px; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.shop-cats-row::-webkit-scrollbar { display: none; }
.shop-shell .shop-cats a { color: #fff; font-size: 15px; padding: 13px 14px; white-space: nowrap; }
.shop-shell .shop-cats a:hover { color: var(--yellow); }
.shop-shell .shop-cats a.on { color: var(--yellow); font-weight: 700; box-shadow: inset 0 -3px 0 var(--yellow); }

.shop-main { max-width: 1320px; margin: 0 auto; padding: 24px 24px 56px; min-height: 50vh; }

.shop-trust { background: #fff; border-top: 1px solid var(--line); padding: 28px 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: none; }
.shop-trust > div { display: flex; gap: 12px; align-items: center; font-size: 14px; color: var(--muted); max-width: 320px; justify-self: center; width: 100%; }
.shop-trust b { color: var(--ink); }
.shop-trust .ico { width: 44px; height: 44px; flex: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.shop-trust .ico.blue { background: var(--blue-soft); color: var(--blue); }
.shop-trust .ico.orange { background: var(--orange-soft); color: var(--orange-ink); }

.shop-footer { background: var(--navy); color: #c9cce0; padding: 36px 24px 28px; }
.shop-footer-grid { max-width: 1320px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; font-size: 14px; line-height: 2; }
.shop-shell .shop-footer a { color: #c9cce0; }
.shop-shell .shop-footer a:hover { color: #fff; }
.foot-logo { color: #fff; font-weight: 900; font-size: 20px; }
.foot-logo span, .foot-title { color: var(--yellow); }
.foot-title { font-weight: 700; }
.shop-shell .foot-note { max-width: 1320px; margin: 24px auto 0; font-size: 12px; color: #9aa0c4; }

.shop-tabbar { display: none; }

/* ===== 共用元件：其他商店頁面沿用這些 class ===== */
.shop-shell h1 { color: var(--ink); font-family: inherit; font-size: 28px; font-weight: 900; line-height: 1.35; margin: 0 0 14px; }
.shop-shell h2 { color: var(--ink); font-family: inherit; font-weight: 900; }
.shop-shell p { color: var(--muted); line-height: 1.75; }
.shop-shell label { display: block; font-size: 14px; font-weight: 500; margin: 16px 0 6px; color: var(--ink); }
.shop-shell input:not([type=checkbox]):not([type=radio]), .shop-shell select, .shop-shell textarea {
  width: 100%; border: 1px solid #d5d8e1; border-radius: 10px; padding: 11px 12px; background: #fff; color: var(--ink); font: inherit; min-height: 44px;
}
.shop-shell input:focus, .shop-shell select:focus, .shop-shell textarea:focus { border-color: var(--navy); outline: 2px solid rgba(27, 31, 59, .15); }
.shop-shell .shop-check { display: flex; align-items: center; gap: 8px; }
.shop-shell input[type=checkbox], .shop-shell input[type=radio] { accent-color: var(--navy); width: 18px; height: 18px; }
.shop-button { border: 0; border-radius: 10px; background: var(--navy); color: #fff; padding: 12px 20px; cursor: pointer; font: inherit; font-weight: 700; min-height: 44px; line-height: 1.3; }
.shop-button:hover { background: #2a2f57; }
.shop-button:disabled { opacity: .55; cursor: not-allowed; }
.shop-shell a.shop-button { color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.shop-shell .shop-button.primary, .shop-shell a.shop-button.primary { background: var(--orange); }
.shop-shell .shop-button.primary:hover { background: #9a3412; }
.shop-shell .shop-button.ghost { background: #fff; color: var(--navy); border: 2px solid var(--navy); }
.shop-shell .shop-error { color: var(--danger); background: var(--danger-soft); padding: 10px 14px; border-radius: 10px; }
.shop-shell .shop-success { color: var(--blue-ink); background: var(--blue-soft); padding: 10px 14px; border-radius: 10px; }
.shop-panel { max-width: 460px; margin: 16px auto; background: #fff; padding: 32px; border-radius: 16px; box-shadow: 0 1px 0 var(--line); }
.shop-card { background: #fff; border-radius: 14px; padding: 20px; }
.shop-crumbs { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
.shop-shell .shop-crumbs a { color: var(--muted); }
.shop-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.shop-shell .shop-section-head h2 { margin: 0; font-size: 22px; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.shop-empty { background: #fff; border-radius: 14px; padding: 40px 20px; text-align: center; color: var(--muted); }

@media (max-width: 768px) {
  .shop-notice { font-size: 12px; padding: 6px 12px; }
  .shop-header-row { padding: 10px 16px; gap: 10px; }
  .shop-logo-mark { width: 34px; height: 34px; font-size: 17px; }
  .shop-logo-text { font-size: 20px; }
  .shop-search { order: 3; flex-basis: 100%; }
  .shop-member { margin-left: auto; }
  .shop-shell .hide-sm { display: none; }
  .shop-shell .member-link { padding: 8px; }
  .shop-shell .cart-link { padding: 8px 14px; }
  .shop-main { padding: 16px 16px 40px; }
  .shop-shell h1 { font-size: 24px; }
  .shop-panel { padding: 24px 18px; }
  .shop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .shop-footer { padding-bottom: 96px; }
  .shop-tabbar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: #fff; border-top: 1px solid var(--line); padding: 4px 0 calc(6px + env(safe-area-inset-bottom)); }
  .shop-shell .shop-tabbar a { display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--muted); font-size: 11px; padding: 6px 0; min-height: 44px; }
  .shop-shell .shop-tabbar a.on { color: var(--navy); font-weight: 700; }
  .shop-tabbar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; }
}
</style>
