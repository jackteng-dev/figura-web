import api from '@/api/api'

export interface ProductImage { id:string;url:string;alt:string;width:number;height:number;variants?:{url:string;width:number;height:number;contentType:string}[] }
export interface Sku { id?: string; code: string; label: string; priceTwd: number; enabled: boolean }
/** 公仔規格（Commerce V2）。null／空陣列＝未提供；不可杜撰。 */
export interface ProductSpecs {
  characterName: string | null; manufacturer: string | null; scale: string | null; heightMm: number | null; dimensions: string | null
  materials: string[]; productType: string | null; edition: string | null; limited: boolean; accessories: string[]
  releaseDate: string | null; releaseMonth: string | null; specNote: string | null
  contentOrigin: 'REAL' | 'AI_CONCEPT'; conceptMaterials: string[]
}
export type Availability = 'IN_STOCK' | 'PREORDER' | 'SOLD_OUT'
export interface PreorderSummary { batchId: string; openedAt: string | null; deadlineAt: string; arrivalFrom: string; arrivalTo: string; priceTwd: number; orderingEnabled: boolean }
export const emptySpecs = (): ProductSpecs => ({ characterName: null, manufacturer: null, scale: null, heightMm: null, dimensions: null, materials: [], productType: null, edition: null, limited: false, accessories: [], releaseDate: null, releaseMonth: null, specNote: null, contentOrigin: 'REAL', conceptMaterials: [] })
export const SCALES = ['1/1', '1/2', '1/3', '1/4', '1/5', '1/6', '1/7', '1/8', '1/10', '1/12', '1/20', '1/35', '1/60', '1/100', '1/144', 'NON_SCALE'] as const
export const scaleLabel = (v: string) => v === 'NON_SCALE' ? '無比例' : v
export const MATERIAL_LABELS: Record<string, string> = { PVC: 'PVC', ABS: 'ABS', RESIN: '樹脂', POLYSTONE: '聚石', METAL: '金屬', FABRIC: '布料', OTHER: '其他' }
export const TYPE_LABELS: Record<string, string> = { PREPAINTED: '完成品', ACTION_FIGURE: '可動模型', MODEL_KIT: '組裝模型', GARAGE_KIT: 'GK 套件', PRIZE: '景品', BLIND_BOX: '盒玩', STATUE: '雕像', PLUSH: '布偶', OTHER: '其他' }
export const EDITION_LABELS: Record<string, string> = { STANDARD: '一般版', LIMITED: '限定版', BONUS: '特典版', DELUXE: '豪華版' }
export const AVAILABILITY_LABELS: Record<Availability, string> = { IN_STOCK: '現貨', PREORDER: '預購中', SOLD_OUT: '售完' }
export interface ProductWrite { title: string; brand: string; category: string; description: string; expectedVersion: number; skus: Sku[]; brandId?:string; categoryId?:string; workId?:string|null; specs?: ProductSpecs }
export interface AdminProduct extends Omit<ProductWrite, 'expectedVersion'> { id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; version: number; image:ProductImage|null; brandId:string; categoryId:string; workId:string|null; work:string|null; specs: ProductSpecs; contentOrigin: 'REAL' | 'AI_CONCEPT' }
export interface PublicProduct { id: string; title: string; brand: string; category: string; description: string; work:string|null; image:ProductImage|null; skus: { id: string; label: string; priceTwd: number; available: boolean }[]
  specs?: ProductSpecs; contentOrigin?: 'REAL' | 'AI_CONCEPT'; availability?: Availability; minPriceTwd?: number | null; preorder?: PreorderSummary | null; updatedAt?: string | null }
/** 後端搜尋條件（GET /catalog/products）。 */
export interface ProductSearch { q?: string; brandId?: string[]; workId?: string[]; categoryId?: string[]; manufacturer?: string[]; availability?: Availability[]; priceMin?: number; priceMax?: number
  scale?: string[]; material?: string[]; productType?: string[]; edition?: string[]; limited?: boolean; sort?: string; page?: number; pageSize?: number }
export interface FacetValue { value: string; label: string; count: number }
export interface Facets { brands: FacetValue[]; works: FacetValue[]; categories: FacetValue[]; manufacturers: FacetValue[]; availability: FacetValue[]; scales: FacetValue[]; materials: FacetValue[]; productTypes: FacetValue[]; editions: FacetValue[]; priceMin: number | null; priceMax: number | null; total: number }
function searchQuery(s: ProductSearch) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    if (Array.isArray(v)) v.forEach(x => u.append(k, String(x)))
    else u.set(k, String(v))
  }
  return u.toString()
}
async function publicGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/catalog' + path, { credentials: 'same-origin', signal })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.code !== 0) throw new Error(response.status === 400 ? (result.message || '搜尋條件不正確') : '商品暫時無法載入，請稍後重試。')
  return result.data
}
export const searchProducts = (s: ProductSearch, signal?: AbortSignal) => publicGet<Page<PublicProduct>>('/products?' + searchQuery(s), signal)
export const productFacets = (s: ProductSearch, signal?: AbortSignal) => { const { sort, page, pageSize, ...rest } = s; return publicGet<Facets>('/facets?' + searchQuery(rest), signal) }
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
export function productWrite(p:AdminProduct):ProductWrite{return {title:p.title,brand:p.brand,category:p.category,description:p.description,expectedVersion:p.version,skus:p.skus.map(s=>({...s})),brandId:p.brandId,categoryId:p.categoryId,workId:p.workId,specs:{...emptySpecs(),...(p.specs||{}),materials:[...(p.specs?.materials||[])],accessories:[...(p.specs?.accessories||[])],conceptMaterials:[...(p.specs?.conceptMaterials||[])]}}}
function payload(body:ProductWrite){const {title,description,expectedVersion,skus,specs}=body;const base=body.brandId&&body.categoryId ? {title,description,expectedVersion,skus,brandId:body.brandId,categoryId:body.categoryId,workId:body.workId||null} : {title,description,expectedVersion,skus,brand:body.brand,category:body.category};return specs?{...base,specs:cleanSpecs(specs)}:base}
/** 空字串視為未提供；AI 概念商品以外不送設定材質。 */
function cleanSpecs(s:ProductSpecs){const t=(v:string|null)=>v&&v.trim()?v.trim():null;return {...s,characterName:t(s.characterName),manufacturer:t(s.manufacturer),scale:t(s.scale),dimensions:t(s.dimensions),productType:t(s.productType),edition:t(s.edition),releaseDate:t(s.releaseDate),releaseMonth:t(s.releaseMonth),specNote:t(s.specNote),heightMm:s.heightMm||null,accessories:s.accessories.map(x=>x.trim()).filter(Boolean),conceptMaterials:s.contentOrigin==='AI_CONCEPT'?s.conceptMaterials:[]}}
export const saveProduct = async (id: string | undefined, body: ProductWrite) => (id
  ? await api.put<any, { data: AdminProduct }>('/admin/products/' + id, payload(body))
  : await api.post<any, { data: AdminProduct }>('/admin/products', payload(body))).data
export const publishProduct = async (product: AdminProduct, published: boolean) => (await api.patch<any, { data: AdminProduct }>(`/admin/products/${product.id}/publication`, { expectedVersion: product.version, published })).data
export const archiveProduct = (product: AdminProduct) => api.delete('/admin/products/' + product.id, { params: { expectedVersion: product.version } })
export function catalogError(error: any): string { return error.response?.data?.message || error.message || '商品暫時無法儲存。' }
export const money = (value: number) => 'NT$ ' + new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)
