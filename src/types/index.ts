export type Role = "admin" | "client";
export type TaskStatus = "미착수" | "진행중" | "완료" | "보고서 반영" | "발주처 확인";
export type DeliverableStatus = "작성중" | "내부검토" | "발주처검토" | "수정중" | "최종완료";
export type ReviewStatus = "접수" | "검토중" | "반영중" | "반영완료" | "보류";
export type Criterion = "적절성" | "일관성" | "효율성" | "효과성" | "영향력" | "지속가능성" | "범분야 이슈";

export interface Contract {
  id: string;
  name: string;
  client: string;
  contractor: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  deliveryDue: string;
  paymentMethod: string;
  delayPenaltyRate: string;
  guaranteeDeposit: string;
  inspectionAgency: string;
  acceptanceAgency: string;
  contractType: string;
  specialNotes: string;
}

export interface Task {
  id: string;
  group?: string;
  groupOrder?: number;
  category: string;
  title: string;
  owner: string;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  deliverable: string;
  evidence: string;
  note: string;
  isVisibleToClient?: boolean;
}

export interface EvaluationMatrixRow {
  id: string;
  criterion: Criterion;
  question: string;
  subQuestion: string;
  indicator: string;
  source: string;
  collectionMethod: string;
  analysisMethod: string;
  finding: string;
  evidence: string;
  reportLocation: string;
  recommendation: string;
}

export interface TheoryStage {
  id: string;
  stage: "Input" | "Activity" | "Output" | "Outcome" | "Impact";
  content: string;
  indicator: string;
  verification: string;
  assumptionsRisks: string;
  workingFactors: string;
  nonWorkingFactors: string;
  evidence: string;
}

export interface DocumentSource {
  id: string;
  title: string;
  provider: string;
  type: string;
  receivedDate: string;
  analysisStatus: string;
  summary: string;
  criteria: string;
}

export interface Interview {
  id: string;
  person: string;
  organization: string;
  country: string;
  group: "KOSME" | "PMC" | "IDEA" | "수혜기업" | "기타";
  date: string;
  mode: "대면" | "화상" | "서면";
  questions: string;
  answers: string;
  insight: string;
  criteria: string;
}

export interface Survey {
  id: string;
  targetGroup: string;
  targetResponses: number;
  actualResponses: number;
  responseRate: number;
  language: string;
  link: string;
  keyResults: string;
  analysisStatus: string;
}

export interface SatisfactionItem {
  id: string;
  question: string;
  group: string;
  average: number;
  standardDeviation: number;
  distribution: string;
  performanceCorrelation: string;
  keywords: string;
  insight: string;
}

export interface TaskDeliverable {
  id: string;
  taskId: string;
  title: string;
  fileName: string;
  originalFileName?: string;
  storedFileName?: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  filePath: string;
  fileData?: string;
  version: string;
  plannedSubmitDate: string;
  actualSubmitDate: string;
  status: DeliverableStatus;
  uploadedBy: string;
  uploadedAt: string;
  note: string;
  isVisibleToClient: boolean;
}

export interface ClientComment {
  id: string;
  targetType: "project" | "task" | "deliverable";
  targetId: string;
  targetTitle: string;
  authorName: string;
  authorRole: "client" | "admin" | "researcher";
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  response: string;
  respondedBy: string;
  respondedAt: string;
  reflectedLocation: string;
  holdReason: string;
}

export interface InspectionItem {
  id: string;
  title: string;
  checked: boolean;
  owner: string;
  note: string;
}

export interface Risk {
  id: string;
  name: string;
  likelihood: "낮음" | "보통" | "높음";
  impact: "낮음" | "보통" | "높음";
  mitigation: string;
  owner: string;
  status: string;
}

export interface Approval {
  id: string;
  targetType: "task_deliverable" | "comment";
  targetId: string;
  approvedBy: string;
  approvedAt: string;
  status: "미승인" | "요청" | "승인" | "반려";
  note: string;
}

export interface AppData {
  contract: Contract;
  tasks: Task[];
  matrix: EvaluationMatrixRow[];
  theory: TheoryStage[];
  documents: DocumentSource[];
  interviews: Interview[];
  surveys: Survey[];
  satisfaction: SatisfactionItem[];
  taskDeliverables: TaskDeliverable[];
  comments: ClientComment[];
  approvals: Approval[];
  inspections: InspectionItem[];
  risks: Risk[];
}
