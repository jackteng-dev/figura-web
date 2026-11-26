// 購物指南與知識頁：內容由 API（GuideCatalog）提供，與給爬蟲的伺服器 HTML 同一份
export interface GuideSection { heading: string; paragraphs: string[] }
export interface GuideFaq { question: string; answer: string }
export interface Guide { slug: string; title: string; description: string; updated: string; sections: GuideSection[]; faqs: GuideFaq[] }
async function get<T>(path: string): Promise<T> {
  const r = await fetch('/api/seo' + path, { credentials: 'omit' })
  const body = await r.json().catch(() => ({}))
  if (!r.ok || body.code !== 0) throw Object.assign(new Error(r.status === 404 ? '找不到這篇指南' : '指南暫時無法載入'), { status: r.status })
  return body.data
}
export const guides = () => get<Guide[]>('/guides')
export const guide = (slug: string) => get<Guide>('/guides/' + encodeURIComponent(slug))
