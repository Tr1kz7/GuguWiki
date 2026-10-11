import { ApiError, ErrorCode, parseChatEvent, type ChatEventDto, type DemoScenario, type ResultDto, type RetrievalConfigDto } from '../contracts'
import type { GuguApi } from './types'

const errorCategoryForStatus = (status: number) => ({
  400: ErrorCode.VALIDATION_ERROR, 401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN, 404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
} as Record<number, ErrorCode>)[status] ?? ErrorCode.INTERNAL_ERROR

function isResult(value: unknown): value is ResultDto<unknown> {
  return typeof value === 'object' && value !== null
    && Number.isInteger((value as ResultDto<unknown>).code)
    && 'data' in value
    && ((value as ResultDto<unknown>).message === null || typeof (value as ResultDto<unknown>).message === 'string')
}

function responseError(value: unknown, httpStatus: number, fallbackMessage: string): ApiError {
  const payload = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const status = httpStatus >= 400 ? httpStatus : typeof payload.code === 'number' ? payload.code : 500
  return new ApiError(errorCategoryForStatus(status), typeof payload.message === 'string' ? payload.message : fallbackMessage, status)
}

/** HTTP adapter unwraps Result.data so the UI and MockApi share the same DTO interface. */
export class HttpApi implements GuguApi {
  private token: string | null
  constructor(private baseUrl = import.meta.env.VITE_API_BASE_URL ?? '') {
    this.token = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('guguwiki-token')
  }
  private authHeaders(): Record<string, string> { return this.token ? { Authorization: this.token } : {} }
  private clearToken() {
    this.token = null
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('guguwiki-token')
  }
  private async request<T>(method: string, path: string, body?: unknown, allowNoData = false): Promise<T> {
    const form = body instanceof FormData
    const headers: Record<string, string> = this.authHeaders()
    if (!form && body !== undefined) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    })
    if (response.status === 204) {
      if (!allowNoData) throw new ApiError(ErrorCode.INTERNAL_ERROR, '接口缺少预期的响应数据。', 502)
      return undefined as T
    }
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401) this.clearToken()
      throw responseError(result, response.status, response.statusText || '请求失败。')
    }
    if (!isResult(result)) throw new ApiError(ErrorCode.INTERNAL_ERROR, '响应缺少 Result 格式。', 502)
    if (result.code >= 400) throw responseError(result, response.status, '请求失败。')
    if (result.code === 204 && result.data === null) {
      if (!allowNoData) throw new ApiError(ErrorCode.INTERNAL_ERROR, '接口缺少预期的业务数据。', 502)
      return undefined as T
    }
    if (result.code !== 200 || result.data === null) throw new ApiError(ErrorCode.INTERNAL_ERROR, '响应 code 或 data 无效。', 502)
    if (path === '/api/v1/auth/login') {
      if (!result.token) throw new ApiError(ErrorCode.INTERNAL_ERROR, '登录响应缺少 Token。', 502)
      this.token = result.token
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('guguwiki-token', result.token)
    }
    return result.data as T
  }
  login(email: string, password: string, entry: 'READER' | 'ADMIN') { return this.request<Awaited<ReturnType<GuguApi['login']>>>('POST', '/api/v1/auth/login', { email, password, entry }) }
  async me() { try { return await this.request<Awaited<ReturnType<GuguApi['me']>>>('GET', '/api/v1/auth/me') } catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error } }
  async logout() { await this.request<void>('POST', '/api/v1/auth/logout', undefined, true); this.clearToken() }
  listKnowledgeBases() { return this.request<Awaited<ReturnType<GuguApi['listKnowledgeBases']>>>('GET', '/api/v1/knowledge-bases') }
  createKnowledgeBase(name: string, description: string) { return this.request<Awaited<ReturnType<GuguApi['createKnowledgeBase']>>>('POST', '/api/v1/admin/knowledge-bases', { name, description }) }
  listFolders(knowledgeBaseId?: string) { return this.request<Awaited<ReturnType<GuguApi['listFolders']>>>('GET', `/api/v1/folders${knowledgeBaseId ? `?knowledgeBaseId=${encodeURIComponent(knowledgeBaseId)}` : ''}`) }
  createFolder(knowledgeBaseId: string, parentId: string | null, title: string) { return this.request<Awaited<ReturnType<GuguApi['createFolder']>>>('POST', '/api/v1/admin/folders', { knowledgeBaseId, parentId, title }) }
  listDocuments(knowledgeBaseId?: string) { return this.request<Awaited<ReturnType<GuguApi['listDocuments']>>>('GET', `/api/v1/documents${knowledgeBaseId ? `?knowledgeBaseId=${encodeURIComponent(knowledgeBaseId)}` : ''}`) }
  getDocument(id: string) { return this.request<Awaited<ReturnType<GuguApi['getDocument']>>>('GET', `/api/v1/documents/${encodeURIComponent(id)}`) }
  async downloadOriginal(id: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/documents/${encodeURIComponent(id)}/original`, { headers: this.authHeaders() })
    if (!response.ok) throw responseError(await response.json().catch(() => null), response.status, '无法读取 PDF 原件。')
    return response.blob()
  }
  createDocument(knowledgeBaseId: string, parentId: string | null, title: string) { return this.request<Awaited<ReturnType<GuguApi['createDocument']>>>('POST', '/api/v1/admin/documents', { knowledgeBaseId, parentId, title }) }
  saveDraft(id: string, expectedRevision: number, title: string, content: string) { return this.request<Awaited<ReturnType<GuguApi['saveDraft']>>>('PUT', `/api/v1/admin/documents/${encodeURIComponent(id)}/draft`, { expectedRevision, title, content }) }
  search(query: string) { return this.request<Awaited<ReturnType<GuguApi['search']>>>('GET', `/api/v1/search?q=${encodeURIComponent(query)}`) }
  listUsers() { return this.request<Awaited<ReturnType<GuguApi['listUsers']>>>('GET', '/api/v1/admin/users') }
  createUser(name: string, email: string, role: 'READER' | 'ADMIN', initialPassword: string) { return this.request<Awaited<ReturnType<GuguApi['createUser']>>>('POST', '/api/v1/admin/users', { name, email, role, initialPassword }) }
  listConversations() { return this.request<Awaited<ReturnType<GuguApi['listConversations']>>>('GET', '/api/v1/conversations') }
  createConversation() { return this.request<Awaited<ReturnType<GuguApi['createConversation']>>>('POST', '/api/v1/conversations', {}) }
  renameConversation(id: string, title: string) { return this.request<Awaited<ReturnType<GuguApi['renameConversation']>>>('PATCH', `/api/v1/conversations/${encodeURIComponent(id)}`, { title }) }
  deleteConversation(id: string) { return this.request<void>('DELETE', `/api/v1/conversations/${encodeURIComponent(id)}`, undefined, true) }
  getConversation(id: string) { return this.request<Awaited<ReturnType<GuguApi['getConversation']>>>('GET', `/api/v1/conversations/${encodeURIComponent(id)}`) }
  createRun(conversationId: string, question: string) { return this.request<Awaited<ReturnType<GuguApi['createRun']>>>('POST', `/api/v1/conversations/${encodeURIComponent(conversationId)}/runs`, { question }) }
  async *streamRun(runId: string): AsyncIterable<ChatEventDto> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat/runs/${encodeURIComponent(runId)}/events`, { headers: { ...this.authHeaders(), Accept: 'text/event-stream' } })
    if (!response.ok || !response.body) {
      throw responseError(await response.json().catch(() => null), response.status, '无法建立事件流。')
    }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n')
        let end: number
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end); buffer = buffer.slice(end + 2)
          const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
          if (data) {
            const event = parseChatEvent(JSON.parse(data))
            const wireId = block.split('\n').find(line => line.startsWith('id:'))?.slice(3).trim()
            if (wireId && wireId !== event.eventId) throw new ApiError(ErrorCode.INTERNAL_ERROR, 'SSE 事件 ID 不一致。', 502)
            yield event
          }
        }
      }
    } finally { reader.releaseLock() }
  }
  cancelRun(runId: string) { return this.request<Awaited<ReturnType<GuguApi['cancelRun']>>>('POST', `/api/v1/chat/runs/${encodeURIComponent(runId)}/cancel`, {}) }
  getRun(runId: string) { return this.request<Awaited<ReturnType<GuguApi['getRun']>>>('GET', `/api/v1/chat/runs/${encodeURIComponent(runId)}`) }
  importFile(knowledgeBaseId: string, parentId: string | null, file: File) {
    const form = new FormData(); form.set('knowledgeBaseId', knowledgeBaseId); if (parentId) form.set('parentId', parentId); form.set('file', file)
    return this.request<Awaited<ReturnType<GuguApi['importFile']>>>('POST', '/api/v1/admin/imports', form)
  }
  getImportJob(id: string) { return this.request<Awaited<ReturnType<GuguApi['getImportJob']>>>('GET', `/api/v1/admin/imports/${encodeURIComponent(id)}`) }
  startPublish(documentId: string, expectedDraftRevision: number) { return this.request<Awaited<ReturnType<GuguApi['startPublish']>>>('POST', `/api/v1/admin/documents/${encodeURIComponent(documentId)}/publish`, { expectedDraftRevision }) }
  getPublishJob(id: string) { return this.request<Awaited<ReturnType<GuguApi['getPublishJob']>>>('GET', `/api/v1/admin/publish-jobs/${encodeURIComponent(id)}`) }
  getActiveStrategy() { return this.request<Awaited<ReturnType<GuguApi['getActiveStrategy']>>>('GET', '/api/v1/retrieval/strategy') }
  debugQuery(query: string, config: RetrievalConfigDto) { return this.request<Awaited<ReturnType<GuguApi['debugQuery']>>>('POST', '/api/v1/admin/retrieval/debug', { query, config }) }
  listDatasets() { return this.request<Awaited<ReturnType<GuguApi['listDatasets']>>>('GET', '/api/v1/admin/evaluation/datasets') }
  createEvaluationSnapshot(datasetId: string) { return this.request<Awaited<ReturnType<GuguApi['createEvaluationSnapshot']>>>('POST', '/api/v1/admin/evaluation/snapshots', { datasetId }) }
  runEvaluation(snapshotId: string, name: string, config: RetrievalConfigDto) { return this.request<Awaited<ReturnType<GuguApi['runEvaluation']>>>('POST', '/api/v1/admin/evaluation/runs', { snapshotId, name, config }) }
  listEvaluationRuns() { return this.request<Awaited<ReturnType<GuguApi['listEvaluationRuns']>>>('GET', '/api/v1/admin/evaluation/runs') }
  activateStrategy(runId: string) { return this.request<Awaited<ReturnType<GuguApi['activateStrategy']>>>('POST', `/api/v1/admin/evaluation/runs/${encodeURIComponent(runId)}/activate`, {}) }
  async getDemoState() { return null }
  async setDemoScenario(_scenario: DemoScenario): Promise<never> { throw new ApiError(ErrorCode.NOT_FOUND, 'HTTP 模式没有演示控制。', 404) }
  async resetDemo(): Promise<void> { throw new ApiError(ErrorCode.NOT_FOUND, 'HTTP 模式没有演示控制。', 404) }
}
