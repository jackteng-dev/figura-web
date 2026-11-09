import api from '@/api/api'
import type { Page } from '@/api/catalog'
export interface InventoryBalance { skuId: string; quantity: number; reserved:number; available:number; version: number }
export interface InventoryAdjustment { requestId: string; skuId: string; actorId: number; actorUsername: string; delta: number; reason: 'RESTOCK' | 'CORRECTION' | 'DAMAGE'; note: string; beforeQuantity: number; afterQuantity: number; beforeVersion: number; afterVersion: number; createdAt: string }
export interface AdjustmentInput { requestId: string; expectedVersion: number; delta: number; reason: InventoryAdjustment['reason']; note: string }
const path = (productId: string, skuId: string) => `/admin/products/${productId}/skus/${skuId}/inventory`
export const getInventory = async (productId: string, skuId: string) => (await api.get<any, { data: InventoryBalance }>(path(productId, skuId))).data
export const getInventoryHistory = async (productId: string, skuId: string, page: number) => (await api.get<any, { data: Page<InventoryAdjustment> }>(path(productId, skuId) + '/adjustments', { params: { page, pageSize: 10 } })).data
export const adjustInventory = async (productId: string, skuId: string, input: AdjustmentInput) => (await api.post<any, { data: { adjustment: InventoryAdjustment; replayed: boolean } }>(path(productId, skuId) + '/adjustments', input)).data
export const reasonLabel = (reason: string) => ({ RESTOCK: '入庫', CORRECTION: '盤點修正', DAMAGE: '損耗' }[reason] || reason)
