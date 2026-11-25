// Commerce V2 Phase 7：營運報表、低庫存、營運狀態（契約見 figura-api docs/OPS_SECURITY.md）
import api from './api'
export interface SalesReport { from: string; to: string; revenue: { source: string; label: string; real: boolean; orders: number; amountTwd: number }[]; realRevenueTwd: number
  topProducts: { productId: string; title: string; quantity: number; amountTwd: number }[]; note: string }
export interface LowStockRow { productId: string; title: string; status: string; skuId: string; label: string; quantity: number; reserved: number; available: number }
export interface OpsStatus { database: boolean; redis: boolean; notifications: Record<string, number>; warehouseOverdue: number; adjustmentsPending: number; ticketsWaiting: number
  pagesInReview: number; serverErrors: number; recentErrors: Record<string, string>[]; checkedAt: string }
export const salesReport = async (from: string, to: string) => (await api.get<any, { data: SalesReport }>('/admin/reports/sales', { params: { from, to } })).data
export const lowStock = async (threshold: number) => (await api.get<any, { data: LowStockRow[] }>('/admin/reports/low-stock', { params: { threshold } })).data
export const opsStatus = async () => (await api.get<any, { data: OpsStatus }>('/admin/ops/status')).data
