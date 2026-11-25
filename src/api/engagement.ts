// Commerce V2 Phase 3：收藏、商品提醒、通知偏好、站內通知（契約見 figura-api docs/ENGAGEMENT_API.md）
import { customerRequest } from '@/api/customer'
import type { PublicProduct } from '@/api/catalog'

export type AlertKind = 'RESTOCK' | 'PREORDER_OPEN' | 'PREORDER_CLOSING' | 'RELEASE'
export const ALERT_LABELS: Record<AlertKind, string> = { RESTOCK: '補貨（有現貨時）', PREORDER_OPEN: '開放預購', PREORDER_CLOSING: '預購截止前 48 小時', RELEASE: '到了預計發售時間' }
export interface Favorite { product: PublicProduct; favoritedAt: string; alerts: AlertKind[] }
export interface FavoritePage { items: Favorite[]; page: number; pageSize: number; total: number }
export interface ProductAlert { productId: string; title: string; kinds: AlertKind[]; availability: string | null }
export interface Preferences { emailEnabled: boolean; orderUpdates: boolean; productAlerts: boolean; emailVerified: boolean; emailDeliveryActive: boolean; version: number }
export interface Notice { id: string; kind: string; category: 'ORDER' | 'PRODUCT'; title: string; message: string; orderId: string | null; preorderOrderId: string | null; productId: string | null; createdAt: string; readAt: string | null }
export interface Inbox { items: Notice[]; page: number; pageSize: number; total: number; unread: number }

export const favorites = (page = 1, pageSize = 20) => customerRequest<FavoritePage>(`/favorites?page=${page}&pageSize=${pageSize}`)
export const favoriteIds = () => customerRequest<{ productIds: string[] }>('/favorites/ids')
export const addFavorite = (id: string) => customerRequest<{ productIds: string[] }>('/favorites/' + id, 'PUT')
export const removeFavorite = (id: string) => customerRequest<{ productIds: string[] }>('/favorites/' + id, 'DELETE')
export const mergeFavorites = (productIds: string[]) => customerRequest<{ merged: string[]; skipped: string[]; total: number }>('/favorites/merge', 'POST', { productIds })
export const productAlerts = () => customerRequest<ProductAlert[]>('/product-alerts')
export const setProductAlerts = (id: string, kinds: AlertKind[]) => customerRequest<AlertKind[]>('/product-alerts/' + id, 'PUT', { kinds })
export const preferences = () => customerRequest<Preferences>('/notification-preferences')
export const savePreferences = (p: Pick<Preferences, 'emailEnabled' | 'orderUpdates' | 'productAlerts'> & { expectedVersion: number }) => customerRequest<Preferences>('/notification-preferences', 'PUT', p)
export const inbox = (page = 1, pageSize = 20, unread = false) => customerRequest<Inbox>(`/notifications?page=${page}&pageSize=${pageSize}&unread=${unread}`)
export const markRead = (body: { ids: string[] } | { all: true }) => customerRequest<{ updated: number; unread: number }>('/notifications/read', 'POST', body)
