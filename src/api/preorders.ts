import api from '@/api/api'
import type { Page } from './catalog'

export interface Batch {
  id: string; productId: string; skuId: string; name: string; description: string
  productTitle: string; skuLabel: string; priceTwd: number; capacity: number
  heldQuantity: number; paidQuantity: number; deadlineAt: string; arrivalFrom: string; arrivalTo: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'; version: number; openedAt: string | null; closedAt: string | null
  /** 付款條件：FULL 全額；DEPOSIT 每件訂金 depositTwd，到貨通知後 balanceDays 天內付尾款 */
  paymentMode: PaymentMode; depositTwd: number | null; balanceDays: number | null; balanceCalledAt: string | null; receivedQuantity: number
}
export type PaymentMode = 'FULL' | 'DEPOSIT'
/** 時程／尾款通知稽核（員工）。publicReason 會給顧客看，note 只在後台。 */
export interface ScheduleEvent {
  requestId: string; batchId: string; actorId: number; actorUsername: string; action: 'DELAY' | 'ADJUST' | 'BALANCE_CALL'
  publicReason: string; note: string; arrivalFromBefore: string; arrivalToBefore: string; arrivalFromAfter: string; arrivalToAfter: string
  balanceDueAt: string | null; affectedOrders: number; batchVersionBefore: number; batchVersionAfter: number; createdAt: string
}
export interface ScheduleNotice { action: 'DELAY' | 'ADJUST'; publicReason: string; arrivalFromBefore: string; arrivalToBefore: string; arrivalFromAfter: string; arrivalToAfter: string; createdAt: string }
export interface ScheduleWrite { expectedVersion: number; requestId: string; arrivalFrom: string; arrivalTo: string; publicReason: string; note: string }
export interface BalanceCallWrite { expectedVersion: number; requestId: string; publicReason: string; note: string }
export interface BatchEvent {
  requestId: string; batchId: string; actorId: number; actorUsername: string; action: string
  beforeState: string | null; afterState: string; note: string; createdAt: string
}
export interface BatchWrite {
  productId: string; skuId: string; name: string; description: string; priceTwd: number; capacity: number
  deadlineAt: string; arrivalFrom: string; arrivalTo: string; expectedVersion: number; requestId: string; note: string
  paymentMode?: PaymentMode; depositTwd?: number; balanceDays?: number
}
export interface BatchCommand { expectedVersion: number; requestId: string; note: string }
export interface PublicBatch {
  id: string; productId: string; name: string; description: string; productTitle: string; skuLabel: string
  priceTwd: number; availableQuota: number; deadlineAt: string; arrivalFrom: string; arrivalTo: string
  status: 'OPEN' | 'CLOSED' | 'EXPIRED'; orderingEnabled: boolean
  paymentMode: PaymentMode; depositTwd: number | null; balanceDays: number | null
}
/** 顧客可讀的付款條件說明 */
export const termsText = (b: { paymentMode: PaymentMode; depositTwd: number | null; balanceDays: number | null }) =>
  b.paymentMode === 'DEPOSIT' && b.depositTwd ? `訂金 NT$ ${b.depositTwd.toLocaleString()}／件，到貨通知後 ${b.balanceDays} 天內付尾款` : '下單時付清全額'
type Applied = { event: BatchEvent; current: Batch; replayed: boolean }
export const batchList = async (page = 1) => (await api.get<any, { data: Page<Batch> }>('/admin/preorders', { params: { page, pageSize: 20 } })).data
export const batchDetail = async (id: string) => (await api.get<any, { data: { batch: Batch; events: BatchEvent[]; schedules: ScheduleEvent[] } }>(`/admin/preorders/${id}`)).data
export type ScheduleApplied = { event: ScheduleEvent; current: Batch; replayed: boolean }
export const batchSchedule = async (id: string, body: ScheduleWrite) => (await api.post<any, { data: ScheduleApplied }>(`/admin/preorders/${id}/schedule`, body)).data
export const batchBalanceCall = async (id: string, body: BalanceCallWrite) => (await api.post<any, { data: ScheduleApplied }>(`/admin/preorders/${id}/balance-call`, body)).data
export const batchSave = async (id: string | undefined, body: BatchWrite) => (id
  ? await api.put<any, { data: Applied }>(`/admin/preorders/${id}`, body)
  : await api.post<any, { data: Applied }>('/admin/preorders', body)).data
export const batchCommand = async (id: string, action: 'OPEN' | 'CLOSE', body: BatchCommand) =>
  (await api.post<any, { data: Applied }>(`/admin/preorders/${id}/${action.toLowerCase()}`, body)).data
async function publicRead<T>(path: string): Promise<T> {
  const response = await fetch('/api/catalog/preorders' + path, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok || result.code !== 0) throw new Error(response.status === 404 ? '找不到預購批次，可能尚未開放或商品已下架。' : '預購資料暫時無法載入，請重試。')
  return result.data
}
export const publicBatches = (page = 1) => publicRead<Page<PublicBatch>>(`?page=${page}&pageSize=12`)
export const publicBatch = (id: string) => publicRead<PublicBatch>('/' + encodeURIComponent(id))
export function taipeiTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value))
}
