// GuguWiki API documentation source. Run: node docs/build-api-docs.mjs
// Parameter row: [location, name, type, required, description].
// Schema row: [name, type, required, description].
export const schemas = {
  UserDto: [
    ['id','string','是','用户 ID'],['name','string','是','显示名称'],['email','string','是','登录邮箱'],['role','READER | ADMIN','是','服务端角色'],
  ],
  KnowledgeBaseDto: [['id','string','是','知识库 ID'],['name','string','是','名称'],['description','string','是','说明'],['icon','string','是','前端显示字符'],['documentCount','number','是','文档总数']],
  FolderDto: [['id','string','是','目录 ID'],['knowledgeBaseId','string','是','所属知识库'],['parentId','string | null','是','父目录；null 表示根目录'],['title','string','是','目录名']],
  DocumentVersionDto: [['id','string','是','不可变版本 ID'],['number','number','是','版本序号'],['title','string','是','发布时的标题快照'],['content','string','是','发布正文'],['createdAt','ISO 8601','是','创建时间'],['indexedAt','ISO 8601','是','索引成功时间']],
  DocumentDto: [['id','string','是','文档 ID'],['knowledgeBaseId','string','是','所属知识库'],['parentId','string | null','是','目录 ID；null 为根目录'],['title','string','是','管理员看到草稿标题；读者看到生效版本标题'],['kind','MARKDOWN | PDF','是','文件类型'],['summary','string','是','摘要'],['draftContent','string','是','管理员草稿；读者仅收到生效版本正文'],['draftRevision','number','是','乐观锁修订号'],['activeVersionId','string | null','是','当前生效版本指针'],['versions','DocumentVersionDto[]','是','读者仅见生效版本'],['originalFileName','string','否','PDF 原件名']],
  CitationDto: [['documentId','string','是','引用文档 ID'],['versionId','string','是','引用版本 ID'],['title','string','是','引用标题'],['excerpt','string','是','证据摘录'],['anchor','string','是','定位锚点']],
  SearchHitDto: [['documentId','string','是','文档 ID'],['knowledgeBaseId','string','是','知识库 ID'],['title','string','是','当前生效版本标题'],['excerpt','string','是','命中摘录'],['score','number','是','当前搜索策略分数'],['citation','CitationDto','是','可打开的引用']],
  ConversationDto: [['id','string','是','会话 ID'],['title','string','是','标题'],['createdAt','ISO 8601','是','创建时间'],['updatedAt','ISO 8601','是','更新时间']],
  MessageDto: [['id','string','是','消息 ID'],['conversationId','string','是','会话 ID'],['role','USER | ASSISTANT','是','发言方'],['content','string | null','是','撤权回答为 null'],['createdAt','ISO 8601','是','创建时间'],['citations','CitationDto[]','是','当前可见引用'],['evidenceDocumentIds','string[]','是','审计用证据文档 ID'],['runId','string','否','助手消息所属运行 ID'],['status','RunStatus','否','助手运行状态'],['redacted','boolean','否','已撤权隐藏标记']],
  ConversationDetailDto: [['conversation','ConversationDto','是','会话元数据'],['messages','MessageDto[]','是','按创建时间排列的消息']],
  ChatRunDto: [['id','string','是','生成任务 ID'],['conversationId','string','是','会话 ID'],['userMessageId','string','是','问题消息 ID'],['assistantMessageId','string','是','回答消息 ID'],['status','RunStatus','是','运行状态'],['createdAt','ISO 8601','是','创建时间']],
  ImportJobDto: [['id','string','是','导入任务 ID'],['documentId','string | null','是','成功后生成的草稿 ID'],['fileName','string','是','上传文件名'],['status','JobStatus','是','导入状态'],['error','string','否','失败原因'],['createdAt','ISO 8601','是','创建时间']],
  PublishJobDto: [['id','string','是','发布任务 ID'],['documentId','string','是','目标文档 ID'],['expectedDraftRevision','number','是','发布时锁定的草稿修订号'],['status','JobStatus','是','发布状态'],['error','string','否','失败原因'],['createdAt','ISO 8601','是','创建时间']],
  RetrievalConfigDto: [['ftsTopK','number','是','FTS 授权候选 Top-K'],['vectorTopK','number','是','向量授权候选 Top-K'],['finalTopK','number','是','最终证据 Top-K'],['rrfK','number','是','RRF 分母常数'],['ftsWeight','number','是','FTS 融合权重'],['vectorWeight','number','是','向量融合权重'],['rerankEnabled','boolean','是','是否重排'],['rerankTopK','number','是','重排候选数'],['ftsMinScore','number','是','FTS 专属最低相关性分'],['vectorMinSimilarity','number','是','向量专属最低相似度'],['rerankMinScore','number','是','重排专属最低分'],['minEvidenceCount','number','是','最少有效证据数'],['coverageCheckEnabled','boolean','是','是否判断问题事实覆盖']],
  StrategyDto: [['id','string','是','正式策略 ID'],['name','string','是','名称'],['config','RetrievalConfigDto','是','已启用配置'],['activatedAt','ISO 8601','是','启用时间']],
  CandidateDto: [['documentId','string','是','候选文档 ID'],['title','string','是','当前标题'],['versionId','string','是','候选版本 ID'],['excerpt','string','是','片段'],['score','number','是','本路分数，跨路不可直接比较'],['rank','number','是','本路排名'],['lane','FTS | VECTOR | FUSED | RERANK','是','所属阶段']],
  DebugResultDto: [['query','string','是','调试问题'],['fts','CandidateDto[]','是','FTS 候选'],['vector','CandidateDto[]','是','向量候选'],['fused','CandidateDto[]','是','RRF 融合排名'],['reranked','CandidateDto[]','是','重排排名'],['evidence','CitationDto[]','是','有效证据'],['degradedLane','FTS | VECTOR','否','失败并被降级的链路'],['sufficient','boolean','是','证据是否充分'],['answerPreview','string','是','回答预览或固定弃答文本'],['timingsMs','object','是','fts/vector/fusion/rerank/total 阶段耗时']],
  EvaluationCaseDto: [['id','string','是','标注样本 ID'],['query','string','是','问题'],['relevance','Record<documentId,0|1|2|3>','是','文档级相关性标注']],
  EvaluationDatasetDto: [['id','string','是','数据集 ID'],['name','string','是','名称'],['description','string','是','说明'],['cases','EvaluationCaseDto[]','是','标注样本']],
  EvaluationSnapshotDto: [['id','string','是','冻结快照 ID'],['datasetId','string','是','数据集 ID'],['documentVersions','Record<documentId,versionId>','是','冻结的全部已发布文档版本'],['cases','EvaluationCaseDto[]','是','冻结标注'],['corpusFingerprint','string','是','切片、索引及语料指纹'],['permissionFingerprint','string','是','角色可见范围策略指纹'],['datasetFingerprint','string','是','标注指纹'],['modelFingerprint','string','是','嵌入/重排模型指纹'],['environmentFingerprint','string','是','运行环境指纹'],['createdAt','ISO 8601','是','冻结时间'],['status','VALID | INVALIDATED','是','快照有效状态']],
  EvaluationRunDto: [['id','string','是','评测运行 ID'],['snapshotId','string','是','共用快照 ID'],['name','string','是','实验名'],['config','RetrievalConfigDto','是','本次冻结参数'],['status','JobStatus','是','运行状态'],['metrics','object','是','recallAtK/mrr/ndcg/p50Ms/p95Ms'],['results','object[]','是','caseId/query/rankedDocumentIds/totalMs'],['createdAt','ISO 8601','是','启动时间'],['redacted','boolean','否','读取时因当前权限撤销而隐藏明细']],
  ResultDto: [['code','number','是','成功为 200；失败时与 HTTP 状态码相同'],['data','T | null','是','业务 DTO 或数组；失败时为 null'],['message','string | null','是','操作反馈；无反馈时为 null 或空字符串'],['token','string','否','仅登录成功时返回；后续请求置于 Authorization 请求头']],
  ErrorDto: [['code','number','是','与 HTTP 状态一致的错误状态码'],['data','null','是','失败时为 null'],['message','string','是','可展示错误信息']],
  InternalCandidateDto: [['documentId','string','是','授权文档 ID'],['versionId','string','是','当前或实验冻结版本'],['chunkId','string','是','切片 ID'],['title','string','是','标题'],['excerpt','string','是','片段文本'],['score','number','是','仅对本路有意义的分数'],['rank','number','是','本路名次']],
  InternalSearchResult: [['candidates','InternalCandidateDto[]','是','已经完成权限过滤的候选'],['timingMs','number','是','Java 授权和查询耗时']],
  InternalExtractResult: [['text','string','是','PDF 提取文本'],['metadata','object','是','页数等元数据'],['warnings','string[]','是','解析警告']],
  InternalIndexResult: [['chunks','object[]','是','ordinal/content/searchText/embedding；由 Java 验证并写入']],
  InternalCancelResult: [['accepted','boolean','是','仅表示收到取消信号，不保证模型已停']],
}

export const examples = {
  UserDto: {id:'user-reader',name:'林同学',email:'reader@guguwiki.dev',role:'READER'},
  KnowledgeBaseDto: {id:'kb-java',name:'Java 工程实践',description:'语言、虚拟机与性能调优',icon:'J',documentCount:2},
  FolderDto: {id:'folder-jvm',knowledgeBaseId:'kb-java',parentId:null,title:'虚拟机与性能'},
  DocumentVersionDto: {id:'doc-jvm-v1',number:1,title:'JVM 基础与运行时数据区',content:'# JVM 基础与运行时数据区\n\nJVM 是 Java 虚拟机。',createdAt:'2026-10-10T09:00:00Z',indexedAt:'2026-10-10T09:00:00Z'},
  CitationDto: {documentId:'doc-jvm',versionId:'doc-jvm-v1',title:'JVM 基础与运行时数据区',excerpt:'JVM 是 Java 虚拟机。',anchor:'content'},
  ConversationDto: {id:'conversation-1',title:'JVM 问答',createdAt:'2026-10-10T09:00:00Z',updatedAt:'2026-10-10T09:01:00Z'},
  ChatRunDto: {id:'run-1',conversationId:'conversation-1',userMessageId:'message-1',assistantMessageId:'message-2',status:'RUNNING',createdAt:'2026-10-10T09:00:00Z'},
  ImportJobDto: {id:'import-1',documentId:null,fileName:'jvm.md',status:'RUNNING',createdAt:'2026-10-10T09:00:00Z'},
  PublishJobDto: {id:'publish-1',documentId:'doc-jvm',expectedDraftRevision:2,status:'RUNNING',createdAt:'2026-10-10T09:00:00Z'},
  RetrievalConfigDto: {ftsTopK:8,vectorTopK:8,finalTopK:5,rrfK:60,ftsWeight:1,vectorWeight:1,rerankEnabled:true,rerankTopK:5,ftsMinScore:0.55,vectorMinSimilarity:0.58,rerankMinScore:0.5,minEvidenceCount:1,coverageCheckEnabled:true},
  EvaluationCaseDto: {id:'case-jvm',query:'JVM 的定义和运行时数据区',relevance:{'doc-jvm':3,'doc-gc':1}},
  ErrorDto: {code:403,data:null,message:'你没有权限查看此文档。'},
  InternalCandidateDto: {documentId:'doc-jvm',versionId:'doc-jvm-v1',chunkId:'chunk-1',title:'JVM 基础与运行时数据区',excerpt:'JVM 是 Java 虚拟机。',score:0.77,rank:1},
  InternalExtractResult: {text:'JVM 是 Java 虚拟机。',metadata:{pageCount:2},warnings:[]},
  InternalIndexResult: {chunks:[{ordinal:0,content:'JVM 是 Java 虚拟机。',searchText:'jvm 虚拟机',embedding:[0.12,0.34]}]},
  InternalCancelResult: {accepted:true},
}

examples.DocumentDto = {id:'doc-jvm',knowledgeBaseId:'kb-java',parentId:'folder-jvm',title:'JVM 基础与运行时数据区',kind:'MARKDOWN',summary:'JVM 入门说明',draftContent:examples.DocumentVersionDto.content,draftRevision:2,activeVersionId:'doc-jvm-v1',versions:[examples.DocumentVersionDto]}
examples.SearchHitDto = {documentId:'doc-jvm',knowledgeBaseId:'kb-java',title:'JVM 基础与运行时数据区',excerpt:'JVM 是 Java 虚拟机。',score:0.77,citation:examples.CitationDto}
examples.MessageDto = {id:'message-2',conversationId:'conversation-1',role:'ASSISTANT',content:'JVM 是 Java 虚拟机。',createdAt:'2026-10-10T09:00:02Z',citations:[examples.CitationDto],evidenceDocumentIds:['doc-jvm'],runId:'run-1',status:'COMPLETED'}
examples.ConversationDetailDto = {conversation:examples.ConversationDto,messages:[{...examples.MessageDto,id:'message-1',role:'USER',content:'什么是 JVM？',citations:[],evidenceDocumentIds:[],runId:undefined,status:undefined},examples.MessageDto]}
examples.StrategyDto = {id:'strategy-default',name:'默认混合检索',config:examples.RetrievalConfigDto,activatedAt:'2026-10-10T09:00:00Z'}
examples.CandidateDto = {documentId:'doc-jvm',title:'JVM 基础与运行时数据区',versionId:'doc-jvm-v1',excerpt:'JVM 是 Java 虚拟机。',score:0.77,rank:1,lane:'FTS'}
examples.DebugResultDto = {query:'什么是 JVM？',fts:[examples.CandidateDto],vector:[{...examples.CandidateDto,lane:'VECTOR',score:0.72}],fused:[{...examples.CandidateDto,lane:'FUSED',score:0.0328}],reranked:[{...examples.CandidateDto,lane:'RERANK',score:0.91}],evidence:[examples.CitationDto],sufficient:true,answerPreview:'JVM 是 Java 虚拟机。',timingsMs:{fts:12,vector:18,fusion:1,rerank:15,total:46}}
examples.EvaluationDatasetDto = {id:'dataset-core',name:'核心检索样本',description:'JVM、GC 和 Redis 标注',cases:[examples.EvaluationCaseDto]}
examples.EvaluationSnapshotDto = {id:'snapshot-1',datasetId:'dataset-core',documentVersions:{'doc-jvm':'doc-jvm-v1'},cases:[examples.EvaluationCaseDto],corpusFingerprint:'c8a1',permissionFingerprint:'p38f',datasetFingerprint:'d924',modelFingerprint:'m217',environmentFingerprint:'e441',createdAt:'2026-10-10T09:00:00Z',status:'VALID'}
examples.EvaluationRunDto = {id:'evaluation-1',snapshotId:'snapshot-1',name:'基线',config:examples.RetrievalConfigDto,status:'SUCCEEDED',metrics:{recallAtK:1,mrr:1,ndcg:1,p50Ms:45,p95Ms:71},results:[{caseId:'case-jvm',query:'JVM 的定义和运行时数据区',rankedDocumentIds:['doc-jvm'],totalMs:45}],createdAt:'2026-10-10T09:01:00Z'}
examples.InternalSearchResult = {candidates:[examples.InternalCandidateDto],timingMs:12}

export const param = (location,name,type,required,description) => [location,name,type,required,description]
