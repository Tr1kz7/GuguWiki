import { examples, param as P } from './api-catalog.mjs'

const O = (group,title,method,path,description,params,response,body,errors,extra={}) => ({group,title,method,path,description,params,response,body,errors,...extra})
const pathId = (name,meaning) => P('Path',name,'string','是',meaning)
const body = (name,type,meaning,required='是') => P('Body',name,type,required,meaning)
const query = (name,type,meaning,required='否') => P('Query',name,type,required,meaning)

export const groups = [
  {name:'认证',auth:'登录接口公开，其余需有效的 Authorization Token'},
  {name:'用户与授权管理',auth:'管理员 Token；Java 校验 ADMIN 角色'},
  {name:'Wiki 与搜索',auth:'需登录 Token；读者查看已发布文档，管理员可查看草稿'},
  {name:'内容与版本管理',auth:'管理员 Token；Java 校验 ADMIN 角色'},
  {name:'会话与问答',auth:'需登录 Token；Java 校验会话归属'},
  {name:'检索实验室',auth:'调试与评测需管理员 Token'},
  {name:'内部 Java → Python',auth:'仅服务网络；双向服务凭据'},
  {name:'内部 Python → Java',auth:'仅服务网络；服务凭据 + 短期 scopeToken'},
]

export const operations = [
  // 1. 认证
  O('认证','登录','POST','/api/v1/auth/login','按邮箱读取账号及 password_hash，用 BCrypt 验证明文密码；账号启用且入口角色合法后，生成随机 Token，Redis 存 userId 并设置 30 分钟滑动过期。',[body('email','string','登录邮箱'),body('password','string','用户输入的明文密码，仅用于本次校验'),body('entry','READER | ADMIN','请求进入的页面类型；不授予角色')],'UserDto',{email:'reader@guguwiki.dev',password:'<用户密码>',entry:'READER'},['400 VALIDATION_ERROR','401 UNAUTHENTICATED','403 FORBIDDEN'],{auth:'公开',successMessage:'欢迎登录，林同学！'}),
  O('认证','恢复登录','GET','/api/v1/auth/me','前端刷新后携带 Token，Redis 恢复登录用户并延长有效期。',[],'UserDto',undefined,['401 UNAUTHENTICATED'],{auth:'需登录 Token'}),
  O('认证','退出登录','POST','/api/v1/auth/logout','删除当前 Redis Token，令其立即失效。',[],'204',undefined,['401 UNAUTHENTICATED'],{auth:'需登录 Token'}),

  // 2. Wiki 与搜索
  O('Wiki 与搜索','列出知识库','GET','/api/v1/knowledge-bases','返回全部知识库；不按用户分组或知识库单独授权。读者可查看其中已发布的文档，管理员可查看草稿。',[],'KnowledgeBaseDto[]',undefined,['401 UNAUTHENTICATED']),
  O('Wiki 与搜索','列出目录','GET','/api/v1/folders','读者查看包含已发布后代文档的目录；管理员可查看全部目录。',[query('knowledgeBaseId','string','按知识库筛选')],'FolderDto[]',undefined,['401 UNAUTHENTICATED','403 FORBIDDEN']),
  O('Wiki 与搜索','列出文档','GET','/api/v1/documents','读者查看所有已发布文档；管理员还可查看未发布草稿。',[query('knowledgeBaseId','string','按知识库筛选')],'DocumentDto[]',undefined,['401 UNAUTHENTICATED','403 FORBIDDEN'],{responseExample:[{...examples.DocumentDto,draftContent:''}]}),
  O('Wiki 与搜索','读取文档正文','GET','/api/v1/documents/{id}','读者读取已发布的生效版本；管理员还可读取未发布草稿。',[pathId('id','文档 ID')],'DocumentDto',undefined,['401 UNAUTHENTICATED','403 FORBIDDEN','404 NOT_FOUND'],{responseExample:{...examples.DocumentDto,draftContent:examples.DocumentVersionDto.content}}),
  O('Wiki 与搜索','下载 PDF 原件','GET','/api/v1/documents/{id}/original','读者仅可下载已发布 PDF 的原件；管理员还可下载未发布 PDF 的原件。原件通过受控接口返回。',[pathId('id','PDF 文档 ID')],'application/pdf',undefined,['401 UNAUTHENTICATED','403 FORBIDDEN','404 NOT_FOUND']),
  O('Wiki 与搜索','关键词搜索','GET','/api/v1/search','在全部已发布文档的 active_version_id 内检索；候选发布状态过滤先于 Top-K。',[query('q','string','搜索词','是')],'SearchHitDto[]',undefined,['400 VALIDATION_ERROR','503 AUTHZ_UNAVAILABLE']),

  // 3. 内容与版本管理
  O('内容与版本管理','新建知识库','POST','/api/v1/admin/knowledge-bases','创建知识空间；所有读者均可访问其中已发布的文档。',[body('name','string','知识库名称'),body('description','string','说明')],'KnowledgeBaseDto',{name:'Java 工程实践',description:'语言、虚拟机与性能调优'},['400 VALIDATION_ERROR','403 FORBIDDEN']),
  O('内容与版本管理','新建目录','POST','/api/v1/admin/folders','在知识库或上级目录下创建目录；目录不单独授权。',[body('knowledgeBaseId','string','所属知识库'),body('parentId','string | null','上级目录；null 为根目录'),body('title','string','目录名称')],'FolderDto',{knowledgeBaseId:'kb-java',parentId:null,title:'虚拟机与性能'},['400 VALIDATION_ERROR','404 NOT_FOUND']),
  O('内容与版本管理','新建 Markdown 草稿','POST','/api/v1/admin/documents','创建未发布文档，目录须属于指定知识库。',[body('knowledgeBaseId','string','所属知识库'),body('parentId','string | null','所属目录；null 为根目录'),body('title','string','草稿标题')],'DocumentDto',{knowledgeBaseId:'kb-java',parentId:'folder-jvm',title:'JVM 基础'},['400 VALIDATION_ERROR','404 NOT_FOUND']),
  O('内容与版本管理','保存草稿','PUT','/api/v1/admin/documents/{id}/draft','用 expectedRevision 做乐观锁；读者仍看到旧生效版本。',[pathId('id','文档 ID'),body('expectedRevision','number','调用方读到的草稿修订号'),body('title','string','新标题'),body('content','string','Markdown 正文')],'DocumentDto',{expectedRevision:2,title:'JVM 基础与运行时数据区',content:'# JVM 基础与运行时数据区\n\nJVM 是 Java 虚拟机。'},['400 VALIDATION_ERROR','409 CONFLICT']),
  O('内容与版本管理','导入 Markdown 或 PDF','POST','/api/v1/admin/imports','multipart 上传；导入成功只生成草稿，PDF 需要可提取文本。',[P('Form','knowledgeBaseId','string','是','所属知识库'),P('Form','parentId','string','否','所属目录；省略表示根目录'),P('Form','file','File','是','.md 或 .pdf 文件')],'ImportJobDto',{knowledgeBaseId:'kb-java',parentId:'folder-jvm',file:'jvm.md（二进制）'},['400 VALIDATION_ERROR','403 FORBIDDEN'],{contentType:'multipart/form-data'}),
  O('内容与版本管理','查看导入任务','GET','/api/v1/admin/imports/{id}','轮询解析结果与新建草稿 ID。',[pathId('id','导入任务 ID')],'ImportJobDto',undefined,['404 NOT_FOUND']),
  O('内容与版本管理','开始发布','POST','/api/v1/admin/documents/{id}/publish','同文档只允许一个任务；索引成功后 Java 原子切换 active_version_id。',[pathId('id','文档 ID'),body('expectedDraftRevision','number','提交时草稿修订号')],'PublishJobDto',{expectedDraftRevision:2},['409 CONFLICT']),
  O('内容与版本管理','查看发布任务','GET','/api/v1/admin/publish-jobs/{id}','发布失败保留旧生效版本。',[pathId('id','发布任务 ID')],'PublishJobDto',undefined,['404 NOT_FOUND']),

  // 4. 用户与授权管理
  O('用户与授权管理','创建用户','POST','/api/v1/admin/users','管理员创建账号：Java 对至少 8 位的 initialPassword 使用与登录验证配套的 BCrypt 哈希后写入 users.password_hash；响应绝不返回密码或哈希。',[body('name','string','显示名称'),body('email','string','登录邮箱'),body('role','READER | ADMIN','服务端角色'),body('initialPassword','string','至少 8 位的初始密码')],'UserDto',{name:'林同学',email:'reader@guguwiki.dev',role:'READER',initialPassword:'<设置强密码>'},['400 VALIDATION_ERROR','403 FORBIDDEN','409 CONFLICT']),
  O('用户与授权管理','列出用户','GET','/api/v1/admin/users','查看用户及其读者/管理员角色。',[],'UserDto[]',undefined,['403 FORBIDDEN']),

  // 5. 会话与问答
  O('会话与问答','列出我的会话','GET','/api/v1/conversations','只能返回当前登录人的会话。',[],'ConversationDto[]',undefined,['401 UNAUTHENTICATED']),
  O('会话与问答','新建会话','POST','/api/v1/conversations','创建空会话。',[],'ConversationDto',{},['401 UNAUTHENTICATED']),
  O('会话与问答','读取会话详情','GET','/api/v1/conversations/{id}','检查归属；若回答涉及已撤权文档，则隐藏正文与引用。',[pathId('id','会话 ID')],'ConversationDetailDto',undefined,['403 FORBIDDEN','404 NOT_FOUND']),
  O('会话与问答','重命名会话','PATCH','/api/v1/conversations/{id}','仅会话所有者可修改标题。',[pathId('id','会话 ID'),body('title','string','新标题')],'ConversationDto',{title:'JVM 问答'},['400 VALIDATION_ERROR','403 FORBIDDEN']),
  O('会话与问答','删除会话','DELETE','/api/v1/conversations/{id}','运行中会话须先结束或取消。',[pathId('id','会话 ID')],'204',undefined,['403 FORBIDDEN','404 NOT_FOUND','409 CONFLICT']),
  O('会话与问答','提交问题并创建运行','POST','/api/v1/conversations/{id}/runs','Java 创建用户/助手消息并检查会话归属，再交给 Python 检索生成。',[pathId('id','会话 ID'),body('question','string','用户问题')],'ChatRunDto',{question:'什么是 JVM？'},['400 VALIDATION_ERROR','403 FORBIDDEN','503 AUTHZ_UNAVAILABLE']),
  O('会话与问答','订阅回答事件','GET','/api/v1/chat/runs/{runId}/events','SSE 流发送 session、citation、delta、done、error、cancel_requested、cancelled。',[pathId('runId','运行 ID'),P('Header','Accept','text/event-stream','是','期望 SSE')],'SSE',undefined,['401 UNAUTHENTICATED','403 FORBIDDEN']),
  O('会话与问答','查看运行状态','GET','/api/v1/chat/runs/{runId}','断线或请求取消后查询最终状态。',[pathId('runId','运行 ID')],'ChatRunDto',undefined,['403 FORBIDDEN','404 NOT_FOUND']),
  O('会话与问答','请求取消','POST','/api/v1/chat/runs/{runId}/cancel','先进入 CANCEL_REQUESTED；Java 通知 Python 并保存部分回答，最终以状态接口确认为准。',[pathId('runId','运行 ID')],'ChatRunDto',{},['403 FORBIDDEN','404 NOT_FOUND'],{responseExample:{...examples.ChatRunDto,status:'CANCEL_REQUESTED'}}),

  // 6. 检索实验室
  O('检索实验室','读取正式策略','GET','/api/v1/retrieval/strategy','读取管理员已手动启用的线上检索参数。',[],'StrategyDto',undefined,['401 UNAUTHENTICATED'],{auth:'需登录 Token'}),
  O('检索实验室','单次 Query 调试','POST','/api/v1/admin/retrieval/debug','检索全部已发布文档，显示 FTS、向量、RRF、重排和证据结果。',[body('query','string','调试问题'),body('config','RetrievalConfigDto','本次策略参数')],'DebugResultDto',{query:'什么是 JVM？',config:examples.RetrievalConfigDto},['400 VALIDATION_ERROR','403 FORBIDDEN','503 AUTHZ_UNAVAILABLE']),
  O('检索实验室','列出标注数据集','GET','/api/v1/admin/evaluation/datasets','返回文档级 0–3 相关性标注。',[],'EvaluationDatasetDto[]',undefined,['403 FORBIDDEN']),
  O('检索实验室','冻结实验快照','POST','/api/v1/admin/evaluation/snapshots','冻结全部已发布文档版本、语料/索引、标注及模型环境指纹。',[body('datasetId','string','数据集 ID')],'EvaluationSnapshotDto',{datasetId:'dataset-core'},['400 VALIDATION_ERROR','403 FORBIDDEN']),
  O('检索实验室','运行离线评测','POST','/api/v1/admin/evaluation/runs','在同一快照上运行本次冻结参数；启动及运行中核验当前权限。',[body('snapshotId','string','冻结快照 ID'),body('name','string','实验名称'),body('config','RetrievalConfigDto','本次策略参数')],'EvaluationRunDto',{snapshotId:'snapshot-1',name:'基线',config:examples.RetrievalConfigDto},['409 SNAPSHOT_INVALIDATED','503 AUTHZ_UNAVAILABLE']),
  O('检索实验室','列出已保存评测','GET','/api/v1/admin/evaluation/runs','读取时再次校验当前权限，无权结果以 redacted:true 隐藏明细。',[],'EvaluationRunDto[]',undefined,['403 FORBIDDEN']),
  O('检索实验室','手动启用评测策略','POST','/api/v1/admin/evaluation/runs/{id}/activate','只有管理员单独操作才把实验配置设为正式策略。',[pathId('id','评测运行 ID')],'StrategyDto',{},['409 CONFLICT']),

  // 7. Java → Python；以下为约定的内部服务契约，Java/Python 尚未实现。
  O('内部 Java → Python','提取 PDF 文本','POST','/internal/v1/ingestion/extract','Python 解析可提取文字的 PDF；扫描件或空文本应返回解析错误。',[P('Form','file','File','是','受控 PDF 原件')],'InternalExtractResult',{file:'jvm.pdf（二进制）'},['400 VALIDATION_ERROR'],{contentType:'multipart/form-data'}),
  O('内部 Java → Python','生成索引切片','POST','/internal/v1/ingestion/index','根据锁定草稿生成切片、FTS 文本和向量；Java 验证后写入并发布。',[body('taskId','string','发布任务 ID'),body('documentId','string','文档 ID'),body('draftRevision','number','锁定的草稿修订号'),body('content','string','本次草稿快照'),body('embeddingModel','string','嵌入模型标识')],'InternalIndexResult',{taskId:'publish-1',documentId:'doc-jvm',draftRevision:2,content:'# JVM 基础\n\nJVM 是 Java 虚拟机。',embeddingModel:'embedding-v1'},['400 VALIDATION_ERROR','409 CONFLICT']),
  O('内部 Java → Python','发起检索生成','POST','/internal/v1/retrieval/runs','只传问题、已授权历史和短期 scopeToken；Python 编排两路检索、证据与回答，不接收用户 ID/角色。',[body('runId','string','问答任务 ID'),body('scopeToken','string','Java 签发的短期随机凭证'),body('question','string','用户问题'),body('history','object[]','已校验且排除撤权内容的历史'),body('config','RetrievalConfigDto','检索配置')],'SSE',{runId:'run-1',scopeToken:'<短期随机凭证>',question:'什么是 JVM？',history:[],config:examples.RetrievalConfigDto},['403 FORBIDDEN','503 AUTHZ_UNAVAILABLE'],{auth:'双向服务凭据；scopeToken 用于 Java 后续授权搜索'}),
  O('内部 Java → Python','通知协作取消','POST','/internal/v1/retrieval/runs/{id}/cancel','Python 尽力停止后续检索和生成；接收确认不等于终态。',[pathId('id','运行 ID'),body('reason','USER_REQUEST','取消原因')],'InternalCancelResult',{reason:'USER_REQUEST'},['404 NOT_FOUND']),

  // 8. Python → Java
  O('内部 Python → Java','授权 FTS 候选检索','POST','/internal/v1/authorized-search/fts','Java 每次核验服务凭据、scopeToken 与当前权限；SQL 候选条件先授权，再排序及 LIMIT。',[body('scopeToken','string','短期请求凭证'),body('segmentedQuery','string','与索引同版本分词规则的查询词'),body('topK','number','本路 Top-K')],'InternalSearchResult',{scopeToken:'<短期随机凭证>',segmentedQuery:'jvm 虚拟机',topK:8},['403 FORBIDDEN','503 AUTHZ_UNAVAILABLE','503 FTS_UNAVAILABLE']),
  O('内部 Python → Java','授权向量候选检索','POST','/internal/v1/authorized-search/vector','pgvector 在授权候选集合内按距离排序并 LIMIT；不能全局 Top-K 后过滤。',[body('scopeToken','string','短期请求凭证'),body('embedding','number[]','问题向量；维度须匹配索引'),body('topK','number','本路 Top-K')],'InternalSearchResult',{scopeToken:'<短期随机凭证>',embedding:[0.12,0.34],topK:8},['403 FORBIDDEN','503 AUTHZ_UNAVAILABLE','503 VECTOR_UNAVAILABLE']),
]
