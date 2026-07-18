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
  created_at: string
  deleted_at: string | null
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
  created_at: string
  updated_at: string
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
  created_at: string
}
