import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Database, FileDown, FileText, FlaskConical, FolderOpen, Hash, LayoutDashboard,
  LockKeyhole, LogOut, MessageCircle, MoreHorizontal, Play, Plus, RotateCcw, Search,
  Send, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Square, UploadCloud, Users, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api } from './api'
import {
  ApiError, JobStatus, RunStatus, defaultConfig, type CandidateDto, type ChatEventDto, type ConversationDetailDto,
  type ConversationDto, type DebugResultDto, type DemoScenario, type DocumentDto,
  type EvaluationSnapshotDto, type FolderDto, type ImportJobDto,
  type PublishJobDto, type RetrievalConfigDto, type SearchHitDto, type UserDto,
} from './contracts'

const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后再试。'
const dateText = (value: string) => new Date(value).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
const scoreText = (value: number) => value.toFixed(value < 0.1 ? 4 : 2)
const statusText: Record<string, string> = { RUNNING: '处理中', PENDING: '等待中', SUCCEEDED: '已完成', FAILED: '失败', CANCEL_REQUESTED: '取消中', CANCELLED: '已取消', COMPLETED: '已完成', INVALIDATED: '已失效' }

function Notice({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div className="notice" role="alert"><CircleHelp size={17} /><span>{message}</span>{onClose && <button className="icon-button" onClick={onClose} aria-label="关闭提示"><X size={15} /></button>}</div>
}
function Empty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-icon"><BookOpen size={26} /></div><h3>{title}</h3>{detail && <p>{detail}</p>}{action}</div>
}
function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}
function SectionTitle({ kicker, title, description, action }: { kicker?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-title"><div>{kicker && <span className="eyebrow">{kicker}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}
function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { setLoading(true); try { setData(await load()); setError('') } catch (cause) { setError(errorText(cause)) } finally { setLoading(false) } }, deps)
  useEffect(() => { void refresh() }, [refresh])
  return { data, setData, error, setError, loading, refresh }
}

export default function App() {
  const [user, setUser] = useState<UserDto | null | undefined>(undefined)
  useEffect(() => { void api.me().then(setUser).catch(() => setUser(null)) }, [])
  if (user === undefined) return <div className="app-loading"><span className="brand-mark">g</span><p>正在打开知识工作台…</p></div>
  return <Routes>
    <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/wiki'} replace /> : <LoginPage onLogin={setUser} />} />
    <Route element={user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />}>
      <Route path="/wiki" element={<WikiPage />} />
      <Route path="/wiki/:documentId" element={<DocumentPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:conversationId" element={<ChatPage />} />
      {user?.role === 'ADMIN' && <>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/content" element={<AdminContent />} />
        <Route path="/admin/access" element={<AdminAccess />} />
        <Route path="/admin/lab" element={<LabDebug />} />
        <Route path="/admin/evaluation" element={<EvaluationPage />} />
      </>}
    </Route>
    <Route path="*" element={<Navigate to={user ? user.role === 'ADMIN' ? '/admin' : '/wiki' : '/login'} replace />} />
  </Routes>
}

function LoginPage({ onLogin }: { onLogin: (user: UserDto) => void }) {
  const [entry, setEntry] = useState<'READER' | 'ADMIN'>('READER')
  const [email, setEmail] = useState('reader@guguwiki.dev')
  const [password, setPassword] = useState('demo123')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const user = await api.login(email, password, entry); onLogin(user); navigate(entry === 'ADMIN' ? '/admin' : '/wiki') }
    catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }
  function selectEntry(value: 'READER' | 'ADMIN') { setEntry(value); setEmail(value === 'ADMIN' ? 'admin@guguwiki.dev' : 'reader@guguwiki.dev') }
  return <div className="login-layout"><div className="login-story">
    <div className="story-brand"><span className="brand-mark">g</span><span>GuguWiki</span></div>
    <div className="story-body"><Pill tone="blue"><Sparkles size={13} /> 有依据的知识问答</Pill><h1>让每一个回答，<br /><em>都有出处。</em></h1><p>把团队的文档沉淀成可信的知识网络。检索、阅读、提问，在一个安静的工作台里完成。</p>
      <div className="story-stack"><div><BookOpen size={19} /><span>可追溯的 Wiki 文档</span></div><div><ShieldCheck size={19} /><span>面向已发布内容的混合检索</span></div><div><MessageCircle size={19} /><span>带引用的流式问答</span></div></div>
    </div><div className="story-footer">GUGUWIKI · KNOWLEDGE WITH CONTEXT</div>
  </div><div className="login-main"><div className="login-card"><span className="eyebrow">欢迎回来</span><h2>进入知识工作台</h2><p className="muted">选择入口并使用演示账号体验完整流程。</p>
    <div className="entry-switch" role="tablist"><button className={entry === 'READER' ? 'active' : ''} onClick={() => selectEntry('READER')} type="button"><BookOpen size={18} />读者入口</button><button className={entry === 'ADMIN' ? 'active' : ''} onClick={() => selectEntry('ADMIN')} type="button"><LayoutDashboard size={18} />管理入口</button></div>
    <form onSubmit={submit} className="stack-form"><label>邮箱地址<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <Notice message={error} onClose={() => setError('')} />}<button className="button primary wide" disabled={busy}>{busy ? '正在验证…' : '进入工作台'}<ArrowRight size={17} /></button></form>
    <div className="demo-credential"><span>演示账号</span><code>{entry === 'ADMIN' ? 'admin@guguwiki.dev' : 'reader@guguwiki.dev'}</code><span>密码 demo123</span></div>
    <p className="login-hint"><LockKeyhole size={14} />入口选择不授予权限，角色仍由服务端校验。</p>
  </div></div></div>
}

function Shell({ user, onLogout }: { user: UserDto; onLogout: () => void }) {
  const navigate = useNavigate(); const location = useLocation()
  const admin = user.role === 'ADMIN'
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [location.pathname])
  async function logout() { await api.logout(); onLogout(); navigate('/login') }
  const pathNames: Record<string, string> = { '/wiki': '知识库', '/search': '全局搜索', '/chat': 'AI 问答', '/admin': '总览', '/admin/content': '内容管理', '/admin/access': '权限管理', '/admin/lab': '单次调试', '/admin/evaluation': '离线评测' }
  const current = Object.entries(pathNames).sort((a, b) => b[0].length - a[0].length).find(([path]) => location.pathname.startsWith(path))?.[1] ?? '知识工作台'
  return <div className="app-shell"><aside className="sidebar">
    <Link to={admin ? '/admin' : '/wiki'} className="sidebar-brand"><span className="brand-mark">g</span><span><strong>GuguWiki</strong><small>KNOWLEDGE SPACE</small></span></Link>
    <div className="sidebar-workspace"><span className="workspace-icon">G</span><span><strong>Gugu 工作区</strong><small>{admin ? '管理员工作台' : '团队知识空间'}</small></span><ChevronDown size={15} /></div>
    <nav className="nav-group"><span className="nav-label">探索知识</span><NavLink to="/wiki" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><BookOpen size={18} /> 知识库</NavLink><NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Search size={18} /> 全局搜索</NavLink><NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><MessageCircle size={18} /> AI 问答</NavLink></nav>
    {admin && <nav className="nav-group"><span className="nav-label">管理控制台</span><NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><LayoutDashboard size={18} /> 总览</NavLink><NavLink to="/admin/content" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><FolderOpen size={18} /> 内容管理</NavLink><NavLink to="/admin/access" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Users size={18} /> 权限管理</NavLink><NavLink to="/admin/lab" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><SlidersHorizontal size={18} /> 单次调试</NavLink><NavLink to="/admin/evaluation" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><FlaskConical size={18} /> 离线评测</NavLink></nav>}
    <div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={18} /><strong>让知识更可信</strong><p>每条回答都回到文档依据。</p></div><button className="profile" onClick={logout}><span className="avatar">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{admin ? '管理员' : '读者'}</small></span><LogOut size={17} /></button></div>
  </aside><div className="shell-main"><header className="topbar"><div className="crumb"><span>Gugu 工作区</span><ChevronRight size={15} /><strong>{current}</strong></div><div className="top-actions"><Link to="/search" className="top-search"><Search size={16} />搜索文档与知识<span>⌘ K</span></Link><span className="top-divider" /><div className="top-avatar">{user.name.slice(0, 1)}</div><button className="top-logout" onClick={logout} title="退出登录"><LogOut size={16} /><span>退出</span></button></div></header><main className="page-content"><Outlet /></main></div></div>
}

function WikiPage() {
  const kbs = useLoad(() => api.listKnowledgeBases(), [])
  const docs = useLoad(() => api.listDocuments(), [])
  const folders = useLoad(() => api.listFolders(), [])
  const [selectedKb, setSelectedKb] = useState<string>('all')
  const visibleDocs = (docs.data ?? []).filter(doc => selectedKb === 'all' || doc.knowledgeBaseId === selectedKb)
  const visibleFolders = (folders.data ?? []).filter(folder => selectedKb === 'all' || folder.knowledgeBaseId === selectedKb)
  const renderDocument = (doc: DocumentDto) => <Link to={`/wiki/${doc.id}`} className="doc-row" key={doc.id}><span className="doc-icon"><FileText size={19} /></span><span className="doc-main"><strong>{doc.title}</strong><small>{doc.summary}</small></span><Pill>{doc.kind === 'PDF' ? 'PDF' : 'Markdown'}</Pill><ArrowRight size={17} /></Link>
  const renderFolder = (folder: FolderDto): ReactNode => <div className="wiki-folder" key={folder.id}><div className="wiki-folder-title"><FolderOpen size={18} /><strong>{folder.title}</strong><span>{visibleDocs.filter(doc => doc.parentId === folder.id).length} 篇文档</span></div><div className="wiki-folder-children">{visibleFolders.filter(child => child.parentId === folder.id).map(renderFolder)}{visibleDocs.filter(doc => doc.parentId === folder.id).map(renderDocument)}</div></div>
  return <div className="page-wrap"><SectionTitle kicker="知识空间 / WIKI" title="把知识，放在触手可及的地方" description="浏览团队文档，或从一个问题开始探索。" action={<Link className="button primary" to="/search"><Search size={16} />搜索知识</Link>} />
    {(kbs.error || docs.error || folders.error) && <Notice message={kbs.error || docs.error || folders.error} />}
    <div className="summary-strip"><div><span className="summary-icon blue"><BookOpen size={21} /></span><span><strong>{kbs.data?.length ?? '—'}</strong><small>知识库</small></span></div><div><span className="summary-icon mint"><FileText size={21} /></span><span><strong>{docs.data?.length ?? '—'}</strong><small>文档</small></span></div><div><span className="summary-icon violet"><ShieldCheck size={21} /></span><span><strong>实时</strong><small>权限保护</small></span></div></div>
    <div className="content-heading"><div><span className="eyebrow">COLLECTIONS</span><h2>知识库</h2></div><span className="muted">所有成员共享知识库，读者查看已发布文档</span></div>
    <div className="kb-grid">{kbs.data?.map(kb => <button key={kb.id} className={`kb-card ${selectedKb === kb.id ? 'selected' : ''}`} onClick={() => setSelectedKb(selectedKb === kb.id ? 'all' : kb.id)}><span className={`kb-avatar ${kb.icon === 'J' ? 'j' : 'p'}`}>{kb.icon}</span><span className="kb-text"><strong>{kb.name}</strong><small>{kb.description}</small><span>{(docs.data ?? []).filter(doc => doc.knowledgeBaseId === kb.id).length} 篇文档 <ArrowRight size={14} /></span></span></button>)}</div>
    <div className="content-heading"><div><span className="eyebrow">DOCUMENTS</span><h2>{selectedKb === 'all' ? '最近更新' : kbs.data?.find(kb => kb.id === selectedKb)?.name}</h2></div><button className="text-button" onClick={() => setSelectedKb('all')}>查看全部 <ArrowRight size={15} /></button></div>
    {visibleDocs.length ? <div className="doc-list">{visibleFolders.filter(folder => !folder.parentId).map(renderFolder)}{visibleDocs.filter(doc => !doc.parentId).map(renderDocument)}</div> : <Empty title={kbs.loading || docs.loading || folders.loading ? '正在加载知识…' : '暂无可见文档'} detail="当前知识库还没有可阅读的发布版本。" />}
  </div>
}

function DocumentPage() {
  const { documentId = '' } = useParams()
  const doc = useLoad(() => api.getDocument(documentId), [documentId])
  const navigate = useNavigate()
  const [fileError, setFileError] = useState('')
  async function openOriginal() {
    try {
      const blob = await api.downloadOriginal(documentId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) { setFileError(errorText(cause)) }
  }
  return <div className="page-wrap article-wrap"><button className="text-button back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} />返回知识库</button>{doc.error && <Notice message={doc.error} />}{fileError && <Notice message={fileError} onClose={() => setFileError('')} />}
    {doc.data ? <div className="article-layout"><article className="article-card"><div className="article-meta"><Pill tone="blue">{doc.data.kind === 'PDF' ? 'PDF 文档' : 'Markdown 文档'}</Pill><span>已发布版本 {doc.data.versions.find(version => version.id === doc.data?.activeVersionId)?.number ?? 0}</span><span>·</span><span>权限实时校验</span></div><h1>{doc.data.title}</h1><p className="article-summary">{doc.data.summary}</p><div className="markdown-body"><ReactMarkdown>{doc.data.versions.find(version => version.id === doc.data?.activeVersionId)?.content ?? ''}</ReactMarkdown></div></article><aside className="article-aside"><div className="aside-card"><span className="eyebrow">DOCUMENT INFO</span><h3>关于这篇文档</h3><div className="aside-line"><span>格式</span><strong>{doc.data.kind}</strong></div><div className="aside-line"><span>当前版本</span><strong>{doc.data.activeVersionId ?? '未发布'}</strong></div>{doc.data.kind === 'PDF' && <button className="button outline wide" onClick={() => void openOriginal()}><FileDown size={16} />查看 PDF 原件</button>}</div><div className="aside-card accent-card"><Sparkles size={20} /><h3>还有疑问？</h3><p>让 AI 基于你有权限的文档回答，并附上出处。</p><Link className="button primary wide" to="/chat">去提问 <ArrowRight size={16} /></Link></div></aside></div> : !doc.loading && !doc.error && <Empty title="文档不存在" />}
  </div>
}

function SearchPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [hits, setHits] = useState<SearchHitDto[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const runSearch = useCallback(async (q: string) => { if (!q.trim()) return; setBusy(true); setError(''); setSearched(true); try { setHits(await api.search(q.trim())) } catch (cause) { setError(errorText(cause)); setHits([]) } finally { setBusy(false) } }, [])
  useEffect(() => { const q = params.get('q'); if (q) { setQuery(q); void runSearch(q) } }, [params, runSearch])
  function submit(event: FormEvent) { event.preventDefault(); setParams({ q: query.trim() }) }
  async function askAi() { const conversation = await api.createConversation(); navigate(`/chat/${encodeURIComponent(conversation.id)}?q=${encodeURIComponent(query)}`) }
  return <div className="page-wrap"><SectionTitle kicker="DISCOVER / SEARCH" title="搜索所有可访问的知识" description="关键词搜索给出文档结果；AI 问答会在相同权限范围内组织答案。" />
    <form className="hero-search" onSubmit={submit}><Search size={21} /><input autoFocus placeholder="例如：JVM 的运行时数据区是什么？" value={query} onChange={event => setQuery(event.target.value)} /><button className="button primary">搜索</button></form>
    {error && <Notice message={error} onClose={() => setError('')} />}
    {searched && <><div className="search-tabs"><button className="active"><FileText size={17} />文档结果 <span>{hits.length}</span></button><button onClick={askAi} disabled={!query.trim()}><Sparkles size={17} />用 AI 回答 <ArrowRight size={14} /></button></div><div className="results-meta">{busy ? '正在检索…' : `找到 ${hits.length} 篇与你的问题相关的文档`}</div>{hits.length ? <div className="result-list">{hits.map(hit => <Link className="result-card" to={`/wiki/${hit.documentId}`} key={hit.documentId}><span className="result-kind"><FileText size={15} />文档</span><h3>{hit.title}</h3><p>{hit.excerpt}</p><div><span>匹配分数 {scoreText(hit.score)}</span><span>查看文档 <ArrowRight size={15} /></span></div></Link>)}</div> : !busy && <Empty title="没有找到相关文档" detail="可以尝试换一种说法；AI 也只会根据可访问的知识库内容回答。" action={<button className="button outline" onClick={askAi}>用 AI 提问</button>} />}</>}
    {!searched && <div className="suggestions"><span className="eyebrow">试试这些问题</span>{['JVM 的定义和运行时数据区', '如何分析 GC 日志', '知识库引用如何使用'].map(item => <button key={item} onClick={() => setParams({ q: item })}><Search size={15} />{item}<ArrowRight size={14} /></button>)}</div>}
  </div>
}

function ChatPage() {
  const { conversationId } = useParams(); const navigate = useNavigate(); const [params] = useSearchParams()
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [detail, setDetail] = useState<ConversationDetailDto | null>(null)
  const [question, setQuestion] = useState('')
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string>('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const autoAsked = useRef<string>('')
  const refreshConversations = useCallback(async () => setConversations(await api.listConversations()), [])
  const refreshDetail = useCallback(async (id: string) => setDetail(await api.getConversation(id)), [])
  const waitForTerminal = useCallback(async (runId: string) => {
    let latest = await api.getRun(runId)
    for (let attempt = 0; attempt < 20 && (latest.status === RunStatus.RUNNING || latest.status === RunStatus.CANCEL_REQUESTED); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250))
      latest = await api.getRun(runId)
    }
    return latest
  }, [])
  useEffect(() => { void refreshConversations() }, [refreshConversations])
  useEffect(() => { if (conversationId) void refreshDetail(conversationId).catch(cause => setError(errorText(cause))); else setDetail(null) }, [conversationId, refreshDetail])
  useEffect(() => {
    const pending = [...(detail?.messages ?? [])].reverse().find(message => message.role === 'ASSISTANT' && message.runId && (message.status === RunStatus.RUNNING || message.status === RunStatus.CANCEL_REQUESTED))
    if (pending?.runId && !activeRun) { setActiveRun(pending.runId); setRunStatus(pending.status ?? RunStatus.RUNNING) }
  }, [detail, activeRun])
  useEffect(() => {
    if (!activeRun || !conversationId) return
    const timer = setInterval(() => void api.getRun(activeRun).then(async run => {
      setRunStatus(run.status)
      if (run.status === RunStatus.COMPLETED || run.status === RunStatus.CANCELLED || run.status === RunStatus.FAILED) { await refreshDetail(conversationId); setActiveRun(null) }
    }).catch(cause => setError(errorText(cause))), 1000)
    return () => clearInterval(timer)
  }, [activeRun, conversationId, refreshDetail])
  const patchAssistant = useCallback((event: ChatEventDto) => {
    setDetail(previous => previous ? { ...previous, messages: previous.messages.map(message => message.id !== event.messageId ? message : {
      ...message,
      content: event.type === 'delta' ? (message.content ?? '') + event.text : event.type === 'done' || event.type === 'cancelled' ? event.content : message.content,
      citations: event.type === 'citation' ? [...message.citations, event.citation] : message.citations,
      status: event.type === 'done' ? RunStatus.COMPLETED : event.type === 'cancel_requested' ? RunStatus.CANCEL_REQUESTED : event.type === 'cancelled' ? RunStatus.CANCELLED : event.type === 'error' ? RunStatus.FAILED : message.status,
    }) } : previous)
  }, [])
  const sendTo = useCallback(async (id: string, text: string) => {
    setError(''); setQuestion('')
    try {
      const run = await api.createRun(id, text); setActiveRun(run.id); setRunStatus(RunStatus.RUNNING)
      await refreshDetail(id); await refreshConversations()
      for await (const event of api.streamRun(run.id)) {
        patchAssistant(event)
        if (event.type === 'error') setError(event.message)
        if (event.type === 'done' || event.type === 'cancelled' || event.type === 'error') setRunStatus(event.status)
      }
      const final = await waitForTerminal(run.id)
      setRunStatus(final.status)
      await refreshDetail(id)
      if (final.status === RunStatus.RUNNING || final.status === RunStatus.CANCEL_REQUESTED) setError('事件流已断开，任务仍在运行。请停止生成或稍后刷新。')
      else setActiveRun(null)
    } catch (cause) { setError(errorText(cause)); setActiveRun(null) }
  }, [patchAssistant, refreshConversations, refreshDetail, waitForTerminal])
  useEffect(() => {
    const initial = params.get('q')
    if (conversationId && initial && autoAsked.current !== `${conversationId}:${initial}`) {
      autoAsked.current = `${conversationId}:${initial}`
      void sendTo(conversationId, initial)
    }
  }, [conversationId, params, sendTo])
  async function newConversation() { try { const conversation = await api.createConversation(); await refreshConversations(); navigate(`/chat/${encodeURIComponent(conversation.id)}`) } catch (cause) { setError(errorText(cause)) } }
  async function saveTitle(id: string) { try { await api.renameConversation(id, editingTitle); setEditingId(null); await refreshConversations(); if (id === conversationId) await refreshDetail(id) } catch (cause) { setError(errorText(cause)) } }
  async function removeConversation(id: string) { if (!window.confirm('删除这段对话及其消息？')) return; try { await api.deleteConversation(id); await refreshConversations(); if (id === conversationId) navigate('/chat') } catch (cause) { setError(errorText(cause)) } }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!question.trim() || activeRun) return
    let id = conversationId
    if (!id) { const conversation = await api.createConversation(); id = conversation.id; navigate(`/chat/${encodeURIComponent(id)}`) }
    await sendTo(id, question.trim())
  }
  async function cancel() {
    if (!activeRun) return
    try {
      const run = await api.cancelRun(activeRun); setRunStatus(run.status)
      const latest = await waitForTerminal(activeRun)
      setRunStatus(latest.status)
      if (conversationId) await refreshDetail(conversationId)
      if (latest.status === RunStatus.CANCELLED || latest.status === RunStatus.COMPLETED || latest.status === RunStatus.FAILED) setActiveRun(null)
      else setError('取消请求已发出，任务仍在停止中。请稍后刷新状态。')
    } catch (cause) { setError(errorText(cause)) }
  }
  return <div className="chat-layout"><aside className="chat-sidebar"><div className="chat-side-head"><div><span className="eyebrow">YOUR SPACE</span><h2>我的对话</h2></div><button className="icon-button solid" onClick={newConversation} title="新建对话"><Plus size={19} /></button></div><div className="chat-history">{conversations.map(item => <div className="chat-history-row" key={item.id}>{editingId === item.id ? <><input autoFocus value={editingTitle} onChange={event => setEditingTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void saveTitle(item.id); if (event.key === 'Escape') setEditingId(null) }} /><button className="icon-button" onClick={() => void saveTitle(item.id)} title="保存标题"><Check size={14} /></button></> : <><NavLink to={`/chat/${encodeURIComponent(item.id)}`} className={({ isActive }) => `chat-history-item ${isActive ? 'active' : ''}`}><MessageCircle size={16} /><span>{item.title}</span></NavLink><button className="history-action" onClick={() => { setEditingId(item.id); setEditingTitle(item.title) }} title="重命名">✎</button><button className="history-action" onClick={() => void removeConversation(item.id)} title="删除">×</button></>}</div>)}</div><div className="chat-side-note"><ShieldCheck size={17} />检索范围：全部已发布文档</div></aside>
    <div className="chat-main"><div className="chat-top"><div><span className="eyebrow">AI ANSWERS</span><h2>{detail?.conversation.title ?? '基于知识，开始对话'}</h2></div><Pill tone="green"><span className="status-dot" /> 已发布内容检索</Pill></div>
      <div className="chat-scroll">{error && <Notice message={error} onClose={() => setError('')} />}{detail?.messages.length ? <div className="message-list">{detail.messages.map(message => <div className={`message ${message.role === 'USER' ? 'user-message' : 'assistant-message'}`} key={message.id}><div className="message-avatar">{message.role === 'USER' ? '我' : 'g'}</div><div className="message-body"><div className="message-header"><strong>{message.role === 'USER' ? '你' : 'Gugu AI'}</strong><span>{dateText(message.createdAt)}</span>{message.status && <Pill tone={message.status === RunStatus.CANCELLED ? 'amber' : message.status === RunStatus.FAILED ? 'red' : 'neutral'}>{statusText[message.status]}</Pill>}</div>{message.redacted ? <div className="redacted"><LockKeyhole size={17} />该回答引用的文档权限已撤销，内容不再显示。</div> : <div className="message-content">{message.content || (message.status === RunStatus.RUNNING ? <span className="typing">正在查找依据<span>···</span></span> : '')}</div>}{message.citations.length > 0 && !message.redacted && <div className="citations"><span>引用来源</span>{message.citations.map(citation => <Link to={`/wiki/${citation.documentId}`} key={`${message.id}-${citation.documentId}`}><FileText size={15} />{citation.title}<ArrowRight size={14} /></Link>)}</div>}</div></div>)}</div> : <div className="chat-welcome"><div className="chat-spark"><Sparkles size={30} /></div><span className="eyebrow">GUGUWIKI AI</span><h1>今天想了解什么？</h1><p>我会从你有权限的知识库中检索证据，找不到足够资料时会明确告诉你。</p><div className="prompt-grid">{['JVM 的定义和运行时数据区', '如何分析 GC 日志', '知识库的引用如何使用'].map(item => <button key={item} onClick={() => setQuestion(item)}><span>{item}</span><ArrowRight size={15} /></button>)}</div></div>}</div>
      <div className="chat-composer-wrap">{runStatus === RunStatus.CANCEL_REQUESTED && <div className="composer-status"><Clock3 size={15} />正在请求停止，已生成内容会保留…</div>}<form className="chat-composer" onSubmit={submit}><textarea placeholder="输入问题，引用会随回答出现…" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} disabled={!!activeRun} /><div className="composer-bottom"><span><ShieldCheck size={14} />仅使用授权文档</span>{activeRun ? <button type="button" className="button cancel" onClick={cancel} disabled={runStatus === RunStatus.CANCEL_REQUESTED}><Square size={14} />{runStatus === RunStatus.CANCEL_REQUESTED ? '取消中' : '停止生成'}</button> : <button className="button primary" disabled={!question.trim()}><Send size={15} />发送</button>}</div></form><p className="composer-footnote">AI 回答可能不完整，请以引用的原始文档为准。</p></div>
    </div></div>
}

function AdminOverview() {
  const kbs = useLoad(() => api.listKnowledgeBases(), [])
  const docs = useLoad(() => api.listDocuments(), [])
  const strategy = useLoad(() => api.getActiveStrategy(), [])
  const [demo, setDemo] = useState<Awaited<ReturnType<typeof api.getDemoState>>>(null)
  const [error, setError] = useState('')
  useEffect(() => { void api.getDemoState().then(setDemo) }, [])
  async function changeScenario(scenario: DemoScenario) { try { setDemo(await api.setDemoScenario(scenario)); setError('') } catch (cause) { setError(errorText(cause)) } }
  async function reset() { await api.resetDemo(); window.location.assign('/login') }
  return <div className="page-wrap"><SectionTitle kicker="ADMIN / OVERVIEW" title="知识工作台总览" description="管理内容发布，观察检索策略，让每份知识安全地被使用。" action={<Link to="/admin/content" className="button primary"><Plus size={16} />管理文档</Link>} />
    {error && <Notice message={error} />}
    <div className="metric-grid"><div className="metric-card"><span className="metric-icon blue"><Database size={21} /></span><small>知识库</small><strong>{kbs.data?.length ?? '—'}</strong><p>所有读者共享已发布内容</p></div><div className="metric-card"><span className="metric-icon violet"><FileText size={21} /></span><small>文档总数</small><strong>{docs.data?.length ?? '—'}</strong><p>含草稿与已发布版本</p></div><div className="metric-card"><span className="metric-icon mint"><Check size={21} /></span><small>已发布</small><strong>{docs.data?.filter(doc => doc.activeVersionId).length ?? '—'}</strong><p>对读者开放并可检索</p></div><div className="metric-card"><span className="metric-icon amber"><Activity size={21} /></span><small>当前策略</small><strong className="metric-strategy">{strategy.data?.name ?? '—'}</strong><p>保存实验后人工启用</p></div></div>
    <div className="admin-home-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>从文档到可信回答</h2></div></div><div className="workflow"><div><span className="step-number">01</span><div><strong>维护知识内容</strong><p>导入或编辑草稿；发布后所有读者都可以访问。</p></div></div><div><span className="step-number">02</span><div><strong>索引成功后发布</strong><p>新版本准备完成后，原子切换 active_version_id。</p></div></div><div><span className="step-number">03</span><div><strong>检索实验与上线</strong><p>在相同快照下比较策略，再人工启用正式配置。</p></div></div></div></div><div className="panel quick-panel"><span className="eyebrow">QUICK ACCESS</span><h2>继续工作</h2><Link to="/admin/content"><FolderOpen size={18} /><span>内容管理</span><ArrowRight size={16} /></Link><Link to="/admin/lab"><SlidersHorizontal size={18} /><span>单次 Query 调试</span><ArrowRight size={16} /></Link><Link to="/admin/evaluation"><FlaskConical size={18} /><span>离线评测</span><ArrowRight size={16} /></Link><Link to="/admin/access"><ShieldCheck size={18} /><span>账号与角色</span><ArrowRight size={16} /></Link></div></div>
    {demo && <div className="panel demo-panel"><div><span className="eyebrow">MOCK CONTROL</span><h2>确定性演示场景</h2><p>切换故障后，可到问答、发布或实验室观察对应状态。重置将恢复固定数据。</p></div><div className="demo-actions"><select value={demo.scenario} onChange={event => void changeScenario(event.target.value as DemoScenario)}><option value="NORMAL">正常链路</option><option value="FTS_DOWN">FTS 单路故障</option><option value="VECTOR_DOWN">向量单路故障</option><option value="AUTHZ_FAIL">权限检查失败</option><option value="NO_EVIDENCE">证据不足</option><option value="PUBLISH_FAIL">发布索引失败</option></select><button className="button outline" onClick={reset}><RotateCcw size={15} />重置演示数据</button></div></div>}
  </div>
}

function AdminContent() {
  const kbs = useLoad(() => api.listKnowledgeBases(), [])
  const docs = useLoad(() => api.listDocuments(), [])
  const folders = useLoad(() => api.listFolders(), [])
  const [selectedKb, setSelectedKb] = useState('kb-java')
  const [selectedId, setSelectedId] = useState('doc-jvm')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocumentDto | null>(null)
  const [title, setTitle] = useState(''); const [content, setContent] = useState('')
  const [job, setJob] = useState<PublishJobDto | null>(null)
  const [importJob, setImportJob] = useState<ImportJobDto | null>(null)
  const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const [newKb, setNewKb] = useState(''); const [newFolder, setNewFolder] = useState(''); const [newDoc, setNewDoc] = useState('')
  useEffect(() => { if (selectedId) void api.getDocument(selectedId).then(value => { setDoc(value); setTitle(value.title); setContent(value.draftContent) }).catch(cause => setError(errorText(cause))) }, [selectedId])
  useEffect(() => { if (!job || job.status !== JobStatus.RUNNING) return; const timer = setInterval(() => void api.getPublishJob(job.id).then(value => { setJob(value); if (value.status !== JobStatus.RUNNING) { void docs.refresh(); void api.getDocument(selectedId).then(setDoc); setMessage(value.status === JobStatus.SUCCEEDED ? '新版本已索引并正式生效。' : value.error ?? '发布失败。') } }), 450); return () => clearInterval(timer) }, [job, selectedId, docs.refresh])
  useEffect(() => { if (!importJob || importJob.status !== JobStatus.RUNNING) return; const timer = setInterval(() => void api.getImportJob(importJob.id).then(value => { setImportJob(value); if (value.status !== JobStatus.RUNNING) { void docs.refresh(); setMessage(value.status === JobStatus.SUCCEEDED ? '导入完成，文档已成为草稿。' : value.error ?? '导入失败。'); if (value.documentId) setSelectedId(value.documentId) } }), 450); return () => clearInterval(timer) }, [importJob, docs.refresh])
  async function save() { if (!doc) return; try { const value = await api.saveDraft(doc.id, doc.draftRevision, title, content); setDoc(value); setMessage('草稿已保存，读者仍看到旧发布版本。'); setError(''); void docs.refresh() } catch (cause) { setError(errorText(cause)) } }
  async function publish() { if (!doc) return; try { setJob(await api.startPublish(doc.id, doc.draftRevision)); setMessage('正在构建索引，旧版本继续可见。'); setError('') } catch (cause) { setError(errorText(cause)) } }
  async function createKb() { if (!newKb.trim()) return; try { const value = await api.createKnowledgeBase(newKb, ''); setNewKb(''); setSelectedKb(value.id); setSelectedFolderId(null); setSelectedId(''); setDoc(null); await kbs.refresh(); setMessage('知识库已创建。') } catch (cause) { setError(errorText(cause)) } }
  async function createFolder() { if (!newFolder.trim()) return; try { const value = await api.createFolder(selectedKb, selectedFolderId, newFolder); setNewFolder(''); setSelectedFolderId(value.id); await folders.refresh(); setMessage('目录已创建。') } catch (cause) { setError(errorText(cause)) } }
  async function createDoc() { if (!newDoc.trim()) return; try { const value = await api.createDocument(selectedKb, selectedFolderId, newDoc); setNewDoc(''); setSelectedId(value.id); await docs.refresh(); setMessage('新文档草稿已创建。') } catch (cause) { setError(errorText(cause)) } }
  async function importFile(file?: File) { if (!file) return; try { setImportJob(await api.importFile(selectedKb, selectedFolderId, file)); setError(''); setMessage('正在解析导入文件…') } catch (cause) { setError(errorText(cause)) } }
  const kbDocs = docs.data?.filter(item => item.knowledgeBaseId === selectedKb) ?? []
  const kbFolders = folders.data?.filter(item => item.knowledgeBaseId === selectedKb) ?? []
  const renderTreeDoc = (item: DocumentDto, depth: number) => <button key={item.id} className={selectedId === item.id ? 'active' : ''} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => { setSelectedId(item.id); setSelectedFolderId(item.parentId) }}><FileText size={16} /><span>{item.title}</span>{!item.activeVersionId && <i />}</button>
  const renderTreeFolder = (folder: FolderDto, depth: number): ReactNode => <div className="tree-folder" key={folder.id}><button className={selectedFolderId === folder.id ? 'active' : ''} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => setSelectedFolderId(folder.id)}><FolderOpen size={16} /><span>{folder.title}</span></button>{kbFolders.filter(child => child.parentId === folder.id).map(child => renderTreeFolder(child, depth + 1))}{kbDocs.filter(item => item.parentId === folder.id).map(item => renderTreeDoc(item, depth + 1))}</div>
  return <div className="page-wrap"><SectionTitle kicker="ADMIN / CONTENT" title="内容管理" description="草稿编辑、文件导入与版本发布都在这里完成。" />{error && <Notice message={error} onClose={() => setError('')} />}{message && <div className="success-note"><Check size={16} />{message}<button className="icon-button" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div className="content-manager"><aside className="manager-tree"><div className="tree-head"><span className="eyebrow">知识目录</span><MoreHorizontal size={17} /></div><div className="tree-kbs">{kbs.data?.map(kb => <button className={`tree-kb ${selectedKb === kb.id ? 'active' : ''}`} key={kb.id} onClick={() => { setSelectedKb(kb.id); setSelectedFolderId(null); const first = docs.data?.find(doc => doc.knowledgeBaseId === kb.id); setSelectedId(first?.id ?? ''); if (!first) setDoc(null) }}><span className="tree-kb-icon">{kb.icon}</span>{kb.name}<ChevronDown size={14} /></button>)}</div><div className="tree-docs">{kbFolders.filter(folder => !folder.parentId).map(folder => renderTreeFolder(folder, 0))}{kbDocs.filter(item => !item.parentId).map(item => renderTreeDoc(item, 0))}</div><div className="tree-actions"><span className="tree-target">创建位置：{selectedFolderId ? kbFolders.find(folder => folder.id === selectedFolderId)?.title : '知识库根目录'} <button onClick={() => setSelectedFolderId(null)}>切换到根目录</button></span><div><input placeholder="新知识库名称" value={newKb} onChange={event => setNewKb(event.target.value)} /><button onClick={createKb} title="创建知识库"><Plus size={16} /></button></div><div><input placeholder="新目录名称" value={newFolder} onChange={event => setNewFolder(event.target.value)} /><button onClick={createFolder} title="在当前位置创建目录"><Plus size={16} /></button></div><div><input placeholder="新文档标题" value={newDoc} onChange={event => setNewDoc(event.target.value)} /><button onClick={createDoc} title="在当前位置创建文档"><Plus size={16} /></button></div><label className="upload-label"><UploadCloud size={16} />导入 Markdown / PDF<input type="file" accept=".md,.pdf" onChange={event => { void importFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div></aside>
      <div className="editor-panel">{doc ? <><div className="editor-toolbar"><div><span className="eyebrow">DOCUMENT EDITOR</span><h2>{doc.title}</h2><div className="editor-meta"><Pill tone={doc.activeVersionId ? 'green' : 'amber'}>{doc.activeVersionId ? '已发布' : '未发布'}</Pill><span>草稿修订 {doc.draftRevision}</span><span>生效版本 {doc.activeVersionId ?? '无'}</span></div></div><div className="toolbar-actions"><button className="button outline" onClick={save} disabled={doc.kind === 'PDF'}>保存草稿</button><button className="button primary" onClick={publish} disabled={job?.status === JobStatus.RUNNING}><Play size={15} />{job?.status === JobStatus.RUNNING ? '发布中…' : '发布新版本'}</button></div></div>
        {job && <div className={`job-banner ${job.status === JobStatus.FAILED ? 'fail' : ''}`}><Activity size={17} /><span>发布任务 {statusText[job.status]} · {job.error ?? '索引成功后，Wiki 与问答会一起切换到新版本。'}</span></div>}
        {importJob && <div className={`job-banner ${importJob.status === JobStatus.FAILED ? 'fail' : ''}`}><UploadCloud size={17} /><span>导入 {importJob.fileName} · {statusText[importJob.status]} {importJob.error ?? ''}</span></div>}
        <div className="editor-fields"><label>文档标题<input value={title} onChange={event => setTitle(event.target.value)} disabled={doc.kind === 'PDF'} /></label><label>Markdown 正文<textarea value={content} onChange={event => setContent(event.target.value)} disabled={doc.kind === 'PDF'} spellCheck={false} /></label></div><div className="acl-box"><div><ShieldCheck size={18} /><strong>内容可见范围</strong><span>所有读者可查看已发布版本</span></div><p>管理员可以编辑和发布文档；未发布的草稿仅管理员可见。</p></div></> : <Empty title="选择一篇文档" detail="从左侧目录打开草稿，或创建新文档。" />}</div></div>
  </div>
}

function AdminAccess() {
  const users = useLoad(() => api.listUsers(), [])
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'READER' | 'ADMIN'>('READER')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [error, setError] = useState(''); const [message, setMessage] = useState('')
  async function addUser() { try { await api.createUser(newUserName, newUserEmail, newUserRole, newUserPassword); setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); await users.refresh(); setMessage('账号已创建。') } catch (cause) { setError(errorText(cause)) } }
  return <div className="page-wrap"><SectionTitle kicker="ADMIN / ACCESS" title="账号与角色" description="系统仅区分读者和管理员：读者查看已发布内容，管理员管理账号和全部知识内容。" />
    {error && <Notice message={error} onClose={() => setError('')} />}{message && <div className="success-note"><Check size={16} />{message}<button className="icon-button" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div className="access-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">PEOPLE</span><h2>成员账号</h2></div><Pill>{users.data?.length ?? 0} 位成员</Pill></div><div className="user-list">{users.data?.map(user => <div key={user.id} className="user-row"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><span className="user-role">角色：{user.role === 'ADMIN' ? '管理员' : '读者'}</span></div>)}</div></div>
    <div className="panel"><div className="panel-heading"><div><span className="eyebrow">ROLE POLICY</span><h2>角色权限</h2></div><ShieldCheck size={20} /></div><div className="policy-list"><div><span>01</span><p>读者可查看所有已发布的知识库和文档。</p></div><div><span>02</span><p>管理员可创建、编辑、导入和发布全部知识内容。</p></div><div><span>03</span><p>用户只能读取和操作自己的问答会话。</p></div><div><span>04</span><p>草稿仅管理员可见，读者只看到已发布版本。</p></div></div></div></div>
    <div className="panel"><div className="panel-heading"><div><span className="eyebrow">CREATE ACCOUNT</span><h2>创建账号</h2></div></div><div className="create-user-grid"><label>姓名<input value={newUserName} onChange={event => setNewUserName(event.target.value)} placeholder="成员姓名" /></label><label>邮箱<input type="email" value={newUserEmail} onChange={event => setNewUserEmail(event.target.value)} placeholder="name@example.com" /></label><label>角色<select value={newUserRole} onChange={event => setNewUserRole(event.target.value as 'READER' | 'ADMIN')}><option value="READER">读者</option><option value="ADMIN">管理员</option></select></label><label>初始密码<input type="password" value={newUserPassword} onChange={event => setNewUserPassword(event.target.value)} placeholder="至少 8 位" /></label></div><button className="button primary create-user-button" onClick={addUser}><Plus size={15} />创建账号</button></div>
  </div>
}

function ConfigEditor({ value, onChange }: { value: RetrievalConfigDto; onChange: (value: RetrievalConfigDto) => void }) {
  function number(key: keyof RetrievalConfigDto, next: string) { onChange({ ...value, [key]: Number(next) }) }
  const numberFields: Array<{ key: keyof RetrievalConfigDto; label: string; hint?: string; step?: string; min?: string }> = [
    { key: 'ftsTopK', label: 'FTS Top-K' }, { key: 'vectorTopK', label: '向量 Top-K' }, { key: 'finalTopK', label: '最终 Top-K' },
    { key: 'rrfK', label: 'RRF k' }, { key: 'ftsWeight', label: 'FTS 权重', step: '0.1' }, { key: 'vectorWeight', label: '向量权重', step: '0.1' },
    { key: 'ftsMinScore', label: 'FTS 最低分', hint: '仅比较 FTS 分数', step: '0.01' }, { key: 'vectorMinSimilarity', label: '向量最低相似度', hint: '仅比较向量分数', step: '0.01' },
    { key: 'rerankMinScore', label: '重排最低分', step: '0.01', min: '' }, { key: 'rerankTopK', label: '重排 Top-K', min: '1' }, { key: 'minEvidenceCount', label: '最少有效证据数', min: '1' },
  ]
  return <div className="config-editor"><div className="config-grid">{numberFields.map(field => <label key={field.key}>{field.label}<input type="number" min={field.min ?? (field.key === 'vectorMinSimilarity' ? '-1' : field.key === 'ftsMinScore' || field.key === 'ftsWeight' || field.key === 'vectorWeight' ? '0' : '1')} step={field.step ?? '1'} value={value[field.key] as number} onChange={event => number(field.key, event.target.value)} />{field.hint && <small>{field.hint}</small>}</label>)}</div><div className="config-toggles"><label><input type="checkbox" checked={value.rerankEnabled} onChange={event => onChange({ ...value, rerankEnabled: event.target.checked })} />启用重排</label><label><input type="checkbox" checked={value.coverageCheckEnabled} onChange={event => onChange({ ...value, coverageCheckEnabled: event.target.checked })} />启用证据问题覆盖判断</label></div></div>
}

function CandidateList({ title, items, tone }: { title: string; items: CandidateDto[]; tone: 'blue' | 'violet' | 'green' }) {
  return <div className="candidate-column"><div className="candidate-title"><span className={`lane-dot ${tone}`} /><strong>{title}</strong><span>{items.length} 条</span></div>{items.length ? items.map(item => <div className="candidate" key={`${title}-${item.documentId}`}><span className="candidate-rank">#{item.rank}</span><div><strong>{item.title}</strong><p>{item.excerpt}</p><small>版本 {item.versionId}</small></div><span className="candidate-score">{scoreText(item.score)}</span></div>) : <div className="candidate-empty">该路暂无候选，或已模拟故障。</div>}</div>
}

function LabDebug() {
  const strategy = useLoad(() => api.getActiveStrategy(), [])
  const [query, setQuery] = useState('JVM 的定义和运行时数据区')
  const [config, setConfig] = useState<RetrievalConfigDto>(defaultConfig)
  const [result, setResult] = useState<DebugResultDto | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { if (strategy.data) setConfig(strategy.data.config) }, [strategy.data])
  async function run() { setBusy(true); setError(''); try { setResult(await api.debugQuery(query, config)) } catch (cause) { setResult(null); setError(errorText(cause)) } finally { setBusy(false) } }
  return <div className="page-wrap"><SectionTitle kicker="RETRIEVAL LAB / DEBUG" title="单次 Query 调试" description="查看两路候选、融合与重排的每一步。这个入口不会创建离线评测快照。" action={<Link to="/admin/evaluation" className="button outline"><FlaskConical size={16} />离线评测</Link>} />
    {error && <Notice message={error} onClose={() => setError('')} />}
    <div className="panel lab-input"><div className="lab-input-main"><label>查询内容<input value={query} onChange={event => setQuery(event.target.value)} placeholder="输入要调试的问题" /></label><p>检索范围：所有已发布文档。</p></div><button className="button primary" onClick={run} disabled={busy || !query.trim()}><Play size={16} />{busy ? '检索中…' : '运行调试'}</button></div>
    <details className="panel config-panel"><summary><Settings2 size={18} /><span>检索参数</span><small>FTS、向量与重排阈值分别设置</small><ChevronDown size={16} /></summary><ConfigEditor value={config} onChange={setConfig} /></details>
    {result ? <><div className="lab-summary"><div><span className="eyebrow">RESULT</span><h2>{result.sufficient ? '证据足够，可以回答' : '证据不足，拒绝生成'}</h2><p>{result.answerPreview}</p></div><Pill tone={result.sufficient ? 'green' : 'amber'}>{result.degradedLane ? `${result.degradedLane} 故障 · 单路降级` : result.sufficient ? '双路正常' : '安全弃答'}</Pill></div><div className="timing-row">{Object.entries(result.timingsMs).map(([key, value]) => <div key={key}><small>{({ fts: 'FTS', vector: '向量', fusion: 'RRF 融合', rerank: '重排', total: '总耗时' } as Record<string, string>)[key]}</small><strong>{value} <span>ms</span></strong></div>)}</div><div className="candidate-grid"><CandidateList title="FTS 候选" items={result.fts} tone="blue" /><CandidateList title="向量候选" items={result.vector} tone="violet" /></div><div className="candidate-grid"><CandidateList title="RRF 融合" items={result.fused} tone="green" /><CandidateList title="最终重排" items={result.reranked} tone="violet" /></div></> : <Empty title="运行一次检索，查看完整路径" detail="候选检索先执行服务端权限过滤，再排序并截取 Top-K。" />}
  </div>
}

function EvaluationPage() {
  const datasets = useLoad(() => api.listDatasets(), [])
  const runs = useLoad(() => api.listEvaluationRuns(), [])
  const strategy = useLoad(() => api.getActiveStrategy(), [])
  const [datasetId, setDatasetId] = useState('dataset-core')
  const [snapshot, setSnapshot] = useState<EvaluationSnapshotDto | null>(null)
  const [config, setConfig] = useState<RetrievalConfigDto>(defaultConfig)
  const [name, setName] = useState('混合检索基线')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { if (strategy.data) setConfig(strategy.data.config) }, [strategy.data])
  useEffect(() => { if (!runs.data?.some(item => item.status === JobStatus.RUNNING || item.status === JobStatus.PENDING)) return; const timer = setInterval(() => void runs.refresh(), 1200); return () => clearInterval(timer) }, [runs.data, runs.refresh])
  async function freeze() { setBusy(true); setError(''); try { setSnapshot(await api.createEvaluationSnapshot(datasetId)); setMessage('实验快照已冻结。接下来可在相同快照上运行多组参数。') } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) } }
  async function run() { if (!snapshot) return; setBusy(true); setError(''); try { const result = await api.runEvaluation(snapshot.id, name, config); await runs.refresh(); setSelectedRunId(result.id); setMessage(result.status === JobStatus.SUCCEEDED ? `实验「${result.name}」已保存。修改参数后可在同一快照上继续比较。` : `实验「${result.name}」已提交，完成后会自动更新结果。`) } catch (cause) { setError(errorText(cause)); if (cause instanceof ApiError && cause.status === 409) setSnapshot(null) } finally { setBusy(false) } }
  async function activate(id: string) { try { const value = await api.activateStrategy(id); await strategy.refresh(); setMessage(`「${value.name}」已启用为正式检索策略。`) } catch (cause) { setError(errorText(cause)) } }
  return <div className="page-wrap"><SectionTitle kicker="RETRIEVAL LAB / EVALUATION" title="离线评测" description="冻结已发布语料和标注，在相同条件下比较不同检索策略。" action={<Link to="/admin/lab" className="button outline"><SlidersHorizontal size={16} />单次调试</Link>} />
    {error && <Notice message={error} onClose={() => setError('')} />}{message && <div className="success-note"><Check size={16} />{message}<button className="icon-button" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div className="panel eval-setup"><div className="panel-heading"><div><span className="eyebrow">STEP 01</span><h2>冻结评测快照</h2></div><Pill tone={snapshot ? 'green' : 'neutral'}>{snapshot ? '已冻结' : '未创建'}</Pill></div><div className="eval-setup-grid"><label>标注数据集<select value={datasetId} onChange={event => { setDatasetId(event.target.value); setSnapshot(null) }}>{datasets.data?.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cases.length} 条 Query</option>)}</select></label><p>评测使用全部已发布文档。</p></div><button className="button primary" onClick={freeze} disabled={busy}><Database size={16} />冻结文档版本</button>{snapshot && <div className="snapshot-info"><Hash size={16} /><span>快照 {snapshot.id}</span><span>语料 {snapshot.corpusFingerprint}</span><span>权限策略 {snapshot.permissionFingerprint}</span><span>{Object.keys(snapshot.documentVersions).length} 篇文档</span></div>}</div>
    <div className="panel eval-run"><div className="panel-heading"><div><span className="eyebrow">STEP 02</span><h2>运行策略对比</h2></div></div><label className="run-name">实验名称<input value={name} onChange={event => setName(event.target.value)} /></label><details className="embedded-config"><summary><Settings2 size={17} />调整检索参数 <ChevronDown size={16} /></summary><ConfigEditor value={config} onChange={setConfig} /></details><div className="eval-action-row"><span>当前正式策略：<strong>{strategy.data?.name ?? '—'}</strong></span><button className="button primary" onClick={run} disabled={!snapshot || busy}><Play size={16} />{busy ? '评测中…' : '运行离线评测'}</button></div></div>
    <div className="panel"><div className="panel-heading"><div><span className="eyebrow">RESULTS</span><h2>已保存实验</h2></div><Pill>{runs.data?.length ?? 0} 次</Pill></div>{runs.data?.length ? <div className="table-wrap"><table><thead><tr><th>实验 / 快照</th><th>Recall@K</th><th>MRR</th><th>nDCG</th><th>P50 / P95</th><th>状态</th><th>操作</th></tr></thead><tbody>{runs.data.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.snapshotId} · {dateText(item.createdAt)}</small></td><td>{(item.metrics.recallAtK * 100).toFixed(0)}%</td><td>{item.metrics.mrr.toFixed(2)}</td><td>{item.metrics.ndcg.toFixed(2)}</td><td>{item.metrics.p50Ms} / {item.metrics.p95Ms} ms</td><td><Pill tone={item.redacted ? 'red' : item.status === JobStatus.SUCCEEDED ? 'green' : 'amber'}>{item.redacted ? '权限变化 · 结果隐藏' : statusText[item.status]}</Pill></td><td><div className="result-actions"><button className="text-button" disabled={item.redacted} onClick={() => setSelectedRunId(selectedRunId === item.id ? null : item.id)}>查看结果</button><button className="text-button" disabled={item.redacted || item.status !== JobStatus.SUCCEEDED} onClick={() => void activate(item.id)}>设为正式策略 <ArrowRight size={14} /></button></div></td></tr>)}</tbody></table></div> : <Empty title="还没有评测结果" detail="先冻结快照，再运行第一组检索参数。" />}</div>
    {runs.data?.find(item => item.id === selectedRunId && !item.redacted) && <div className="panel eval-details"><div className="panel-heading"><div><span className="eyebrow">QUERY RESULTS</span><h2>{runs.data.find(item => item.id === selectedRunId)?.name} · 逐题结果</h2></div><button className="icon-button" onClick={() => setSelectedRunId(null)} title="关闭结果"><X size={16} /></button></div><div className="query-results">{runs.data.find(item => item.id === selectedRunId)?.results.map(item => <div key={item.caseId}><strong>{item.query}</strong><span>排名：{item.rankedDocumentIds.join(' → ') || '无有效候选'}</span><small>{item.totalMs} ms</small></div>)}</div></div>}
  </div>
}
