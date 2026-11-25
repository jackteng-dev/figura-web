import api from './api'
import { customerRequest } from './customer'

/** Phase 5 配送：配送方式與運費、超商測試門市、出貨單（測試物流，不是實際寄送）。 */
export type ShippingMethodCode = 'HOME' | 'CVS'
export type DeliveryStrategy = 'SPLIT' | 'COMBINED'
export interface ShippingMethod { code: ShippingMethodCode; name: string; feeTwd: number; freeThresholdTwd: number | null; enabled: boolean; version: number }
export interface PickupStore { brand: string; brandName: string; storeId: string; storeName: string; address: string }
export interface ShipmentOrder { kind: 'STOCK' | 'PREORDER'; id: string; title: string; status: string; fulfillmentStatus: string }
export interface Shipment {
  id: string; method: ShippingMethodCode; methodName: string; strategy: DeliveryStrategy; feeTwd: number; goodsTwd: number
  status: 'WAITING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'MERGED'; waitingFor: 'FEE' | 'PAYMENT' | 'BALANCE' | 'ARRIVAL' | 'REVIEW' | null
  carrier: 'TEST'; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null
  destination: { type: 'HOME' | 'CVS'; recipientName: string; phone: string; postalCode?: string; city?: string; district?: string; street?: string; storeBrand?: string; storeId?: string; storeName?: string; storeAddress?: string; test?: boolean }
  orders: ShipmentOrder[]; version: number; createdAt: string
  /** Commerce V2 Phase 5：併入的出貨單、私人倉庫暫存起訖 */
  mergedInto?: string | null; heldAt?: string | null; storageUntil?: string | null
}
export interface ShipmentEvent { requestId: string; shipmentId: string; actorId: number; actorUsername: string; action: 'SHIP' | 'DELIVER'; note: string; beforeVersion: number; afterVersion: number; trackingNumber: string; createdAt: string }
export interface ShipmentDetail { shipment: Shipment; mockEnabled: boolean; canShip: boolean; canDeliver: boolean; events: ShipmentEvent[] }
export interface ShipmentCommand { requestId: string; expectedVersion: number; note: string; waiveUnpaidFee?: boolean }
export interface MethodWrite { requestId: string; expectedVersion: number; feeTwd: number; freeThresholdTwd: number | null; enabled: boolean; note: string }

export const shipmentStatus = { WAITING: '準備中', READY: '可出貨', SHIPPED: '已出貨（測試物流）', DELIVERED: '已送達（測試物流）', CANCELLED: '已取消', MERGED: '已合併' } as const
export const waitingText = { FEE: '運費待店長確認', PAYMENT: '等待付款', BALANCE: '等待支付尾款', ARRIVAL: '等待預購到貨', REVIEW: '付款待核對' } as const
export const feeRule = (m: ShippingMethod) => `運費 NT$ ${m.feeTwd.toLocaleString()}${m.freeThresholdTwd ? `，滿 NT$ ${m.freeThresholdTwd.toLocaleString()} 免運` : ''}`

export const pickupStores = () => customerRequest<PickupStore[]>('/checkout/pickup-stores')
export const shippingMethods = async () => (await api.get<any, { data: ShippingMethod[] }>('/admin/shipping-methods')).data
export const updateShippingMethod = async (code: ShippingMethodCode, body: MethodWrite) => (await api.put<any, { data: { current: ShippingMethod; replayed: boolean } }>(`/admin/shipping-methods/${code}`, body)).data
export const shipments = async (page = 1) => (await api.get<any, { data: { items: Shipment[]; page: number; pageSize: number; total: number } }>('/admin/shipments', { params: { page, pageSize: 20 } })).data
export const shipmentDetail = async (id: string) => (await api.get<any, { data: ShipmentDetail }>(`/admin/shipments/${encodeURIComponent(id)}`)).data
export const shipmentCommand = async (id: string, action: 'ship' | 'deliver', body: ShipmentCommand) =>
  (await api.post<any, { data: { event: ShipmentEvent; current: ShipmentDetail; replayed: boolean } }>(`/admin/shipments/${encodeURIComponent(id)}/${action}`, body)).data

// ---- Commerce V2 Phase 5：出貨單合併與私人倉庫（契約見 figura-api docs/WAREHOUSE_API.md） ----
export interface CustomerShipment { shipment: Shipment; canHold: boolean; canRelease: boolean; mergeable: boolean; blockedReason: string | null }
export interface ShippingAdjustment { id: string; shipmentId: string; customerId: string; beforeFeeTwd: number; afterFeeTwd: number; creditTwd: number; status: 'PENDING_REVIEW' | 'CREDITED_MOCK' | 'DISMISSED'; version: number; createdAt: string; decidedAt: string | null }
export interface OpsEvent { requestId: string; targetId: string; actorId: number; actorUsername: string; action: string; note: string; days: number | null; beforeVersion: number; afterVersion: number; createdAt: string }
export const myShipments = (page = 1) => customerRequest<{ items: CustomerShipment[]; page: number; pageSize: number; total: number; storageDays: number }>(`/shipments?page=${page}&pageSize=20`)
export const mergeShipments = (body: { requestId: string; shipments: { id: string; expectedVersion: number }[] }) => customerRequest<{ shipment: CustomerShipment; adjustment: ShippingAdjustment | null; replayed: boolean }>('/shipments/merge', 'POST', body)
export const holdShipment = (id: string, hold: boolean, body: { requestId: string; expectedVersion: number }) => customerRequest<{ shipment: CustomerShipment; replayed: boolean }>(`/shipments/${encodeURIComponent(id)}/${hold ? 'hold' : 'release'}`, 'POST', body)
export const warehouseList = async (page = 1, overdue = false) => (await api.get<any, { data: { items: { shipment: Shipment; customerId: string; overdue: boolean }[]; page: number; pageSize: number; total: number } }>('/admin/warehouse', { params: { page, pageSize: 20, overdue } })).data
export const warehouseCommand = async (id: string, action: 'release' | 'extend', body: { requestId: string; expectedVersion: number; note: string; days?: number }) =>
  (await api.post<any, { data: { event: OpsEvent; replayed: boolean } }>(`/admin/warehouse/${encodeURIComponent(id)}/${action}`, body)).data
export const adjustments = async (page = 1, status?: string) => (await api.get<any, { data: { items: ShippingAdjustment[]; page: number; pageSize: number; total: number } }>('/admin/shipping-adjustments', { params: { page, pageSize: 20, status } })).data
export const decideAdjustment = async (id: string, body: { requestId: string; expectedVersion: number; decision: 'CREDIT_MOCK' | 'DISMISS'; note: string }) =>
  (await api.post<any, { data: { event: OpsEvent; replayed: boolean } }>(`/admin/shipping-adjustments/${encodeURIComponent(id)}/decide`, body)).data
