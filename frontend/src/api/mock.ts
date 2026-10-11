import {
  ApiError, ErrorCode, JobStatus, RunStatus, defaultConfig,
  type CandidateDto, type ChatEventDto, type ChatRunDto, type CitationDto,
  type ConversationDetailDto, type ConversationDto, type DebugResultDto,
  type DemoScenario, type DemoStateDto, type DocumentDto, type EvaluationDatasetDto,
  type EvaluationRunDto, type EvaluationSnapshotDto, type ImportJobDto,
  type KnowledgeBaseDto, type MessageDto, type PublishJobDto, type RetrievalConfigDto, type FolderDto,
  type RetrievalLane, type SearchHitDto, type StrategyDto, type StreamBase, type UserDto,
} from '../contracts'
import type { GuguApi } from './types'

const STORAGE_KEY = 'guguwiki-demo-v2'
const BASE_DATE = '2026-10-10T09:00:00.000Z'
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const clone = <T,>(value: T): T => structuredClone(value)
type EventPayload = ChatEventDto extends infer T ? T extends { type: string } ? Omit<T, keyof StreamBase> : never : never

interface InternalRun extends ChatRunDto { seq: number }
interface InternalJob extends PublishJobDto { readyAt: number }
interface InternalImport extends ImportJobDto { readyAt: number; knowledgeBaseId: string; parentId: string | null; content: string; kind: 'MARKDOWN' | 'PDF'; dataUrl?: string }
interface MockState {
  currentUserId: string | null; nextId: number; scenario: DemoScenario;
  credentials: Record<string, string>;
  users: UserDto[]; knowledgeBases: KnowledgeBaseDto[]; folders: FolderDto[]; documents: DocumentDto[];
  conversations: ConversationDto[]; messages: MessageDto[]; runs: InternalRun[];
  importJobs: InternalImport[]; publishJobs: InternalJob[];
  originalFiles: Record<string, string>;
  datasets: EvaluationDatasetDto[]; snapshots: EvaluationSnapshotDto[]; evaluationRuns: EvaluationRunDto[];
  activeStrategy: StrategyDto;
}

function initialState(): MockState {
  const version = (id: string, content: string) => ({ id: `${id}-v1`, number: 1, title: content.match(/^#\s+(.+)$/m)?.[1] ?? id, content, createdAt: BASE_DATE, indexedAt: BASE_DATE })
  const documents: DocumentDto[] = [
    { id: 'doc-jvm', knowledgeBaseId: 'kb-java', parentId: 'folder-jvm', title: 'JVM 基础与运行时数据区', kind: 'MARKDOWN', summary: '从 JVM 定义到运行时内存区域的入门说明。', draftContent: '# JVM 基础与运行时数据区\n\nJVM 是 Java 虚拟机，负责加载、验证并执行 Java 字节码。\n\n## 运行时数据区\n\n堆用于存放对象实例，方法区保存类元数据，线程栈保存栈帧。', draftRevision: 1, activeVersionId: 'doc-jvm-v1', versions: [version('doc-jvm', '# JVM 基础与运行时数据区\n\nJVM 是 Java 虚拟机，负责加载、验证并执行 Java 字节码。\n\n## 运行时数据区\n\n堆用于存放对象实例，方法区保存类元数据，线程栈保存栈帧。')] },
    { id: 'doc-gc', knowledgeBaseId: 'kb-java', parentId: 'folder-jvm', title: '垃圾回收与 GC 日志', kind: 'MARKDOWN', summary: '认识垃圾回收器、停顿与 GC 日志。', draftContent: '# 垃圾回收与 GC 日志\n\nGC 通过可达性分析识别可回收对象。排查停顿时，应先观察堆使用量、暂停时间及 GC 日志。', draftRevision: 1, activeVersionId: 'doc-gc-v1', versions: [version('doc-gc', '# 垃圾回收与 GC 日志\n\nGC 通过可达性分析识别可回收对象。排查停顿时，应先观察堆使用量、暂停时间及 GC 日志。')] },
    { id: 'doc-redis', knowledgeBaseId: 'kb-ops', parentId: 'folder-ops', title: 'Redis 缓存排障手册', kind: 'MARKDOWN', summary: '内部缓存故障排查流程。', draftContent: '# Redis 缓存排障手册\n\nRedis 命中率下降时，先核对键过期策略、热点键与连接池耗尽情况。', draftRevision: 1, activeVersionId: 'doc-redis-v1', versions: [version('doc-redis', '# Redis 缓存排障手册\n\nRedis 命中率下降时，先核对键过期策略、热点键与连接池耗尽情况。')] },
    { id: 'doc-guide', knowledgeBaseId: 'kb-ops', parentId: null, title: '知识库使用指南', kind: 'MARKDOWN', summary: '搜索、引用与权限的使用说明。', draftContent: '# 知识库使用指南\n\n使用搜索定位文档，使用 AI 问答获得有引用的回答。引用只能打开当前有权限的文档。', draftRevision: 1, activeVersionId: 'doc-guide-v1', versions: [version('doc-guide', '# 知识库使用指南\n\n使用搜索定位文档，使用 AI 问答获得有引用的回答。引用只能打开当前有权限的文档。')] },
  ]
  return {
    currentUserId: null, nextId: 1, scenario: 'NORMAL',
    credentials: { 'admin@guguwiki.dev': 'demo123', 'reader@guguwiki.dev': 'demo123', 'platform@guguwiki.dev': 'demo123' },
    users: [
      { id: 'user-admin', name: '陈管理员', email: 'admin@guguwiki.dev', role: 'ADMIN' },
      { id: 'user-reader', name: '林同学', email: 'reader@guguwiki.dev', role: 'READER' },
      { id: 'user-platform', name: '周同学', email: 'platform@guguwiki.dev', role: 'READER' },
    ],
    knowledgeBases: [
      { id: 'kb-java', name: 'Java 工程实践', description: '语言、虚拟机与性能调优', icon: 'J', documentCount: 2 },
      { id: 'kb-ops', name: '平台知识中心', description: '服务运行和团队协作资料', icon: 'P', documentCount: 2 },
    ],
    folders: [
      { id: 'folder-jvm', knowledgeBaseId: 'kb-java', parentId: null, title: '虚拟机与性能' },
      { id: 'folder-ops', knowledgeBaseId: 'kb-ops', parentId: null, title: '运行手册' },
    ],
    documents, conversations: [], messages: [], runs: [], importJobs: [], publishJobs: [], originalFiles: {},
    datasets: [{ id: 'dataset-core', name: '核心检索样本', description: '文档级 0–3 相关性标注，覆盖 JVM、GC 和 Redis。', cases: [
      { id: 'case-jvm', query: 'JVM 的定义和运行时数据区', relevance: { 'doc-jvm': 3, 'doc-gc': 1 } },
      { id: 'case-gc', query: '如何分析 GC 日志', relevance: { 'doc-gc': 3, 'doc-jvm': 1 } },
      { id: 'case-redis', query: 'Redis 缓存命中率下降', relevance: { 'doc-redis': 3 } },
    ] }],
    snapshots: [], evaluationRuns: [],
    activeStrategy: { id: 'strategy-default', name: '默认混合检索', config: clone(defaultConfig), activatedAt: BASE_DATE },
  }
}

function fingerprint(value: unknown): string {
  const raw = JSON.stringify(value)
  let hash = 2166136261
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const topicWords: Record<string, string[]> = {
  'doc-jvm': ['jvm', '虚拟机', '内存', '运行时', '字节码', '堆'],
  'doc-gc': ['gc', '垃圾回收', '停顿', '日志', '回收器'],
  'doc-redis': ['redis', '缓存', '命中率', '热点键', '连接池'],
  'doc-guide': ['知识库', '搜索', '引用', '权限', '问答'],
}

function termsFor(query: string): string[] {
  const normalized = query.toLowerCase()
  const known = [...new Set(Object.values(topicWords).flat().filter(term => normalized.includes(term)))]
  if (known.length) return known
  const latin = normalized.match(/[a-z0-9_]{2,}/g) ?? []
  const chinese = (normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []).flatMap(group => [...group].slice(0, -1).map((_, index) => group.slice(index, index + 2)))
  return [...new Set([...latin, ...chinese].filter(term => !['如何', '什么', '怎么', '是否', '请问', '可以', '一下'].includes(term)))]
}

export class MockApi implements GuguApi {
  private state: MockState
  constructor(private persist = true) {
    const stored = persist && typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    try {
      this.state = stored ? JSON.parse(stored) as MockState : initialState()
      this.state.originalFiles ??= {}; this.state.credentials ??= initialState().credentials
      this.state.folders ??= initialState().folders
      if (this.state.folders.length === 0 && this.state.documents.some(doc => doc.parentId?.startsWith('folder-'))) this.state.folders = initialState().folders
      for (const doc of this.state.documents) for (const version of doc.versions) version.title ??= version.content.match(/^#\s+(.+)$/m)?.[1] ?? doc.title
      for (const snapshot of this.state.snapshots) if (!snapshot.cases) { snapshot.cases = []; snapshot.status = 'INVALIDATED' }
      if (stored) for (const run of this.state.runs) {
        if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.CANCEL_REQUESTED) continue
        run.status = run.status === RunStatus.CANCEL_REQUESTED ? RunStatus.CANCELLED : RunStatus.FAILED
        const assistant = this.state.messages.find(message => message.id === run.assistantMessageId)
        if (assistant) assistant.status = run.status
      }
      if (stored) this.save()
    }
    catch { this.state = initialState() }
  }
  private save() { if (this.persist && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)) }
  private id(prefix: string) { return `${prefix}-${String(this.state.nextId++).padStart(4, '0')}` }
  private currentUser(): UserDto {
    const user = this.state.users.find(item => item.id === this.state.currentUserId)
    if (!user) throw new ApiError(ErrorCode.UNAUTHENTICATED, '请先登录。', 401)
    return user
  }
  private admin(): UserDto {
    const user = this.currentUser()
    if (user.role !== 'ADMIN') throw new ApiError(ErrorCode.FORBIDDEN, '此操作需要管理员权限。', 403)
    return user
  }
  private document(id: string): DocumentDto {
    const doc = this.state.documents.find(item => item.id === id)
    if (!doc) throw new ApiError(ErrorCode.NOT_FOUND, '文档不存在。', 404)
    return doc
  }
  private kb(id: string): KnowledgeBaseDto {
    const kb = this.state.knowledgeBases.find(item => item.id === id)
    if (!kb) throw new ApiError(ErrorCode.NOT_FOUND, '知识库不存在。', 404)
    return kb
  }
  private canRead(doc: DocumentDto, user = this.currentUser()): boolean {
    return user.role === 'ADMIN' || !!doc.activeVersionId
  }
  private activeVersion(doc: DocumentDto, pinnedId?: string) {
    return doc.versions.find(version => version.id === (pinnedId ?? doc.activeVersionId))
  }
  private permissionFingerprint(): string {
    return fingerprint({ policy: 'all-readers-can-read-published-content-v1' })
  }
  async login(email: string, password: string, entry: 'READER' | 'ADMIN'): Promise<UserDto> {
    const user = this.state.users.find(item => item.email === email.trim().toLowerCase())
    if (!user || password !== this.state.credentials[user.email]) throw new ApiError(ErrorCode.UNAUTHENTICATED, '账号或密码不正确。', 401)
    if (entry === 'ADMIN' && user.role !== 'ADMIN') throw new ApiError(ErrorCode.FORBIDDEN, '此账号没有管理员权限。', 403)
    this.state.currentUserId = user.id; this.save(); return clone(user)
  }
  async me() { return clone(this.state.users.find(item => item.id === this.state.currentUserId) ?? null) }
  async logout() { this.state.currentUserId = null; this.save() }
  async listKnowledgeBases() {
    this.currentUser()
    return clone(this.state.knowledgeBases)
  }
  async createKnowledgeBase(name: string, description: string) {
    this.admin()
    if (!name.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '知识库名称不能为空。')
    const kb: KnowledgeBaseDto = { id: this.id('kb'), name: name.trim(), description, icon: name.trim()[0], documentCount: 0 }
    this.state.knowledgeBases.push(kb); this.save(); return clone(kb)
  }
  async listFolders(knowledgeBaseId?: string) {
    const user = this.currentUser()
    const visibleDocs = this.state.documents.filter(doc => !!doc.activeVersionId && this.canRead(doc, user))
    const hasVisibleDescendant = (folderId: string): boolean => visibleDocs.some(doc => doc.parentId === folderId) || this.state.folders.some(folder => folder.parentId === folderId && hasVisibleDescendant(folder.id))
    return clone(this.state.folders.filter(folder => (!knowledgeBaseId || folder.knowledgeBaseId === knowledgeBaseId) && (user.role === 'ADMIN' || hasVisibleDescendant(folder.id))))
  }
  async createFolder(knowledgeBaseId: string, parentId: string | null, title: string) {
    this.admin(); this.kb(knowledgeBaseId)
    if (!title.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '目录名称不能为空。')
    if (parentId && !this.state.folders.some(folder => folder.id === parentId && folder.knowledgeBaseId === knowledgeBaseId)) throw new ApiError(ErrorCode.VALIDATION_ERROR, '上级目录不存在或不属于该知识库。')
    const folder: FolderDto = { id: this.id('folder'), knowledgeBaseId, parentId, title: title.trim() }
    this.state.folders.push(folder); this.save(); return clone(folder)
  }
  async listDocuments(knowledgeBaseId?: string) {
    const user = this.currentUser()
    return clone(this.state.documents.filter(doc => (!knowledgeBaseId || doc.knowledgeBaseId === knowledgeBaseId) && (user.role === 'ADMIN' || (doc.activeVersionId && this.canRead(doc, user)))).map(doc => user.role === 'ADMIN' ? doc : { ...doc, title: this.activeVersion(doc)?.title ?? doc.title, summary: (this.activeVersion(doc)?.content ?? '').replace(/[#*`\n]/g, ' ').trim().slice(0, 65), draftContent: '', versions: this.activeVersion(doc) ? [this.activeVersion(doc)!] : [] }))
  }
  async getDocument(id: string) {
    const doc = this.document(id)
    const user = this.currentUser()
    if (!this.canRead(doc, user) || (user.role !== 'ADMIN' && !doc.activeVersionId)) throw new ApiError(ErrorCode.FORBIDDEN, '你没有权限查看此文档。', 403)
    if (user.role === 'ADMIN') return clone(doc)
    const version = this.activeVersion(doc)
    return clone({ ...doc, title: version?.title ?? doc.title, summary: (version?.content ?? '').replace(/[#*`\n]/g, ' ').trim().slice(0, 65), draftContent: version?.content ?? '', versions: version ? [version] : [] })
  }
  async downloadOriginal(id: string) {
    const doc = this.document(id); const user = this.currentUser()
    if (doc.kind !== 'PDF' || !this.canRead(doc, user) || (user.role !== 'ADMIN' && !doc.activeVersionId)) throw new ApiError(ErrorCode.FORBIDDEN, '你没有权限查看原件。', 403)
    const dataUrl = this.state.originalFiles[id]
    if (!dataUrl) throw new ApiError(ErrorCode.NOT_FOUND, 'PDF 原件不存在。', 404)
    return fetch(dataUrl).then(response => response.blob())
  }
  async createDocument(knowledgeBaseId: string, parentId: string | null, title: string) {
    this.admin(); this.kb(knowledgeBaseId)
    if (parentId && !this.state.folders.some(folder => folder.id === parentId && folder.knowledgeBaseId === knowledgeBaseId)) throw new ApiError(ErrorCode.VALIDATION_ERROR, '目标目录不存在。')
    if (!title.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '文档标题不能为空。')
    const doc: DocumentDto = { id: this.id('doc'), knowledgeBaseId, parentId, title: title.trim(), kind: 'MARKDOWN', summary: '', draftContent: `# ${title.trim()}\n\n`, draftRevision: 1, activeVersionId: null, versions: [] }
    this.state.documents.push(doc); this.kb(knowledgeBaseId).documentCount++; this.save(); return clone(doc)
  }
  async saveDraft(id: string, expectedRevision: number, title: string, content: string) {
    this.admin(); const doc = this.document(id)
    if (doc.kind !== 'MARKDOWN') throw new ApiError(ErrorCode.VALIDATION_ERROR, 'PDF 正文不能在线编辑。')
    if (doc.draftRevision !== expectedRevision) throw new ApiError(ErrorCode.CONFLICT, '草稿已变化，请刷新后重试。', 409)
    if (!title.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '文档标题不能为空。')
    doc.title = title.trim(); doc.draftContent = content; doc.draftRevision++; doc.summary = content.replace(/[#*`]/g, '').slice(0, 65)
    this.save(); return clone(doc)
  }
  async search(query: string): Promise<SearchHitDto[]> {
    this.currentUser()
    if (this.state.scenario === 'AUTHZ_FAIL') throw new ApiError(ErrorCode.AUTHZ_UNAVAILABLE, '权限服务不可用，检索已拒绝。', 503)
    if (this.state.scenario === 'FTS_DOWN') throw new ApiError(ErrorCode.FTS_UNAVAILABLE, '关键词检索暂时不可用。', 503)
    if (this.state.scenario === 'NO_EVIDENCE') return []
    const candidates = this.rankLane(query, 'FTS', this.state.activeStrategy.config.ftsTopK)
    return candidates.map(candidate => {
      const doc = this.document(candidate.documentId)
      const citation = this.citation(doc, candidate.versionId)
      return { documentId: doc.id, knowledgeBaseId: doc.knowledgeBaseId, title: citation.title, excerpt: citation.excerpt, score: candidate.score, citation }
    })
  }
  async listUsers() { this.admin(); return clone(this.state.users) }
  async createUser(name: string, email: string, role: 'READER' | 'ADMIN', initialPassword: string) {
    this.admin(); const normalized = email.trim().toLowerCase()
    if (!name.trim() || !normalized.includes('@') || initialPassword.length < 8) throw new ApiError(ErrorCode.VALIDATION_ERROR, '请填写有效的姓名、邮箱和至少 8 位初始密码。')
    if (this.state.users.some(user => user.email === normalized)) throw new ApiError(ErrorCode.CONFLICT, '邮箱已经被使用。', 409)
    const user: UserDto = { id: this.id('user'), name: name.trim(), email: normalized, role }
    this.state.users.push(user); this.state.credentials[normalized] = initialPassword; this.save(); return clone(user)
  }
  async listConversations() {
    const user = this.currentUser()
    return clone(this.state.conversations.filter(item => item.id.startsWith(`${user.id}:`)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }
  async createConversation() {
    const user = this.currentUser(); const now = new Date().toISOString()
    const conversation: ConversationDto = { id: `${user.id}:${this.id('conversation')}`, title: '新对话', createdAt: now, updatedAt: now }
    this.state.conversations.push(conversation); this.save(); return clone(conversation)
  }
  async renameConversation(id: string, title: string) {
    const conversation = this.ownedConversation(id)
    if (!title.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '会话标题不能为空。')
    conversation.title = title.trim(); conversation.updatedAt = new Date().toISOString(); this.save(); return clone(conversation)
  }
  async deleteConversation(id: string) {
    this.ownedConversation(id)
    if (this.state.runs.some(run => run.conversationId === id && (run.status === RunStatus.RUNNING || run.status === RunStatus.CANCEL_REQUESTED))) throw new ApiError(ErrorCode.CONFLICT, '请先停止当前回答。', 409)
    this.state.conversations = this.state.conversations.filter(item => item.id !== id)
    this.state.messages = this.state.messages.filter(item => item.conversationId !== id)
    this.state.runs = this.state.runs.filter(item => item.conversationId !== id)
    this.save()
  }
  private ownedConversation(id: string) {
    const user = this.currentUser()
    const conversation = this.state.conversations.find(item => item.id === id && item.id.startsWith(`${user.id}:`))
    if (!conversation) throw new ApiError(ErrorCode.NOT_FOUND, '会话不存在。', 404)
    return conversation
  }
  async getConversation(id: string): Promise<ConversationDetailDto> {
    const conversation = this.ownedConversation(id); const user = this.currentUser()
    const messages = this.state.messages.filter(item => item.conversationId === id).map(item => {
      if (item.role === 'ASSISTANT' && item.evidenceDocumentIds.some(docId => !this.canRead(this.document(docId), user))) {
        return { ...item, content: null, citations: [], redacted: true }
      }
      return item
    })
    return clone({ conversation, messages })
  }
  async createRun(conversationId: string, question: string): Promise<ChatRunDto> {
    const conversation = this.ownedConversation(conversationId)
    if (!question.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '问题不能为空。')
    const now = new Date().toISOString()
    const userMessageId = this.id('message'); const assistantMessageId = this.id('message')
    this.state.messages.push({ id: userMessageId, conversationId, role: 'USER', content: question.trim(), createdAt: now, citations: [], evidenceDocumentIds: [] })
    this.state.messages.push({ id: assistantMessageId, conversationId, role: 'ASSISTANT', content: '', createdAt: now, citations: [], evidenceDocumentIds: [], status: RunStatus.RUNNING })
    const run: InternalRun = { id: this.id('run'), conversationId, userMessageId, assistantMessageId, status: RunStatus.RUNNING, createdAt: now, seq: 0 }
    this.message(assistantMessageId).runId = run.id
    this.state.runs.push(run)
    if (conversation.title === '新对话') conversation.title = question.trim().slice(0, 22)
    conversation.updatedAt = now; this.save(); return clone(run)
  }
  private run(id: string) {
    const run = this.state.runs.find(item => item.id === id)
    if (!run) throw new ApiError(ErrorCode.NOT_FOUND, '生成任务不存在。', 404)
    this.ownedConversation(run.conversationId)
    return run
  }
  private message(id: string) { return this.state.messages.find(item => item.id === id)! }
  private event(run: InternalRun, detail: EventPayload): ChatEventDto {
    run.seq++
    return { ...detail, eventId: `${run.id}:${run.seq}`, runId: run.id, conversationId: run.conversationId, messageId: run.assistantMessageId, createdAt: new Date().toISOString() } as ChatEventDto
  }
  private finishCancelled(run: InternalRun) {
    if (run.status !== RunStatus.CANCEL_REQUESTED) return
    run.status = RunStatus.CANCELLED
    this.message(run.assistantMessageId).status = RunStatus.CANCELLED
    this.save()
  }
  async *streamRun(runId: string): AsyncIterable<ChatEventDto> {
    const run = this.run(runId)
    if (run.status !== RunStatus.RUNNING) return
    yield this.event(run, { type: 'session', status: 'RUNNING' })
    const question = this.message(run.userMessageId).content ?? ''
    let debug: DebugResultDto
    try { debug = await this.debugQuery(question, this.state.activeStrategy.config) }
    catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(ErrorCode.INTERNAL_ERROR, '生成失败。', 500)
      run.status = RunStatus.FAILED
      this.message(run.assistantMessageId).status = RunStatus.FAILED; this.save()
      yield this.event(run, { type: 'error', status: 'FAILED', code: apiError.status, message: apiError.message }); return
    }
    if ((run as InternalRun).status === RunStatus.CANCEL_REQUESTED) { this.finishCancelled(run); return }
    const message = this.message(run.assistantMessageId)
    message.citations = debug.evidence
    message.evidenceDocumentIds = debug.evidence.map(item => item.documentId)
    this.save()
    for (const citation of debug.evidence) yield this.event(run, { type: 'citation', citation })
    const answer = debug.sufficient ? debug.answerPreview : '知识库中没有足够的信息。'
    const segments = answer.match(/.{1,12}/gu) ?? [answer]
    for (const text of segments) {
      await wait(135)
      if ((run as InternalRun).status === RunStatus.CANCEL_REQUESTED) { this.finishCancelled(run); return }
      if (run.status !== RunStatus.RUNNING) return
      message.content = (message.content ?? '') + text; this.save()
      yield this.event(run, { type: 'delta', text })
    }
    run.status = RunStatus.COMPLETED; message.status = RunStatus.COMPLETED; this.save()
    yield this.event(run, { type: 'done', status: 'COMPLETED', content: message.content ?? '' })
  }
  async cancelRun(runId: string) {
    const run = this.run(runId)
    if (run.status === RunStatus.RUNNING) {
      run.status = RunStatus.CANCEL_REQUESTED
      this.message(run.assistantMessageId).status = RunStatus.CANCEL_REQUESTED
      this.save()
      setTimeout(() => this.finishCancelled(run), 300)
    }
    return clone(run)
  }
  async getRun(runId: string) { return clone(this.run(runId)) }
  async importFile(knowledgeBaseId: string, parentId: string | null, file: File) {
    this.admin(); this.kb(knowledgeBaseId)
    if (parentId && !this.state.folders.some(folder => folder.id === parentId && folder.knowledgeBaseId === knowledgeBaseId)) throw new ApiError(ErrorCode.VALIDATION_ERROR, '目标目录不存在。')
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'md' && extension !== 'pdf') throw new ApiError(ErrorCode.VALIDATION_ERROR, '仅支持 Markdown 和可提取文字的 PDF。')
    if (extension === 'pdf' && file.size > 2_000_000) throw new ApiError(ErrorCode.VALIDATION_ERROR, '演示模式的 PDF 原件最大 2 MB。')
    const dataUrl = extension === 'pdf' ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new ApiError(ErrorCode.INTERNAL_ERROR, '读取 PDF 失败。')); reader.readAsDataURL(file) }) : undefined
    const job: InternalImport = { id: this.id('import'), documentId: null, fileName: file.name, status: JobStatus.RUNNING, createdAt: new Date().toISOString(), readyAt: Date.now() + 900, knowledgeBaseId, parentId, content: extension === 'md' ? await file.text() : `# ${file.name.replace(/\.pdf$/i, '')}\n\n演示模式已模拟从 PDF 提取文字。真实解析由 Python Retrieval Service 完成。`, kind: extension === 'md' ? 'MARKDOWN' : 'PDF', dataUrl }
    this.state.importJobs.push(job); this.save(); return clone(job)
  }
  private settleImport(job: InternalImport) {
    if (job.status !== JobStatus.RUNNING || Date.now() < job.readyAt) return
    if (job.kind === 'PDF' && job.fileName.toLowerCase().includes('scan')) {
      job.status = JobStatus.FAILED; job.error = '扫描件无法提取文字，首版不支持 OCR。'; this.save(); return
    }
    const doc: DocumentDto = { id: this.id('doc'), knowledgeBaseId: job.knowledgeBaseId, parentId: job.parentId, title: job.fileName.replace(/\.(md|pdf)$/i, ''), kind: job.kind, summary: job.content.slice(0, 65), draftContent: job.content, draftRevision: 1, activeVersionId: null, versions: [], originalFileName: job.kind === 'PDF' ? job.fileName : undefined }
    this.state.documents.push(doc); this.kb(job.knowledgeBaseId).documentCount++
    if (job.dataUrl) this.state.originalFiles[doc.id] = job.dataUrl
    job.documentId = doc.id; job.status = JobStatus.SUCCEEDED; this.save()
  }
  async getImportJob(id: string) {
    this.admin(); const job = this.state.importJobs.find(item => item.id === id)
    if (!job) throw new ApiError(ErrorCode.NOT_FOUND, '导入任务不存在。', 404)
    this.settleImport(job); return clone(job)
  }
  async startPublish(documentId: string, expectedDraftRevision: number) {
    this.admin(); const doc = this.document(documentId)
    if (doc.draftRevision !== expectedDraftRevision) throw new ApiError(ErrorCode.CONFLICT, '草稿版本已变化，请刷新后重试。', 409)
    if (this.state.publishJobs.some(item => item.documentId === documentId && (item.status === JobStatus.PENDING || item.status === JobStatus.RUNNING))) throw new ApiError(ErrorCode.CONFLICT, '当前文档已有发布任务。', 409)
    const job: InternalJob = { id: this.id('publish'), documentId, expectedDraftRevision, status: JobStatus.RUNNING, createdAt: new Date().toISOString(), readyAt: Date.now() + 1200 }
    this.state.publishJobs.push(job); this.save(); return clone(job)
  }
  private settlePublish(job: InternalJob) {
    if (job.status !== JobStatus.RUNNING || Date.now() < job.readyAt) return
    const doc = this.document(job.documentId)
    if (this.state.scenario === 'PUBLISH_FAIL') { job.status = JobStatus.FAILED; job.error = '向量构建失败，原发布版本保持不变。' }
    else if (doc.draftRevision !== job.expectedDraftRevision) { job.status = JobStatus.FAILED; job.error = '发布期间草稿发生变化，未切换生效版本。' }
    else {
      const number = Math.max(0, ...doc.versions.map(item => item.number)) + 1
      const versionId = `${doc.id}-v${number}`
      doc.versions.push({ id: versionId, number, title: doc.title, content: doc.draftContent, createdAt: new Date().toISOString(), indexedAt: new Date().toISOString() })
      doc.activeVersionId = versionId; job.status = JobStatus.SUCCEEDED
    }
    this.save()
  }
  async getPublishJob(id: string) {
    this.admin(); const job = this.state.publishJobs.find(item => item.id === id)
    if (!job) throw new ApiError(ErrorCode.NOT_FOUND, '发布任务不存在。', 404)
    this.settlePublish(job); return clone(job)
  }
  async getActiveStrategy() { this.currentUser(); return clone(this.state.activeStrategy) }
  private citation(doc: DocumentDto, versionId: string): CitationDto {
    const version = this.activeVersion(doc, versionId)
    const content = version?.content ?? ''
    return { documentId: doc.id, versionId, title: version?.title ?? doc.title, excerpt: content.replace(/[#*`\n]/g, ' ').trim().slice(0, 150), anchor: 'content' }
  }
  private rankLane(query: string, lane: RetrievalLane, topK: number, pinned?: Record<string, string>): CandidateDto[] {
    const terms = termsFor(query)
    // Only published documents are eligible before ranking and LIMIT.
    return this.state.documents
      .filter(doc => !!(pinned ? pinned[doc.id] : doc.activeVersionId))
      .map(doc => {
        const versionId = pinned?.[doc.id] ?? doc.activeVersionId!
        const version = this.activeVersion(doc, versionId)
        const content = `${version?.title ?? ''} ${version?.content ?? ''}`.toLowerCase()
        const hits = terms.filter(term => content.includes(term)).length
        const score = lane === 'FTS' ? (hits ? Math.min(0.99, 0.18 + hits * 0.59) : 0) : Math.min(0.99, 0.31 + hits * 0.36)
        return { documentId: doc.id, title: version?.title ?? doc.title, versionId, excerpt: this.citation(doc, versionId).excerpt, score, rank: 0, lane }
      })
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId))
      .slice(0, topK)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
  }
  private retrieve(query: string, config: RetrievalConfigDto, pinned?: Record<string, string>): DebugResultDto {
    if ([config.ftsTopK, config.vectorTopK, config.finalTopK, config.rrfK, config.rerankTopK, config.minEvidenceCount].some(value => !Number.isInteger(value) || value < 1) ||
      !Number.isFinite(config.ftsMinScore) || config.ftsMinScore < 0 ||
      !Number.isFinite(config.vectorMinSimilarity) || config.vectorMinSimilarity < -1 || config.vectorMinSimilarity > 1 ||
      !Number.isFinite(config.rerankMinScore) ||
      [config.ftsWeight, config.vectorWeight].some(value => !Number.isFinite(value) || value <= 0)) throw new ApiError(ErrorCode.VALIDATION_ERROR, '检索参数无效：Top-K、权重和最少证据数须大于 0；向量相似度须在 -1 到 1 之间。')
    if (this.state.scenario === 'AUTHZ_FAIL') throw new ApiError(ErrorCode.AUTHZ_UNAVAILABLE, '权限检查失败，已拒绝检索。', 503)
    const ftsDown = this.state.scenario === 'FTS_DOWN'
    const vectorDown = this.state.scenario === 'VECTOR_DOWN'
    const noEvidence = this.state.scenario === 'NO_EVIDENCE'
    const fts = ftsDown || noEvidence ? [] : this.rankLane(query, 'FTS', config.ftsTopK, pinned)
    const vector = vectorDown || noEvidence ? [] : this.rankLane(query, 'VECTOR', config.vectorTopK, pinned)
    const validFts = fts.filter(item => item.score >= config.ftsMinScore)
    const validVector = vector.filter(item => item.score >= config.vectorMinSimilarity)
    const rrf = new Map<string, CandidateDto>()
    for (const [items, weight] of [[validFts, config.ftsWeight], [validVector, config.vectorWeight]] as const) {
      for (const item of items) {
        const prior = rrf.get(item.documentId)
        rrf.set(item.documentId, { ...item, lane: 'FUSED', score: (prior?.score ?? 0) + weight / (config.rrfK + item.rank), rank: 0 })
      }
    }
    const fused = [...rrf.values()].sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId)).map((item, index) => ({ ...item, rank: index + 1 }))
    const reranked = config.rerankEnabled ? fused.slice(0, config.rerankTopK).map((item, index) => ({ ...item, lane: 'RERANK' as const, score: Math.min(0.99, 0.84 - index * 0.08), rank: index + 1 })).filter(item => item.score >= config.rerankMinScore) : []
    const final = (config.rerankEnabled ? reranked : fused).slice(0, config.finalTopK)
    const queryTerms = termsFor(query)
    const coveredTerms = queryTerms.filter(term => final.some(item => { const version = this.activeVersion(this.document(item.documentId), item.versionId); return `${version?.title ?? ''} ${version?.content ?? ''}`.toLowerCase().includes(term) }))
    const covered = queryTerms.length > 0 && coveredTerms.length / queryTerms.length >= (queryTerms.some(term => Object.values(topicWords).flat().includes(term)) ? 1 : 0.6)
    const sufficient = final.length >= config.minEvidenceCount && (!config.coverageCheckEnabled || covered)
    const evidence = sufficient ? final.map(item => this.citation(this.document(item.documentId), item.versionId)) : []
    const degradedLane = ftsDown ? 'FTS' : vectorDown ? 'VECTOR' : undefined
    const supportingText = evidence.map(item => {
      const content = this.activeVersion(this.document(item.documentId), item.versionId)?.content ?? ''
      return content.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#'))?.replace(/[。；;]+$/, '') ?? item.excerpt.replace(/[。；;]+$/, '')
    }).join('；')
    const answerPreview = sufficient ? `根据${evidence.map(item => `《${item.title}》`).join('和')}，${supportingText.slice(0, 210)}。` : '知识库中没有足够的信息。'
    return {
      query, fts, vector, fused, reranked, evidence, degradedLane, sufficient, answerPreview,
      timingsMs: { fts: ftsDown ? 0 : 13 + fts.length * 3, vector: vectorDown ? 0 : 22 + vector.length * 4, fusion: 5 + fused.length, rerank: config.rerankEnabled ? 18 + reranked.length * 3 : 0, total: 45 + fts.length * 3 + vector.length * 4 + (config.rerankEnabled ? 18 + reranked.length * 3 : 0) },
    }
  }
  async debugQuery(query: string, config: RetrievalConfigDto) {
    this.admin()
    if (!query.trim()) throw new ApiError(ErrorCode.VALIDATION_ERROR, '请输入查询内容。')
    return clone(this.retrieve(query, config))
  }
  async listDatasets() { this.admin(); return clone(this.state.datasets) }
  async createEvaluationSnapshot(datasetId: string) {
    this.admin()
    const dataset = this.state.datasets.find(item => item.id === datasetId)
    if (!dataset) throw new ApiError(ErrorCode.NOT_FOUND, '评测数据集不存在。', 404)
    const documentVersions = Object.fromEntries(this.state.documents.filter(doc => !!doc.activeVersionId).map(doc => [doc.id, doc.activeVersionId!]))
    const snapshot: EvaluationSnapshotDto = { id: this.id('snapshot'), datasetId, documentVersions, cases: clone(dataset.cases), corpusFingerprint: fingerprint(documentVersions), permissionFingerprint: this.permissionFingerprint(), datasetFingerprint: fingerprint(dataset.cases), modelFingerprint: 'mock-embedding-v1|mock-rerank-v1', environmentFingerprint: fingerprint({ scenario: this.state.scenario }), createdAt: new Date().toISOString(), status: 'VALID' }
    this.state.snapshots.push(snapshot); this.save(); return clone(snapshot)
  }
  private assertSnapshot(snapshot: EvaluationSnapshotDto) {
    if (snapshot.status === 'INVALIDATED') throw new ApiError(ErrorCode.SNAPSHOT_INVALIDATED, '实验快照已失效，请重新创建。', 409)
    if (snapshot.permissionFingerprint !== this.permissionFingerprint() || snapshot.datasetFingerprint !== fingerprint(snapshot.cases) || snapshot.environmentFingerprint !== fingerprint({ scenario: this.state.scenario })) {
      snapshot.status = 'INVALIDATED'; this.save()
      throw new ApiError(ErrorCode.SNAPSHOT_INVALIDATED, '权限视图或标注数据已变化，实验快照失效。', 409)
    }
    return snapshot.cases
  }
  async runEvaluation(snapshotId: string, name: string, config: RetrievalConfigDto) {
    this.admin(); const snapshot = this.state.snapshots.find(item => item.id === snapshotId)
    if (!snapshot) throw new ApiError(ErrorCode.NOT_FOUND, '实验快照不存在。', 404)
    const cases = this.assertSnapshot(snapshot)
    const results = cases.map(item => {
      const result = this.retrieve(item.query, config, snapshot.documentVersions)
      return { caseId: item.id, query: item.query, rankedDocumentIds: (config.rerankEnabled ? result.reranked : result.fused).slice(0, config.finalTopK).map(candidate => candidate.documentId), totalMs: result.timingsMs.total }
    })
    const recalls: number[] = []; const rrs: number[] = []; const ndcgs: number[] = []
    for (const [index, item] of cases.entries()) {
      const ranked = results[index].rankedDocumentIds
      const relevant = Object.entries(item.relevance).filter(([, grade]) => grade > 0).map(([id]) => id).filter(id => !!snapshot.documentVersions[id])
      if (!relevant.length) continue
      recalls.push(ranked.filter(id => relevant.includes(id)).length / relevant.length)
      const first = ranked.findIndex(id => relevant.includes(id)); rrs.push(first < 0 ? 0 : 1 / (first + 1))
      const gain = (ids: string[]) => ids.reduce((sum, id, rank) => sum + (2 ** (item.relevance[id] ?? 0) - 1) / Math.log2(rank + 2), 0)
      const ideal = relevant.sort((a, b) => item.relevance[b] - item.relevance[a]).slice(0, config.finalTopK)
      ndcgs.push(gain(ideal) ? gain(ranked) / gain(ideal) : 0)
    }
    const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    const times = results.map(item => item.totalMs).sort((a, b) => a - b)
    const percentile = (p: number) => times.length ? times[Math.ceil(times.length * p) - 1] : 0
    const run: EvaluationRunDto = { id: this.id('evaluation'), snapshotId, name: name.trim() || '未命名实验', config: clone(config), status: JobStatus.SUCCEEDED, metrics: { recallAtK: mean(recalls), mrr: mean(rrs), ndcg: mean(ndcgs), p50Ms: percentile(.5), p95Ms: percentile(.95) }, results, createdAt: new Date().toISOString() }
    this.state.evaluationRuns.unshift(run); this.save(); return clone(run)
  }
  async listEvaluationRuns() {
    this.admin()
    return clone(this.state.evaluationRuns.map(run => {
      const snapshot = this.state.snapshots.find(item => item.id === run.snapshotId)!
      try { this.assertSnapshot(snapshot); return run }
      catch { return { ...run, redacted: true, results: [] } }
    }))
  }
  async activateStrategy(runId: string) {
    this.admin(); const run = this.state.evaluationRuns.find(item => item.id === runId)
    if (!run || run.status !== JobStatus.SUCCEEDED) throw new ApiError(ErrorCode.NOT_FOUND, '可启用的实验不存在。', 404)
    const snapshot = this.state.snapshots.find(item => item.id === run.snapshotId)!
    this.assertSnapshot(snapshot)
    this.state.activeStrategy = { id: this.id('strategy'), name: run.name, config: clone(run.config), activatedAt: new Date().toISOString() }
    this.save(); return clone(this.state.activeStrategy)
  }
  async getDemoState(): Promise<DemoStateDto> { return { scenario: this.state.scenario, accounts: [{ email: 'reader@guguwiki.dev', password: 'demo123', role: 'READER' }, { email: 'admin@guguwiki.dev', password: 'demo123', role: 'ADMIN' }, { email: 'platform@guguwiki.dev', password: 'demo123', role: 'READER' }] } }
  async setDemoScenario(scenario: DemoScenario) { this.admin(); this.state.scenario = scenario; this.save(); return this.getDemoState() }
  async resetDemo() { this.state = initialState(); this.save() }
}
