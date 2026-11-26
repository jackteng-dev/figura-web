// Commerce V2 Phase 4：用戶端 head 管理。標題、描述、canonical、robots、OG 與 JSON-LD 都向 /api/seo/meta 取得，
// 與 nginx SSI 給爬蟲的伺服器版本同一來源；SPA 換頁時更新，避免各頁各寫一份規則。
import type { Router } from 'vue-router'

interface SeoMeta { title: string; description: string; canonical: string; index: boolean; ogType: string; image: string | null; jsonLd: unknown[]; found: boolean }
const BASE = 'https://figura.jackteng.dev'

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (content == null) { el?.remove(); return }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); el.dataset.seo = ''; document.head.appendChild(el) }
  el.content = content
}
function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) { el?.remove(); return }
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el) }
  el.href = href
}
export function applySeo(m: SeoMeta) {
  document.title = m.title
  setMeta('name', 'description', m.description)
  setMeta('name', 'robots', m.index ? 'index,follow,max-image-preview:large' : 'noindex,follow')
  setCanonical(m.index ? BASE + m.canonical : null)
  setMeta('property', 'og:title', m.title); setMeta('property', 'og:description', m.description); setMeta('property', 'og:type', m.ogType)
  setMeta('property', 'og:url', BASE + m.canonical); setMeta('property', 'og:image', m.image)
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove())
  for (const ld of m.jsonLd) { const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s) }
}
/** 非商店頁（員工後台等）：不索引，不打 API。 */
function privatePage(title: string) { applySeo({ title, description: 'Figura 員工管理後台。', canonical: '/', index: false, ogType: 'website', image: null, jsonLd: [], found: true }) }

let seq = 0
export function installSeo(router: Router) {
  router.afterEach(async to => {
    const n = ++seq
    if (!to.path.startsWith('/shop')) { privatePage(typeof to.meta.title === 'string' ? to.meta.title + '｜Figura' : 'Figura 管理後台'); return }
    try {
      const r = await fetch('/api/seo/meta?path=' + encodeURIComponent(to.fullPath), { credentials: 'omit' })
      const body = await r.json()
      if (n === seq && r.ok && body.code === 0) applySeo(body.data)
    } catch { /* 取不到就保留目前 head */ }
  })
}
