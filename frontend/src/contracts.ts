/** Internal error categories for UI and Mock behavior; these are not response fields. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHZ_UNAVAILABLE: 'AUTHZ_UNAVAILABLE',
  FTS_UNAVAILABLE: 'FTS_UNAVAILABLE',
  VECTOR_UNAVAILABLE: 'VECTOR_UNAVAILABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  SNAPSHOT_INVALIDATED: 'SNAPSHOT_INVALIDATED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

/** Wire format for ordinary Java JSON responses; data is unwrapped by HttpApi. */
export interface ResultDto<T> {
  code: number
  data: T | null
  message: string | null
  token?: string
}

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400) {
    super(message)
    this.name = 'ApiError'
  }
}

export const RunStatus = {
  RUNNING: 'RUNNING',
  CANCEL_REQUESTED: 'CANCEL_REQUESTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const
export type RunStatus = typeof RunStatus[keyof typeof RunStatus]

export const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  INVALIDATED: 'INVALIDATED',
} as const
export type JobStatus = typeof JobStatus[keyof typeof JobStatus]

export type Role = 'READER' | 'ADMIN'
export interface UserDto { id: string; name: string; email: string; role: Role }
export interface KnowledgeBaseDto { id: string; name: string; description: string; icon: string; documentCount: number }
export interface FolderDto { id: string; knowledgeBaseId: string; parentId: string | null; title: string }
export type DocumentKind = 'MARKDOWN' | 'PDF'
export interface DocumentVersionDto { id: string; number: number; title: string; content: string; createdAt: string; indexedAt: string }
export interface DocumentDto {
  id: string; knowledgeBaseId: string; parentId: string | null; title: string; kind: DocumentKind;
  summary: string; draftContent: string; draftRevision: number;
  activeVersionId: string | null; versions: DocumentVersionDto[]; originalFileName?: string;
}
export interface CitationDto { documentId: string; versionId: string; title: string; excerpt: string; anchor: string }
export interface SearchHitDto { documentId: string; knowledgeBaseId: string; title: string; excerpt: string; score: number; citation: CitationDto }
export interface ConversationDto { id: string; title: string; createdAt: string; updatedAt: string }
export interface MessageDto {
  id: string; conversationId: string; role: 'USER' | 'ASSISTANT'; content: string | null;
  createdAt: string; citations: CitationDto[]; evidenceDocumentIds: string[];
  runId?: string; status?: RunStatus; redacted?: boolean;
}
export interface ConversationDetailDto { conversation: ConversationDto; messages: MessageDto[] }
export interface ChatRunDto {
  id: string; conversationId: string; userMessageId: string; assistantMessageId: string;
  status: RunStatus; createdAt: string;
}

export interface StreamBase {
  eventId: string; runId: string; conversationId: string; messageId: string; createdAt: string;
}
export type ChatEventDto =
  | (StreamBase & { type: 'session'; status: 'RUNNING' })
  | (StreamBase & { type: 'citation'; citation: CitationDto })
  | (StreamBase & { type: 'delta'; text: string })
  | (StreamBase & { type: 'done'; status: 'COMPLETED'; content: string })
  | (StreamBase & { type: 'cancel_requested'; status: 'CANCEL_REQUESTED' })
  | (StreamBase & { type: 'cancelled'; status: 'CANCELLED'; content: string })
  | (StreamBase & { type: 'error'; status: 'FAILED'; code: number; message: string })

export interface ImportJobDto { id: string; documentId: string | null; fileName: string; status: JobStatus; error?: string; createdAt: string }
export interface PublishJobDto { id: string; documentId: string; expectedDraftRevision: number; status: JobStatus; error?: string; createdAt: string }

export interface RetrievalConfigDto {
  ftsTopK: number; vectorTopK: number; finalTopK: number; rrfK: number;
  ftsWeight: number; vectorWeight: number; rerankEnabled: boolean; rerankTopK: number;
  ftsMinScore: number; vectorMinSimilarity: number; rerankMinScore: number;
  minEvidenceCount: number; coverageCheckEnabled: boolean;
}
export const defaultConfig: RetrievalConfigDto = {
  ftsTopK: 8, vectorTopK: 8, finalTopK: 5, rrfK: 60,
  ftsWeight: 1, vectorWeight: 1, rerankEnabled: true, rerankTopK: 5,
  ftsMinScore: 0.55, vectorMinSimilarity: 0.58, rerankMinScore: 0.5,
  minEvidenceCount: 1, coverageCheckEnabled: true,
}
export interface StrategyDto { id: string; name: string; config: RetrievalConfigDto; activatedAt: string }
export type RetrievalLane = 'FTS' | 'VECTOR'
export interface CandidateDto { documentId: string; title: string; versionId: string; excerpt: string; score: number; rank: number; lane: RetrievalLane | 'FUSED' | 'RERANK' }
export interface DebugResultDto {
  query: string; fts: CandidateDto[]; vector: CandidateDto[];
  fused: CandidateDto[]; reranked: CandidateDto[]; evidence: CitationDto[];
  degradedLane?: RetrievalLane; sufficient: boolean; answerPreview: string;
  timingsMs: { fts: number; vector: number; fusion: number; rerank: number; total: number };
}
export interface EvaluationCaseDto { id: string; query: string; relevance: Record<string, 0 | 1 | 2 | 3> }
export interface EvaluationDatasetDto { id: string; name: string; description: string; cases: EvaluationCaseDto[] }
export interface EvaluationSnapshotDto {
  id: string; datasetId: string; documentVersions: Record<string, string>; cases: EvaluationCaseDto[];
  corpusFingerprint: string; permissionFingerprint: string; datasetFingerprint: string; modelFingerprint: string;
  environmentFingerprint: string; createdAt: string; status: 'VALID' | 'INVALIDATED';
}
export interface EvaluationRunDto {
  id: string; snapshotId: string; name: string; config: RetrievalConfigDto; status: JobStatus;
  metrics: { recallAtK: number; mrr: number; ndcg: number; p50Ms: number; p95Ms: number };
  results: Array<{ caseId: string; query: string; rankedDocumentIds: string[]; totalMs: number }>;
  createdAt: string; redacted?: boolean;
}

export type DemoScenario = 'NORMAL' | 'FTS_DOWN' | 'VECTOR_DOWN' | 'AUTHZ_FAIL' | 'NO_EVIDENCE' | 'PUBLISH_FAIL'
export interface DemoStateDto { scenario: DemoScenario; accounts: Array<{ email: string; password: string; role: Role }> }

export function parseChatEvent(value: unknown): ChatEventDto {
  if (!value || typeof value !== 'object') throw new ApiError(ErrorCode.INTERNAL_ERROR, 'SSE 事件格式无效。', 502)
  const event = value as Record<string, unknown>
  if (typeof event.eventId !== 'string' || typeof event.runId !== 'string' || typeof event.conversationId !== 'string' || typeof event.messageId !== 'string' || typeof event.createdAt !== 'string') throw new ApiError(ErrorCode.INTERNAL_ERROR, 'SSE 缺少事件标识。', 502)
  if (event.type === 'delta' && typeof event.text === 'string') return value as ChatEventDto
  if (event.type === 'citation' && event.citation && typeof event.citation === 'object') {
    const citation = event.citation as Record<string, unknown>
    if (['documentId', 'versionId', 'title', 'excerpt', 'anchor'].every(key => typeof citation[key] === 'string')) return value as ChatEventDto
  }
  if (event.type === 'session' && event.status === 'RUNNING') return value as ChatEventDto
  if (event.type === 'done' && event.status === 'COMPLETED' && typeof event.content === 'string') return value as ChatEventDto
  if (event.type === 'cancel_requested' && event.status === 'CANCEL_REQUESTED') return value as ChatEventDto
  if (event.type === 'cancelled' && event.status === 'CANCELLED' && typeof event.content === 'string') return value as ChatEventDto
  if (event.type === 'error' && event.status === 'FAILED' && Number.isInteger(event.code) && typeof event.message === 'string') return value as ChatEventDto
  throw new ApiError(ErrorCode.INTERNAL_ERROR, 'SSE 事件类型或字段不符合契约。', 502)
}
