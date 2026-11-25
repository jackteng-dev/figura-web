// Commerce V2 Phase 6：政策／說明頁、客服單、物流追蹤（契約見 figura-api docs/SUPPORT_API.md）
import api from './api'
import { customerRequest } from './customer'

export interface PublicPage { slug: string; kind: 'POLICY' | 'HELP'; published: boolean; title: string; body: string | null; publishedAt: string | null; revision: number }
export interface AdminPage { slug: string; kind: 'POLICY' | 'HELP'; status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'; draftTitle: string; draftBody: string; draftEditorId: number | null; draftUpdatedAt: string | null
  publishedTitle: string | null; publishedBody: string | null; publishedAt: string | null; publishedBy: number | null; publishedRevision: number; version: number }
export interface PageEvent { requestId: string; slug: string; actorId: number; actorUsername: string; action: string; note: string; beforeVersion: number; afterVersion: number; createdAt: string }
export interface Message { id: string; authorType: 'CUSTOMER' | 'STAFF'; staffUsername: string | null; internal: boolean; body: string; createdAt: string }
export interface Ticket { id: string; customerId: string; category: string; subject: string; orderId: string | null; preorderOrderId: string | null; status: TicketStatus; assigneeId: number | null; version: number; createdAt: string; updatedAt: string }
export type TicketStatus = 'WAITING_STAFF' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export interface TicketDetail { ticket: Ticket; messages: Message[] }
export interface TrackingEvent { id: string; code: string; description: string; source: string; occurredAt: string }
export interface Timeline { shipmentId: string; method: string; carrier: string; trackingNumber: string | null; testCarrier: boolean; events: TrackingEvent[] }

export const CATEGORY_LABELS: Record<string, string> = { ORDER: '訂單', PREORDER: '預購', SHIPPING: '配送', RETURN_DEFECT: '退換貨／瑕疵', PAYMENT: '付款', ACCOUNT: '帳號', PRODUCT: '商品', OTHER: '其他' }
export const TICKET_STATUS: Record<TicketStatus, string> = { WAITING_STAFF: '等待客服回覆', WAITING_CUSTOMER: '客服已回覆', RESOLVED: '已解決', CLOSED: '已結案' }
export const TRACKING_LABELS: Record<string, string> = { PICKED_UP: '已收件', IN_TRANSIT: '運送中', ARRIVED_STORE: '已到門市', OUT_FOR_DELIVERY: '配送中', EXCEPTION: '配送異常', RETURNED: '已退回' }
export const PAGE_STATUS: Record<AdminPage['status'], string> = { DRAFT: '草稿', IN_REVIEW: '送審中', PUBLISHED: '已發布' }

async function publicGet<T>(path: string): Promise<T> {
  const r = await fetch('/api' + path, { credentials: 'omit' })
  const body = await r.json().catch(() => ({}))
  if (!r.ok || body.code !== 0) throw Object.assign(new Error(r.status === 404 ? '找不到頁面' : '頁面暫時無法載入'), { status: r.status })
  return body.data
}
export const sitePages = () => publicGet<PublicPage[]>('/site-pages')
export const sitePage = (slug: string) => publicGet<PublicPage>('/site-pages/' + encodeURIComponent(slug))

export const myTickets = (page = 1) => customerRequest<{ items: Ticket[]; page: number; pageSize: number; total: number }>(`/support-tickets?page=${page}&pageSize=20`)
export const myTicket = (id: string) => customerRequest<TicketDetail>('/support-tickets/' + encodeURIComponent(id))
export const createTicket = (body: { requestId: string; category: string; subject: string; body: string; orderId?: string; preorderOrderId?: string }) => customerRequest<{ current: TicketDetail; replayed: boolean }>('/support-tickets', 'POST', body)
export const replyTicket = (id: string, body: { requestId: string; body: string }) => customerRequest<{ current: TicketDetail; replayed: boolean }>(`/support-tickets/${encodeURIComponent(id)}/messages`, 'POST', body)
export const myTracking = (shipmentId: string) => customerRequest<Timeline>(`/shipments/${encodeURIComponent(shipmentId)}/tracking`)

export const adminPages = async () => (await api.get<any, { data: AdminPage[] }>('/admin/site-pages')).data
export const adminPage = async (slug: string) => (await api.get<any, { data: { page: AdminPage; events: PageEvent[] } }>(`/admin/site-pages/${encodeURIComponent(slug)}`)).data
export const editPage = async (slug: string, body: { requestId: string; expectedVersion: number; title: string; body: string; note: string }) =>
  (await api.put<any, { data: { current: { page: AdminPage; events: PageEvent[] }; replayed: boolean } }>(`/admin/site-pages/${encodeURIComponent(slug)}`, body)).data
export const pageStep = async (slug: string, step: 'submit' | 'publish' | 'reject', body: { requestId: string; expectedVersion: number; note: string }) =>
  (await api.post<any, { data: { current: { page: AdminPage; events: PageEvent[] }; replayed: boolean } }>(`/admin/site-pages/${encodeURIComponent(slug)}/${step}`, body)).data
export const ticketQueue = async (status?: string, page = 1) => (await api.get<any, { data: { items: Ticket[]; page: number; pageSize: number; total: number } }>('/admin/support-tickets', { params: { status: status || undefined, page, pageSize: 20 } })).data
export const staffTicket = async (id: string) => (await api.get<any, { data: TicketDetail }>(`/admin/support-tickets/${encodeURIComponent(id)}`)).data
export const staffReply = async (id: string, body: { requestId: string; body: string; internal?: boolean }) => (await api.post<any, { data: { current: TicketDetail; replayed: boolean } }>(`/admin/support-tickets/${encodeURIComponent(id)}/messages`, body)).data
export const ticketChange = async (id: string, kind: 'status' | 'assign', body: { requestId: string; expectedVersion: number; status?: string; assigneeId?: number | null; note: string }) =>
  (await api.post<any, { data: { current: TicketDetail; replayed: boolean } }>(`/admin/support-tickets/${encodeURIComponent(id)}/${kind}`, body)).data
export const staffTracking = async (id: string) => (await api.get<any, { data: Timeline }>(`/admin/shipments/${encodeURIComponent(id)}/tracking`)).data
export const addTracking = async (id: string, body: { requestId: string; code: string; description?: string }) => (await api.post<any, { data: Timeline }>(`/admin/shipments/${encodeURIComponent(id)}/tracking`, body)).data
