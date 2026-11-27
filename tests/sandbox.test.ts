// node --test（Node 22.6+ 內建 TypeScript type stripping，不需要額外套件）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig, hasSandboxEntries, accountKind, securityView, remaining, NO_SANDBOX } from '../src/utils/sandbox.ts'

test('正式模式（404／錯誤／空回應）不顯示任何沙盒入口', () => {
  for (const raw of [undefined, null, {}, { data: null }, { data: 'x' }]) assert.equal(hasSandboxEntries(normalizeConfig(raw)), false)
  assert.equal(hasSandboxEntries(NO_SANDBOX), false)
})
test('只有布林 true 才顯示入口', () => {
  assert.deepEqual(normalizeConfig({ data: { quickDemo: 'true', mfaDemo: 1 } }), { quickDemo: false, mfaDemo: false, mfaDemoTtlMinutes: null })
  const c = normalizeConfig({ data: { quickDemo: true, mfaDemo: true, mfaDemoTtlMinutes: 60 } })
  assert.equal(c.quickDemo, true); assert.equal(c.mfaDemo, true); assert.equal(c.mfaDemoTtlMinutes, 60); assert.equal(hasSandboxEntries(c), true)
  assert.equal(hasSandboxEntries(normalizeConfig({ data: { quickDemo: false, mfaDemo: true } })), true)
})
test('accountKind 三種畫面', () => {
  assert.deepEqual(securityView(accountKind('STAFF')), { canManage: true, sharedNotice: false, showCountdown: false })
  assert.deepEqual(securityView(accountKind('SANDBOX_SHARED')), { canManage: false, sharedNotice: true, showCountdown: false })
  assert.deepEqual(securityView(accountKind('SANDBOX_MFA_DEMO')), { canManage: true, sharedNotice: false, showCountdown: true })
  assert.equal(accountKind(undefined), 'STAFF'); assert.equal(accountKind('sandbox_shared'), 'STAFF')
})
test('到期倒數', () => {
  const now = Date.parse('2026-11-26T10:00:00+08:00')
  assert.equal(remaining('2026-11-26T10:05:09+08:00', now), '05:09')
  assert.equal(remaining('2026-11-26T11:00:01+08:00', now), '1:00:01')
  assert.equal(remaining('2026-11-26T09:59:59+08:00', now), null)
  assert.equal(remaining(undefined, now), null); assert.equal(remaining('bad', now), null)
})
