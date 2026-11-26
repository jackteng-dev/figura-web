// 頁首未讀通知數：登入時讀一次，通知頁操作後更新
import { ref } from 'vue'
import { inbox } from '@/api/engagement'
export const unreadCount = ref(0)
export async function refreshUnread() {
  try { unreadCount.value = (await inbox(1, 1, true)).unread } catch { unreadCount.value = 0 }
}
