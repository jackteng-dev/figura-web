<script setup lang="ts">
// Facebook／LINE 登入按鈕。目前只顯示，按下不做任何事；
// 取得 Meta／LINE 開發者金鑰並在後端啟用後，再接上 OAuth 導向。
</script>
<template>
  <div class="social">
    <div class="divider"><span>或使用其他方式</span></div>
    <div class="buttons">
      <button type="button" class="sbtn fb" aria-label="使用 Facebook 登入" title="使用 Facebook 登入">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path fill="#fff" d="M13.4 19v-6.2h2.1l.3-2.4h-2.4V8.9c0-.7.2-1.2 1.2-1.2h1.3V5.6c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.7v2.4h2.1V19h2.6z" /></svg>
      </button>
      <button type="button" class="sbtn line" aria-label="使用 LINE 登入" title="使用 LINE 登入">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#06C755" /><path fill="#fff" d="M12 5.6c-4 0-7.2 2.6-7.2 5.8 0 2.9 2.6 5.3 6 5.7.2 0 .6.2.7.4.1.2 0 .5 0 .7l-.1.6c0 .2-.2.7.6.4.8-.3 4.2-2.5 5.7-4.2 1-1.1 1.5-2.3 1.5-3.6 0-3.2-3.2-5.8-7.2-5.8z" /><path fill="#06C755" d="M8.3 9.8v3.3h1.9v-.6H9v-2.7zm2.4 0h.6v3.3h-.6zm1.4 0v3.3h.6v-2l1.4 2h.6V9.8h-.6v2l-1.4-2zm3.1 0v3.3h1.9v-.6h-1.3v-.7h1.3v-.6h-1.3v-.7h1.3v-.7z" /></svg>
      </button>
    </div>
  </div>
</template>
<style scoped>
.social { margin-top: 20px; }
.divider { display: flex; align-items: center; gap: 12px; color: #6b7080; font-size: 13px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e3e5ec; }
.buttons { display: flex; justify-content: center; gap: 18px; margin-top: 16px; }
.sbtn { width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; cursor: pointer; }
.sbtn svg { width: 44px; height: 44px; display: block; }
.sbtn:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 3px; }
</style>
