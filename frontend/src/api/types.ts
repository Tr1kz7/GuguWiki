import type {
  ChatEventDto, ChatRunDto, ConversationDetailDto, ConversationDto, DebugResultDto,
  DemoScenario, DemoStateDto, DocumentDto, EvaluationDatasetDto, EvaluationRunDto,
  EvaluationSnapshotDto, ImportJobDto, KnowledgeBaseDto, PublishJobDto,
  RetrievalConfigDto, SearchHitDto, StrategyDto, UserDto, FolderDto,
} from '../contracts'

export interface GuguApi {
  login(email: string, password: string, entry: 'READER' | 'ADMIN'): Promise<UserDto>
  me(): Promise<UserDto | null>
  logout(): Promise<void>
  listKnowledgeBases(): Promise<KnowledgeBaseDto[]>
  createKnowledgeBase(name: string, description: string): Promise<KnowledgeBaseDto>
  listFolders(knowledgeBaseId?: string): Promise<FolderDto[]>
  createFolder(knowledgeBaseId: string, parentId: string | null, title: string): Promise<FolderDto>
  listDocuments(knowledgeBaseId?: string): Promise<DocumentDto[]>
  getDocument(id: string): Promise<DocumentDto>
  downloadOriginal(id: string): Promise<Blob>
  createDocument(knowledgeBaseId: string, parentId: string | null, title: string): Promise<DocumentDto>
  saveDraft(id: string, expectedRevision: number, title: string, content: string): Promise<DocumentDto>
  search(query: string): Promise<SearchHitDto[]>
  listUsers(): Promise<UserDto[]>
  createUser(name: string, email: string, role: 'READER' | 'ADMIN', initialPassword: string): Promise<UserDto>
  listConversations(): Promise<ConversationDto[]>
  createConversation(): Promise<ConversationDto>
  renameConversation(id: string, title: string): Promise<ConversationDto>
  deleteConversation(id: string): Promise<void>
  getConversation(id: string): Promise<ConversationDetailDto>
  createRun(conversationId: string, question: string): Promise<ChatRunDto>
  streamRun(runId: string): AsyncIterable<ChatEventDto>
  cancelRun(runId: string): Promise<ChatRunDto>
  getRun(runId: string): Promise<ChatRunDto>
  importFile(knowledgeBaseId: string, parentId: string | null, file: File): Promise<ImportJobDto>
  getImportJob(id: string): Promise<ImportJobDto>
  startPublish(documentId: string, expectedDraftRevision: number): Promise<PublishJobDto>
  getPublishJob(id: string): Promise<PublishJobDto>
  getActiveStrategy(): Promise<StrategyDto>
  debugQuery(query: string, config: RetrievalConfigDto): Promise<DebugResultDto>
  listDatasets(): Promise<EvaluationDatasetDto[]>
  createEvaluationSnapshot(datasetId: string): Promise<EvaluationSnapshotDto>
  runEvaluation(snapshotId: string, name: string, config: RetrievalConfigDto): Promise<EvaluationRunDto>
  listEvaluationRuns(): Promise<EvaluationRunDto[]>
  activateStrategy(runId: string): Promise<StrategyDto>
  getDemoState(): Promise<DemoStateDto | null>
  setDemoScenario(scenario: DemoScenario): Promise<DemoStateDto>
  resetDemo(): Promise<void>
}
