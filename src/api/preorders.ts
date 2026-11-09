import api from '@/api/api'
import type { Page } from './catalog'

export interface Batch {
  id: string; productId: string; skuId: string; name: string; description: string
  productTitle: string; skuLabel: string; priceTwd: number; capacity: number
  heldQuantity: number; paidQuantity: number; deadlineAt: string; arrivalFrom: string; arrivalTo: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'; version: number; openedAt: string | null; closedAt: string | null
}
export interface BatchEvent {
  requestId: string; batchId: string; actorId: number; actorUsername: string; action: string
  beforeState: string | null; afterState: string; note: string; createdAt: string
}
export interface BatchWrite {
  productId: string; skuId: string; name: string; description: string; priceTwd: number; capacity: number
  deadlineAt: string; arrivalFrom: string; arrivalTo: string; expectedVersion: number; requestId: string; note: string
}
export interface BatchCommand { expectedVersion: number; requestId: string; note: string }
export interface PublicBatch {
  id: string; productId: string; name: string; description: string; productTitle: string; skuLabel: string
  priceTwd: number; availableQuota: number; deadlineAt: string; arrivalFrom: string; arrivalTo: string
  status: 'OPEN' | 'CLOSED' | 'EXPIRED'; orderingEnabled: boolean
}
type Applied = { event: BatchEvent; current: Batch; replayed: boolean }
export const batchList = async (page = 1) => (await api.get<any, { data: Page<Batch> }>('/admin/preorders', { params: { page, pageSize: 20 } })).data
export const batchDetail = async (id: string) => (await api.get<any, { data: { batch: Batch; events: BatchEvent[] } }>(`/admin/preorders/${id}`)).data
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
