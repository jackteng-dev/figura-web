import api from './api'
import type { Page } from './catalog'
import type { PreorderOrder } from './preorderOrders'
export interface Supply { batchId: string; batchName: string; status: string; version: number; capacity: number; receivedQuantity: number; allocatedQuantity: number; shippedQuantity: number; unallocatedQuantity: number; onHandQuantity: number }
export interface FulfillmentEvent { requestId: string; batchId: string; orderId: string | null; actorId: number; actorUsername: string; action: 'RECEIVE' | 'ALLOCATE' | 'SHIP' | 'DELIVER'; note: string; quantity: number; receivedBefore: number; receivedAfter: number; allocatedBefore: number; allocatedAfter: number; shippedBefore: number; shippedAfter: number; batchVersionBefore: number; batchVersionAfter: number; orderVersionBefore: number | null; orderVersionAfter: number | null; trackingNumber: string | null; createdAt: string }
export interface BatchDetail { supply: Supply; events: FulfillmentEvent[] }
export interface Fulfillment { supply: Supply; mockEnabled: boolean; canAllocate: boolean; canShip: boolean; canDeliver: boolean; events: FulfillmentEvent[] }
export interface ReceiveBody { requestId: string; expectedBatchVersion: number; quantity: number; note: string }
export interface FulfillmentBody { requestId: string; expectedOrderVersion: number; expectedBatchVersion?: number; note: string }
export const arrivalList = async (page = 1) => (await api.get<any, { data: Page<Supply> }>('/admin/preorder-arrivals', { params: { page, pageSize: 20 } })).data
export const arrivalDetail = async (id: string) => (await api.get<any, { data: BatchDetail }>(`/admin/preorder-arrivals/${encodeURIComponent(id)}`)).data
export const receivePreorder = async (id: string, body: ReceiveBody) => (await api.post<any, { data: { event: FulfillmentEvent; current: BatchDetail; replayed: boolean } }>(`/admin/preorder-arrivals/${encodeURIComponent(id)}/receive`, body)).data
export const fulfillPreorder = async (id: string, action: 'allocate' | 'mock-ship' | 'mock-deliver', body: FulfillmentBody) => (await api.post<any, { data: { event: FulfillmentEvent; order: PreorderOrder; current: Fulfillment; replayed: boolean } }>(`/admin/preorder-orders/${encodeURIComponent(id)}/${action}`, body)).data
export const fulfillmentActions = { RECEIVE: '到貨登記', ALLOCATE: '整筆分配', SHIP: '模擬出貨', DELIVER: '模擬送達' }
