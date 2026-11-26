// 雙因素備援碼文件：只在瀏覽器端用當次 API 回應產生，不經伺服器、不放在 URL、不寫入 localStorage／sessionStorage。
export const RECOVERY_FILE_NAME = 'Figura-MFA-Recovery-Codes.txt'

export interface RecoveryBatch { username: string; generatedAt: string; codes: string[] }

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 文件內容（UTF-8 純文字，Windows 換行）。 */
export function recoveryText(b: RecoveryBatch): string {
  const lines = [
    'Figura 員工後台 雙因素驗證備援碼',
    '================================',
    '',
    `員工帳號：${b.username}`,
    `產生日期：${formatTime(b.generatedAt)}`,
    '',
    '備援碼（每組只能使用一次）：',
    ...b.codes.map((c, i) => `  ${String(i + 1).padStart(2, ' ')}. ${c}`),
    '',
    '安全保存提醒：',
    '- 手機遺失或無法使用驗證器 App 時，可在登入的驗證碼欄位輸入任一組備援碼。',
    '- 每組只能使用一次；重新產生備援碼後，這份文件中的所有備援碼立即失效。',
    '- 請存放在密碼管理工具或離線的安全位置，不要寄送、分享或上傳到雲端相簿。',
    '- 列印後請妥善收存；不再需要時請徹底刪除或銷毀。',
    '- 備援碼與驗證器 App 都遺失時，請聯絡系統管理員重設雙因素。',
    '',
  ]
  return lines.join('\r\n')
}

/**
 * 觸發瀏覽器下載。回傳 true 只代表「已觸發下載」，無法確認使用者是否真的存到安全位置。
 * Blob URL 只在本次點擊內存在，觸發後立即釋放。
 */
export function downloadRecoveryCodes(b: RecoveryBatch): boolean {
  try {
    const blob = new Blob([recoveryText(b)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = RECOVERY_FILE_NAME; a.rel = 'noopener'; a.style.display = 'none'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
