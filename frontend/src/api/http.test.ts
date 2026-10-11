import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorCode } from '../contracts'
import { HttpApi } from './http'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

afterEach(() => vi.unstubAllGlobals())

describe('HTTP Result response contract', () => {
  it('unwraps data for the UI', async () => {
    const user = { id: 'user-1', name: '读者', email: 'reader@example.com', role: 'READER' }
    const stored = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: user, message: '', token: 'random-token' }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: user, message: null }))
    vi.stubGlobal('fetch', fetchMock)

    const api = new HttpApi('')
    await expect(api.login('reader@example.com', 'password', 'READER')).resolves.toEqual(user)
    await expect(new HttpApi('').me()).resolves.toEqual(user)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('random-token')
  })

  it('accepts a no-data success envelope', async () => {
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 204, data: null, message: '' })))

    await expect(new HttpApi('').logout()).resolves.toBeUndefined()
  })

  it('uses the numeric status and message without an errorCode field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 503, data: null, message: '全文检索不可用',
    }, 503)))

    await expect(new HttpApi('').listKnowledgeBases()).rejects.toMatchObject({
      status: 503, message: '全文检索不可用',
    })
  })

  it('rejects an unwrapped success body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'kb-1' })))

    await expect(new HttpApi('').listKnowledgeBases()).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR, status: 502,
    })
  })
})
