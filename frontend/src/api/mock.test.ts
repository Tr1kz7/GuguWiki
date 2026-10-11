import { describe, expect, it } from 'vitest'
import { ApiError, ErrorCode, JobStatus, RunStatus, defaultConfig, parseChatEvent } from '../contracts'
import { MockApi } from './mock'

const admin = (api: MockApi) => api.login('admin@guguwiki.dev', 'demo123', 'ADMIN')
const reader = (api: MockApi) => api.login('reader@guguwiki.dev', 'demo123', 'READER')
const collect = async <T,>(iterable: AsyncIterable<T>) => { const result: T[] = []; for await (const item of iterable) result.push(item); return result }

describe('deterministic Mock contract', () => {
  it('keeps nested folder structure and hides folders with no readable published descendant', async () => {
    const api = new MockApi(false)
    await admin(api)
    const parent = await api.createFolder('kb-java', null, '排障资料')
    const child = await api.createFolder('kb-java', parent.id, '网络')
    const draft = await api.createDocument('kb-java', child.id, '连接超时')
    await expect(api.createDocument('kb-ops', child.id, '错误归属')).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR })
    await reader(api)
    expect((await api.listFolders()).some(folder => folder.id === parent.id)).toBe(false)
    await admin(api)
    const job = await api.startPublish(draft.id, draft.draftRevision)
    await new Promise(resolve => setTimeout(resolve, 1250))
    expect((await api.getPublishJob(job.id)).status).toBe(JobStatus.SUCCEEDED)
    await reader(api)
    expect((await api.listFolders()).map(folder => folder.id)).toEqual(expect.arrayContaining([parent.id, child.id]))
    expect((await api.listDocuments()).find(doc => doc.id === draft.id)?.parentId).toBe(child.id)
  })

  it('searches all published content and rejects retrieval failures', async () => {
    const api = new MockApi(false)
    await reader(api)
    const hits = await api.search('Redis 缓存命中率下降')
    expect(hits.some(item => item.documentId === 'doc-redis')).toBe(true)
    await admin(api)
    const result = await api.debugQuery('Redis 缓存命中率下降', { ...defaultConfig, ftsTopK: 1, vectorTopK: 1 })
    expect(result.fts.some(item => item.documentId === 'doc-redis')).toBe(true)
    expect(result.vector.some(item => item.documentId === 'doc-redis')).toBe(true)
    await api.setDemoScenario('AUTHZ_FAIL')
    await expect(api.debugQuery('JVM 的定义', defaultConfig)).rejects.toMatchObject({ code: ErrorCode.AUTHZ_UNAVAILABLE })
  })

  it('degrades one lane only with enough evidence and abstains otherwise', async () => {
    const api = new MockApi(false)
    await admin(api); await api.setDemoScenario('FTS_DOWN')
    const vectorOnly = await api.debugQuery('JVM 的定义', defaultConfig)
    expect(vectorOnly.degradedLane).toBe('FTS')
    expect(vectorOnly.sufficient).toBe(true)
    await admin(api); await api.setDemoScenario('VECTOR_DOWN')
    const ftsOnly = await api.debugQuery('如何分析 GC 日志', defaultConfig)
    expect(ftsOnly.degradedLane).toBe('VECTOR')
    expect(ftsOnly.sufficient).toBe(true)
    const tooStrict = await api.debugQuery('JVM 的定义', { ...defaultConfig, minEvidenceCount: 9 })
    expect(tooStrict.sufficient).toBe(false)
    expect(tooStrict.answerPreview).toBe('知识库中没有足够的信息。')
  })

  it('keeps the old active version on failure and rejects concurrent publish', async () => {
    const api = new MockApi(false)
    await admin(api); await api.setDemoScenario('PUBLISH_FAIL')
    const before = await api.getDocument('doc-jvm')
    const job = await api.startPublish('doc-jvm', before.draftRevision)
    await expect(api.startPublish('doc-jvm', before.draftRevision)).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
    await new Promise(resolve => setTimeout(resolve, 1250))
    expect((await api.getPublishJob(job.id)).status).toBe(JobStatus.FAILED)
    expect((await api.getDocument('doc-jvm')).activeVersionId).toBe(before.activeVersionId)
  })

  it('keeps published citations readable and invalidates snapshots when the retrieval scenario changes', async () => {
    const api = new MockApi(false)
    await reader(api)
    const conversation = await api.createConversation()
    const run = await api.createRun(conversation.id, '如何分析 GC 日志')
    await collect(api.streamRun(run.id))
    const prior = await api.getConversation(conversation.id)
    expect(prior.messages[1].citations.length).toBeGreaterThan(0)
    await admin(api)
    const snapshot = await api.createEvaluationSnapshot('dataset-core')
    await admin(api); await api.setDemoScenario('FTS_DOWN')
    await expect(api.runEvaluation(snapshot.id, '旧场景实验', defaultConfig)).rejects.toMatchObject({ code: ErrorCode.SNAPSHOT_INVALIDATED })
    await reader(api)
    const after = await api.getConversation(conversation.id)
    expect(after.messages[1].redacted).toBe(false)
    expect(after.messages[1].content).toBeTruthy()
    expect(after.messages[1].citations.length).toBeGreaterThan(0)
    expect(after.messages[0].content).toBe('如何分析 GC 日志')
  })

  it('moves through CANCEL_REQUESTED and preserves partial generated content', async () => {
    const api = new MockApi(false)
    await reader(api)
    const conversation = await api.createConversation()
    const run = await api.createRun(conversation.id, 'JVM 的定义和运行时数据区')
    const stream = api.streamRun(run.id)[Symbol.asyncIterator]()
    for (let i = 0; i < 4; i++) await stream.next()
    expect((await api.getConversation(conversation.id)).messages[1].content).toBeTruthy()
    const requested = await api.cancelRun(run.id)
    expect(requested.status).toBe(RunStatus.CANCEL_REQUESTED)
    await stream.next()
    await new Promise(resolve => setTimeout(resolve, 350))
    expect((await api.getRun(run.id)).status).toBe(RunStatus.CANCELLED)
    const assistant = (await api.getConversation(conversation.id)).messages[1]
    expect(assistant.status).toBe(RunStatus.CANCELLED)
    expect(assistant.content?.length).toBeGreaterThan(0)
  })

  it('returns structured errors rather than silently changing role', async () => {
    const api = new MockApi(false)
    try { await api.login('reader@guguwiki.dev', 'demo123', 'ADMIN'); throw new Error('expected failure') }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).code).toBe(ErrorCode.FORBIDDEN) }
  })

  it('makes newly published content retrievable and keeps the draft invisible', async () => {
    const api = new MockApi(false)
    await admin(api)
    const doc = await api.createDocument('kb-java', null, '网络超时排查')
    const saved = await api.saveDraft(doc.id, doc.draftRevision, doc.title, '# 网络超时排查\n\n网络超时排查需要先检查连接池和重试配置。')
    await reader(api)
    expect((await api.search('网络超时排查')).some(hit => hit.documentId === doc.id)).toBe(false)
    await admin(api)
    const job = await api.startPublish(doc.id, saved.draftRevision)
    await new Promise(resolve => setTimeout(resolve, 1250))
    expect((await api.getPublishJob(job.id)).status).toBe(JobStatus.SUCCEEDED)
    await reader(api)
    expect((await api.search('网络超时排查')).some(hit => hit.documentId === doc.id)).toBe(true)
  })

  it('compares configs on one frozen snapshot and activates only on explicit action', async () => {
    const api = new MockApi(false)
    await admin(api)
    const snapshot = await api.createEvaluationSnapshot('dataset-core')
    const original = await api.getActiveStrategy()
    const first = await api.runEvaluation(snapshot.id, '基线', defaultConfig)
    const second = await api.runEvaluation(snapshot.id, '偏重 FTS', { ...defaultConfig, ftsWeight: 2 })
    expect(first.snapshotId).toBe(second.snapshotId)
    expect(first.config.ftsWeight).toBe(1)
    expect(second.config.ftsWeight).toBe(2)
    expect((await api.getActiveStrategy()).id).toBe(original.id)
    await api.activateStrategy(second.id)
    expect((await api.getActiveStrategy()).config.ftsWeight).toBe(2)
    expect((await api.listEvaluationRuns()).every(run => !run.redacted)).toBe(true)
    expect((await api.listEvaluationRuns()).every(run => !run.redacted && run.results.length > 0)).toBe(true)
  })

  it('validates the shared SSE event shape', () => {
    const base = { eventId: 'run-1:1', runId: 'run-1', conversationId: 'conversation-1', messageId: 'message-1', createdAt: '2026-10-10T09:00:00Z' }
    expect(parseChatEvent({ ...base, type: 'delta', text: '你好' }).type).toBe('delta')
    expect(() => parseChatEvent({ ...base, type: 'citation', citation: { documentId: 'doc-1' } })).toThrow(ApiError)
  })
})
