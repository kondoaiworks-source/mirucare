export type ServiceType = "訪問介護" | "通所介護" | "その他"
export type PlanType = "light" | "standard" | "premium" | "none"
export type UserRole = "admin" | "staff"
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired"

export type DocType =
  | "ケアプラン"
  | "提供記録"
  | "勤務表"
  | "請求データ"
  | "その他"

export type DocumentStatus = "uploaded" | "checking" | "reviewed" | "done"

export type FindingSeverity = "high" | "mid" | "low"
export type FindingStatus = "open" | "later" | "fixed" | "dismissed"
export type FindingReviewStatus = "pending" | "approved" | "rejected"
export type FindingReviewAction = "approved" | "edited" | "rejected"
export type FindingActionType = "fixed" | "later" | "dismissed" | "reopened"

export type DeadlineKind = "同意日" | "交付日" | "更新期限" | "モニタリング"
export type DeadlineStatus = "ok" | "warning" | "overdue" | "done"

export type Deadline = {
  id: string
  organization_id: string
  subject: string
  kind: DeadlineKind
  due_date: string
  source_document_id: string | null
  source_finding_id: string | null
  status: DeadlineStatus
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Organization = {
  id: string
  name: string
  service_type: ServiceType
  municipality: string | null
  plan: PlanType
  /** 未マイグレーション時は undefined → スキップ扱い */
  skip_finding_review?: boolean
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  stripe_subscription_status?: string | null
  setup_fee_paid_at?: string | null
  onboarding_completed_at: string | null
  created_at: string
  deleted_at: string | null
}

export type Finding = {
  id: string
  document_id: string
  organization_id: string
  severity: FindingSeverity
  title: string
  description: string
  basis: string | null
  suggestion: string | null
  status: FindingStatus
  review_status: FindingReviewStatus
  is_fallback: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type FindingActionLog = {
  id: string
  finding_id: string
  document_id: string
  organization_id: string
  actor_id: string
  action: FindingActionType
  note: string | null
  created_at: string
}

export type Profile = {
  id: string
  organization_id: string | null
  display_name: string
  role: UserRole
  /** プラットフォーム運営（全事業所レビュー） */
  is_operator?: boolean
  /** お知らせ一覧を最後に開いた時刻 */
  announcements_seen_at?: string | null
  failed_login_attempts?: number
  lockout_until?: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type FindingFeedback = {
  id: string
  finding_id: string
  document_id: string
  organization_id: string
  actor_id: string
  reason: string | null
  operator_note: string | null
  operator_note_updated_at: string | null
  operator_id: string | null
  created_at: string
}

export type FindingReviewLog = {
  id: string
  finding_id: string
  organization_id: string
  reviewer_id: string
  action: FindingReviewAction
  duration_ms: number
  created_at: string
}

export type Invitation = {
  id: string
  organization_id: string
  email: string
  role: UserRole
  token: string
  invited_by: string
  status: InvitationStatus
  expires_at: string
  created_at: string
  deleted_at: string | null
}

export type Document = {
  id: string
  organization_id: string
  uploaded_by: string
  doc_type: DocType
  file_path: string
  original_name: string
  mime_type: string | null
  file_size: number | null
  status: DocumentStatus
  /** チェック基準日 YYYY-MM-DD（未実行時は null/undefined） */
  check_as_of?: string | null
  applied_rule_version_ids?: string[] | null
  applied_rules_snapshot?: AppliedRulesSnapshot | null
  /** 原本保持日数（0=完了後すぐ削除 / 7=最大7日） */
  keep_original_days?: number
  retention_consent_at?: string | null
  original_purge_after?: string | null
  original_purged_at?: string | null
  created_at: string
  deleted_at: string | null
}

/** documents.applied_rules_snapshot の形（UI・トレーサビリティ） */
export type AppliedRulesSnapshot = {
  asOf: string
  ruleCount: number
  truncated: boolean
  rules: Array<{
    versionId: string
    code: string
    title: string
    versionNo: number
    severity: FindingSeverity
    effectiveFrom: string
    effectiveTo: string | null
    auditItemTitle: string | null
    sourceTitle: string | null
  }>
  regulatoryBasis: Array<{
    id: string
    title: string
    year: number | null
    regionName: string | null
    jurisdictionLevel: string | null
  }>
}

export type Report = {
  id: string
  organization_id: string
  /** 対象月の1日（YYYY-MM-DD） */
  month: string
  summary_md: string
  risk_count: number
  fixed_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ProfileWithOrganization = Profile & {
  organizations: Organization | null
}

/** 訪問介護員など（organization_id = 事業所ID / facility_id 相当） */
export type Helper = {
  id: string
  organization_id: string
  display_name: string
  employee_code: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Shift = {
  id: string
  organization_id: string
  helper_id: string
  work_date: string
  start_at: string
  end_at: string
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Attendance = {
  id: string
  organization_id: string
  helper_id: string
  work_date: string
  clock_in_at: string
  clock_out_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ServiceRecord = {
  id: string
  organization_id: string
  helper_id: string
  client_label: string
  service_date: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AttendanceErrorType = "OVERLAP" | "TIME_DISCREPANCY"

export type AttendanceContradiction = {
  helper_id: string
  helper_name: string
  date: string
  error_type: AttendanceErrorType
  message: string
}

/** 行政マニュアル等のナレッジ台帳（Dify 連携前提） */
export type JurisdictionLevel = "国" | "都道府県" | "市区町村"
export type KnowledgeDocumentStatus = "active" | "archived"
export type KnowledgeWatchKind = "file" | "index"
export type KnowledgeSyncStatus =
  | "ok"
  | "unchanged"
  | "failed"
  | "suspicious"
  | "selector_broken"

export type KnowledgeDocument = {
  id: string
  title: string
  jurisdiction_level: JurisdictionLevel
  region_name: string | null
  applicable_year: number
  dify_document_id: string | null
  status: KnowledgeDocumentStatus
  source_url?: string | null
  content_hash?: string | null
  content_bytes?: number | null
  last_checked_at?: string | null
  last_sync_status?: KnowledgeSyncStatus | null
  last_error?: string | null
  watch_kind?: KnowledgeWatchKind
  css_selector?: string | null
  etag?: string | null
  last_modified?: string | null
  last_ok_at?: string | null
  /** 変更検知通知先（カンマ区切り）。未設定時は OPERATOR_EMAILS */
  notify_emails?: string | null
  created_at: string
  updated_at: string
}

/** PDF抽出テキストのスナップショット（本文は Storage） */
export type KnowledgeDocumentSnapshot = {
  id: string
  knowledge_document_id: string
  content_hash: string
  storage_path: string
  text_bytes: number
  is_truncated: boolean
  captured_at: string
  source_url_at_capture: string | null
}

export type KnowledgeChangeDraftStatus = "pending" | "approved" | "rejected"

export type KnowledgeDocumentChangeDraft = {
  id: string
  knowledge_document_id: string
  before_snapshot_id: string | null
  after_snapshot_id: string | null
  ai_summary: string | null
  changes: unknown
  quote_verified_ratio: number | null
  ai_organized: boolean
  status: KnowledgeChangeDraftStatus
  reviewer_user_id: string | null
  reviewed_at: string | null
  review_reason: string | null
  notified_at: string | null
  created_at: string
}

export type KnowledgeWatchItem = {
  id: string
  knowledge_document_id: string
  item_key: string
  title: string
  href: string
  first_seen_at: string
}

export type KnowledgeSyncAlertKind =
  | "failed"
  | "suspicious"
  | "selector_broken"
export type KnowledgeSyncAlertStatus = "open" | "resolved"

export type KnowledgeSyncAlert = {
  id: string
  knowledge_document_id: string | null
  kind: KnowledgeSyncAlertKind
  message: string
  status: KnowledgeSyncAlertStatus
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  knowledge_documents?: Pick<
    KnowledgeDocument,
    "id" | "title" | "region_name" | "jurisdiction_level"
  > | null
}

export type AppAnnouncementKind = "knowledge_update" | "general"

export type AppAnnouncement = {
  id: string
  title: string
  body: string
  kind: AppAnnouncementKind
  knowledge_document_id: string | null
  organization_id: string | null
  created_by: string | null
  created_at: string
}

/** マスタールールエンジン：管轄レベル */
export type RuleJurisdictionLevel =
  | "national"
  | "prefecture"
  | "municipality"

export type RuleJurisdiction = {
  id: string
  code: string
  level: RuleJurisdictionLevel
  name: string
  parent_id: string | null
  prefecture_name: string | null
  municipality_name: string | null
  is_supported: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type RuleSourceKind = "law" | "notification" | "manual" | "other"
export type RuleSourceStatus = "active" | "archived"

/** 公開情報マスタの資料カテゴリ */
export type RuleMaterialCategory =
  | "訪問介護"
  | "総合事業訪問型"
  | "事故報告"
  | "過誤申立"
  | "加算届"
  | "サービスコード表"

export type RuleSourceFileType =
  | "pdf"
  | "html"
  | "doc"
  | "xlsx"
  | "zip"
  | "other"

export type RuleHumanReviewStatus =
  | "unverified"
  | "verified"
  | "needs_review"
  | "outdated"

export type RuleSource = {
  id: string
  jurisdiction_id: string
  source_key: string | null
  title: string
  source_kind: RuleSourceKind
  service_type: ServiceType
  material_category: RuleMaterialCategory | null
  official_url: string | null
  parent_page_url: string | null
  direct_file_url: string | null
  priority: number
  last_verified_at: string | null
  source_last_updated_on: string | null
  file_type: RuleSourceFileType | null
  content_hash: string | null
  human_review_status: RuleHumanReviewStatus
  memo: string | null
  knowledge_document_id: string | null
  published_on: string | null
  status: RuleSourceStatus
  created_at: string
  updated_at: string
}

export type RuleSetStatus = "draft" | "active" | "retired"

/** サービス×自治体のルールブック公開カタログ */
export type RulebookOffering = {
  id: string
  service_type: ServiceType
  jurisdiction_id: string
  is_published: boolean
  published_at: string | null
  unpublished_at: string | null
  created_at: string
  updated_at: string
}

/** 公開情報 × 監査カテゴリの採用リンク */
export type RuleSourceCategoryLink = {
  source_id: string
  audit_category_slug: string
  created_at: string
  created_by: string | null
}

export type RuleCategoryPdfCandidateStatus =
  | "pending"
  | "adopted"
  | "rejected"

export type RuleCategoryPdfDiscoveryMethod =
  | "keyword_match"
  | "manual"
  | "crawl"

/** 監査カテゴリ向け関連PDF候補 */
export type RuleCategoryPdfCandidate = {
  id: string
  service_type: ServiceType
  city_slug: string
  audit_category_slug: string
  jurisdiction_id: string | null
  title: string
  parent_page_url: string | null
  direct_file_url: string | null
  existing_source_id: string | null
  discovery_method: RuleCategoryPdfDiscoveryMethod
  status: RuleCategoryPdfCandidateStatus
  adopted_source_id: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export type RuleSet = {
  id: string
  jurisdiction_id: string
  service_type: ServiceType
  title: string
  fiscal_year: number | null
  status: RuleSetStatus
  effective_from: string | null
  effective_to: string | null
  created_at: string
  updated_at: string
}

export type AuditItemCategory =
  | "契約"
  | "計画"
  | "記録"
  | "人員"
  | "加算"
  | "請求"
  | "その他"

export type AuditItem = {
  id: string
  rule_set_id: string
  code: string
  title: string
  description: string
  category: AuditItemCategory
  risk_level: FindingSeverity
  sort_order: number
  status: "active" | "retired"
  source_id: string | null
  created_at: string
  updated_at: string
}

export type AiCheckRule = {
  id: string
  audit_item_id: string
  code: string
  title: string
  target_doc_types: string[]
  status: "active" | "retired"
  created_at: string
  updated_at: string
}

export type AiCheckRuleReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"

export type AiCheckRuleVersion = {
  id: string
  rule_id: string
  version_no: number
  check_logic: Record<string, unknown>
  guidance_text: string
  severity: FindingSeverity
  effective_from: string
  effective_to: string | null
  review_status: AiCheckRuleReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_reason: string | null
  change_summary: string | null
  knowledge_change_draft_id: string | null
  created_at: string
}
