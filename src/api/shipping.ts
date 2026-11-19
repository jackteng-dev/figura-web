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
  status: 'WAITING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; waitingFor: 'FEE' | 'PAYMENT' | 'BALANCE' | 'ARRIVAL' | 'REVIEW' | null
  carrier: 'TEST'; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null
  destination: { type: 'HOME' | 'CVS'; recipientName: string; phone: string; postalCode?: string; city?: string; district?: string; street?: string; storeBrand?: string; storeId?: string; storeName?: string; storeAddress?: string; test?: boolean }
  orders: ShipmentOrder[]; version: number; createdAt: string
}
export interface ShipmentEvent { requestId: string; shipmentId: string; actorId: number; actorUsername: string; action: 'SHIP' | 'DELIVER'; note: string; beforeVersion: number; afterVersion: number; trackingNumber: string; createdAt: string }
export interface ShipmentDetail { shipment: Shipment; mockEnabled: boolean; canShip: boolean; canDeliver: boolean; events: ShipmentEvent[] }
export interface ShipmentCommand { requestId: string; expectedVersion: number; note: string; waiveUnpaidFee?: boolean }
export interface MethodWrite { requestId: string; expectedVersion: number; feeTwd: number; freeThresholdTwd: number | null; enabled: boolean; note: string }

export const shipmentStatus = { WAITING: '準備中', READY: '可出貨', SHIPPED: '已出貨（測試物流）', DELIVERED: '已送達（測試物流）', CANCELLED: '已取消' } as const
export const waitingText = { FEE: '運費待店長確認', PAYMENT: '等待付款', BALANCE: '等待支付尾款', ARRIVAL: '等待預購到貨', REVIEW: '付款待核對' } as const
export const feeRule = (m: ShippingMethod) => `運費 NT$ ${m.feeTwd.toLocaleString()}${m.freeThresholdTwd ? `，滿 NT$ ${m.freeThresholdTwd.toLocaleString()} 免運` : ''}`

export const pickupStores = () => customerRequest<PickupStore[]>('/checkout/pickup-stores')
export const shippingMethods = async () => (await api.get<any, { data: ShippingMethod[] }>('/admin/shipping-methods')).data
export const updateShippingMethod = async (code: ShippingMethodCode, body: MethodWrite) => (await api.put<any, { data: { current: ShippingMethod; replayed: boolean } }>(`/admin/shipping-methods/${code}`, body)).data
export const shipments = async (page = 1) => (await api.get<any, { data: { items: Shipment[]; page: number; pageSize: number; total: number } }>('/admin/shipments', { params: { page, pageSize: 20 } })).data
export const shipmentDetail = async (id: string) => (await api.get<any, { data: ShipmentDetail }>(`/admin/shipments/${encodeURIComponent(id)}`)).data
export const shipmentCommand = async (id: string, action: 'ship' | 'deliver', body: ShipmentCommand) =>
  (await api.post<any, { data: { event: ShipmentEvent; current: ShipmentDetail; replayed: boolean } }>(`/admin/shipments/${encodeURIComponent(id)}/${action}`, body)).data
