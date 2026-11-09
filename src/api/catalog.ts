import api from '@/api/api'

export interface ProductImage { id:string;url:string;alt:string;width:number;height:number }
export interface Sku { id?: string; code: string; label: string; priceTwd: number; enabled: boolean }
export interface ProductWrite { title: string; brand: string; category: string; description: string; expectedVersion: number; skus: Sku[]; brandId?:string; categoryId?:string; workId?:string|null }
export interface AdminProduct extends Omit<ProductWrite, 'expectedVersion'> { id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; version: number; image:ProductImage|null; brandId:string; categoryId:string; workId:string|null; work:string|null }
export interface PublicProduct { id: string; title: string; brand: string; category: string; description: string; work:string|null; image:ProductImage|null; skus: { id: string; label: string; priceTwd: number; available: boolean }[] }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

// Public reads never enter the staff refresh / redirect interceptor.
async function publicRead<T>(path: string): Promise<T> {
  const response = await fetch('/api/catalog/products' + path, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok || result.code !== 0) throw new Error(response.status === 404 ? '找不到商品，可能已下架。' : '商品暫時無法載入，請稍後重試。')
  return result.data
}
export const publicProducts = (page: number) => publicRead<Page<PublicProduct>>(`?page=${page}&pageSize=12`)
export const publicProduct = (id: string) => publicRead<PublicProduct>('/' + encodeURIComponent(id))
export const adminProducts = async (page: number) => (await api.get<any, { data: Page<AdminProduct> }>('/admin/products', { params: { page, pageSize: 12 } })).data
export const adminProduct = async (id: string) => (await api.get<any, { data: AdminProduct }>('/admin/products/' + id)).data
export function productWrite(p:AdminProduct):ProductWrite{return {title:p.title,brand:p.brand,category:p.category,description:p.description,expectedVersion:p.version,skus:p.skus.map(s=>({...s})),brandId:p.brandId,categoryId:p.categoryId,workId:p.workId}}
function payload(body:ProductWrite){const {title,description,expectedVersion,skus}=body;return body.brandId&&body.categoryId ? {title,description,expectedVersion,skus,brandId:body.brandId,categoryId:body.categoryId,workId:body.workId||null} : {title,description,expectedVersion,skus,brand:body.brand,category:body.category}}
export const saveProduct = async (id: string | undefined, body: ProductWrite) => (id
  ? await api.put<any, { data: AdminProduct }>('/admin/products/' + id, payload(body))
  : await api.post<any, { data: AdminProduct }>('/admin/products', payload(body))).data
export const publishProduct = async (product: AdminProduct, published: boolean) => (await api.patch<any, { data: AdminProduct }>(`/admin/products/${product.id}/publication`, { expectedVersion: product.version, published })).data
export const archiveProduct = (product: AdminProduct) => api.delete('/admin/products/' + product.id, { params: { expectedVersion: product.version } })
export function catalogError(error: any): string { return error.response?.data?.message || error.message || '商品暫時無法儲存。' }
export const money = (value: number) => 'NT$ ' + new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)
