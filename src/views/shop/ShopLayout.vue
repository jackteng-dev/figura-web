<template>
  <div class="shop-shell">
    <header class="shop-header">
      <router-link class="shop-brand" to="/shop">ELPSY <span>COLLECTIBLES</span></router-link>
      <nav aria-label="商店導覽"><router-link to="/shop/products">所有商品</router-link><router-link to="/shop/preorders">預購情報</router-link><router-link to="/shop/cart">購物車</router-link><router-link to="/shop/orders">我的訂單</router-link><router-link to="/shop/preorder-orders">我的預購</router-link><router-link to="/shop/account">會員中心</router-link><router-link to="/shop/login">顧客登入</router-link><router-link to="/admin/login">員工入口</router-link></nav>
    </header>
    <main class="shop-main"><router-view /></main>
    <footer class="shop-footer">ELPSY SHOP · 公仔與收藏品<br><span>商品主圖、現貨訂單與限時庫存保留已開放；付款僅提供模擬，不會實際收款；配送、退貨驗收與退款皆為模擬演練，不會實際轉帳。</span></footer>
  </div>
</template>
<style>
.shop-shell { min-height:100vh;background:#f6f2eb;color:#292e29;font-family:system-ui,sans-serif; }
.shop-shell a { color:#365545;text-decoration:none; }
.shop-header { max-width:1120px;margin:auto;padding:28px 28px;border-bottom:1px solid #d9d9cd;display:flex;justify-content:space-between;align-items:center;gap:24px; }
.shop-brand { font-family:Georgia,serif;font-size:30px;letter-spacing:3px; }
.shop-brand span { display:block;font:10px system-ui;letter-spacing:3px;color:#687468; }
.shop-header nav { display:flex;gap:24px;flex-wrap:wrap;font-size:14px; }
.shop-main { max-width:1120px;margin:auto;padding:56px 28px 72px; }
.shop-panel { max-width:460px;margin:auto;background:#fffdf8;padding:32px;border:1px solid #dedfd1;border-radius:12px; }
.shop-shell h1 { color:#292e29;font-family:Georgia,serif;font-size:32px;margin-bottom:16px; }
.shop-shell p { color:#626a61;line-height:1.7; }
.shop-shell label { display:block;font-size:14px;margin:18px 0 8px; }
.shop-shell input:not([type=checkbox]):not([type=radio]) { width:100%;border:1px solid #c9cec2;border-radius:5px;padding:12px;background:white;color:#292e29; }
.shop-shell .shop-check { display:flex;align-items:center;gap:8px; }
.shop-button { border:0;border-radius:5px;background:#365545;color:white;padding:12px 18px;cursor:pointer;font:inherit; }
.shop-button:disabled { opacity:.6;cursor:wait; }
.shop-shell a.shop-button { color:white;display:inline-block; }
.shop-shell .shop-error { color:#8a342d;background:#fff0ea;padding:10px;border-radius:5px; }
.shop-shell .shop-success { color:#365545;background:#eef4e9;padding:10px;border-radius:5px; }
.shop-footer { max-width:1120px;margin:auto;padding:24px 28px 40px;border-top:1px solid #d9d9cd;font-size:13px;color:#626a61;line-height:1.8; }
.shop-footer span { font-size:12px; }
@media(max-width:600px) { .shop-header { flex-direction:column;align-items:flex-start;padding:22px 20px; }.shop-header nav { gap:16px;font-size:13px; }.shop-main { padding:32px 20px 48px; }.shop-panel { padding:24px 20px; }.shop-shell h1 { font-size:28px; } }
</style>
