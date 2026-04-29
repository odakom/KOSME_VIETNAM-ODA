import type { AppData, Criterion, Task } from "../types";
import { getGroupOrder, getTaskGroup } from "../utils/taskGrouping";

const id = (prefix: string, index: number) => `${prefix}-${String(index).padStart(2, "0")}`;

const taskNames = [
  "평가수행계획 수립",
  "착수보고회 준비",
  "문헌조사",
  "평가방법론 수립",
  "PDM 및 성과지표 검토",
  "평가매트릭스 작성",
  "설문조사지 작성",
  "면담 질문지 작성",
  "온라인 설문조사 수행",
  "원격 면담 수행",
  "문헌·면담·설문 삼각검증",
  "최종보고서 초안 작성",
  "발주처 의견 반영",
  "최종보고서 작성",
  "국문/영문 요약본 작성",
  "최종보고회 발표자료 작성",
  "산출물 최종 제출",
  "정산보고서 제출"
];

const deliverableNames = [
  "평가 수행계획서",
  "착수보고회 발표자료",
  "조사계획서",
  "조사 결과보고서",
  "중간보고서",
  "중간보고회 발표자료",
  "최종보고서 초안",
  "최종보고서",
  "국문 요약본",
  "영문 요약본",
  "최종보고회 발표자료",
  "정산보고서",
  "부속문서"
];

const criteria: Criterion[] = ["적절성", "일관성", "효율성", "효과성", "영향력", "지속가능성", "범분야 이슈"];

const makeTask = (title: string, index: number): Task => {
  const draft: Task = {
    id: id("task", index + 1),
    category: index < 2 ? "착수" : index < 11 ? "조사·분석" : "보고·납품",
    title,
    owner: index % 3 === 0 ? "PM" : index % 3 === 1 ? "평가전문가" : "연구원",
    startDate: index < 2 ? "2026-04-27" : index < 11 ? "2026-05-11" : "2026-07-01",
    dueDate: index < 2 ? "2026-05-15" : index < 11 ? "2026-07-12" : "2026-08-14",
    status: index < 2 ? "진행중" : "미착수",
    deliverable: deliverableNames[Math.min(Math.floor(index / 2), deliverableNames.length - 1)],
    evidence: "문헌, 회의록, 조사결과",
    note: "",
    isVisibleToClient: true
  };
  const group = getTaskGroup(draft);
  return { ...draft, group, groupOrder: getGroupOrder(group) };
};

export const initialData: AppData = {
  contract: {
    id: "contract-01",
    name: "베트남 온라인 수출 플랫폼 모델 전수 ODA사업 종료평가 용역",
    client: "중소벤처기업진흥공단",
    contractor: "주식회사 오다콤",
    amount: 29948700,
    periodStart: "2026-04-27",
    periodEnd: "2026-08-14",
    deliveryDue: "2026-08-14",
    paymentMethod: "직불",
    delayPenaltyRate: "계약서 기준 적용",
    guaranteeDeposit: "계약서 기준 적용",
    inspectionAgency: "중소벤처기업진흥공단",
    acceptanceAgency: "중소벤처기업진흥공단",
    contractType: "총액계약",
    specialNotes: "발주처 검토 및 최종 검수 일정은 납품기한 역산 기준으로 관리"
  },
  tasks: taskNames.map(makeTask),
  matrix: criteria.map((criterion, index) => ({
    id: id("matrix", index + 1),
    criterion,
    question: `${criterion} 측면에서 사업의 성과와 설계는 무엇인가?`,
    subQuestion: "온라인 수출 플랫폼 모델 전수 과정에서 확인해야 할 세부 쟁점",
    indicator: "성과지표 달성도, 이해관계자 인식, 자료 확인 결과",
    source: "사업문서, 설문, 면담",
    collectionMethod: "문헌검토, 온라인 설문, 원격 면담",
    analysisMethod: "정량·정성 통합분석 및 삼각검증",
    finding: "",
    evidence: "",
    reportLocation: "최종보고서 평가결과 장",
    recommendation: ""
  })),
  theory: ["Input", "Activity", "Output", "Outcome", "Impact"].map((stage, index) => ({
    id: id("toc", index + 1),
    stage: stage as "Input" | "Activity" | "Output" | "Outcome" | "Impact",
    content: index === 0 ? "플랫폼 모델, 전문가, 예산, 협력기관 투입" : "",
    indicator: "단계별 성과지표",
    verification: "PDM, 운영자료, 인터뷰",
    assumptionsRisks: "자료 접근성 및 현지 협조",
    workingFactors: "",
    nonWorkingFactors: "",
    evidence: ""
  })),
  documents: [
    { id: "doc-01", title: "사업 수행계획서", provider: "KOSME", type: "계획서", receivedDate: "2026-05-03", analysisStatus: "분석대기", summary: "", criteria: "적절성, 효율성" }
  ],
  interviews: [
    { id: "int-01", person: "사업 담당자", organization: "KOSME", country: "한국", group: "KOSME", date: "2026-06-05", mode: "화상", questions: "사업 설계와 운영상 주요 쟁점", answers: "", insight: "", criteria: "효과성, 지속가능성" }
  ],
  surveys: [
    { id: "sur-01", targetGroup: "사업 담당자", targetResponses: 5, actualResponses: 0, responseRate: 0, language: "한국어", link: "", keyResults: "", analysisStatus: "설계중" },
    { id: "sur-02", targetGroup: "PMC 관계자", targetResponses: 10, actualResponses: 0, responseRate: 0, language: "한국어/영어", link: "", keyResults: "", analysisStatus: "설계중" },
    { id: "sur-03", targetGroup: "IDEA 담당자", targetResponses: 15, actualResponses: 0, responseRate: 0, language: "영어/베트남어", link: "", keyResults: "", analysisStatus: "설계중" },
    { id: "sur-04", targetGroup: "플랫폼 등록 베트남 중소기업", targetResponses: 100, actualResponses: 0, responseRate: 0, language: "베트남어", link: "", keyResults: "", analysisStatus: "설계중" }
  ],
  satisfaction: [
    { id: "sat-01", question: "플랫폼 사용 만족도", group: "수혜기업", average: 0, standardDeviation: 0, distribution: "1점 0 / 2점 0 / 3점 0 / 4점 0 / 5점 0", performanceCorrelation: "", keywords: "", insight: "" }
  ],
  taskDeliverables: [
    {
      id: "tdel-01",
      taskId: "task-01",
      title: "평가 수행계획서 초안",
      fileName: "평가_수행계획서_v0.1.docx",
      originalFileName: "평가_수행계획서_v0.1.docx",
      storedFileName: "",
      fileSize: 0,
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileUrl: "#",
      filePath: "",
      version: "v0.1",
      plannedSubmitDate: "2026-05-15",
      actualSubmitDate: "",
      status: "작성중",
      uploadedBy: "PM",
      uploadedAt: "2026-05-01",
      note: "샘플 메타데이터",
      isVisibleToClient: false
    }
  ],
  comments: [
    { id: "com-01", targetType: "deliverable", targetId: "tdel-01", targetTitle: "평가 수행계획서 초안", authorName: "발주처", authorRole: "client", content: "착수보고 자료에 조사대상 설계 표본 수를 명확히 제시 요청", status: "접수", createdAt: "2026-05-08", updatedAt: "2026-05-08", response: "", respondedBy: "", respondedAt: "", reflectedLocation: "", holdReason: "" }
  ],
  approvals: [],
  inspections: [
    "계약기간 내 납품 가능 여부",
    "과업지시서 주요 과업 반영 여부",
    "OECD DAC 6대 기준 반영 여부",
    "범분야 이슈 반영 여부",
    "PDM 및 변화이론 반영 여부",
    "설문조사 결과 반영 여부",
    "면담 결과 반영 여부",
    "삼각검증 결과 반영 여부",
    "제언에 이행주체 포함 여부",
    "제언에 이행시기 포함 여부",
    "제언에 구체적 추진방식 포함 여부",
    "제언에 리스크 및 대응방안 포함 여부",
    "국문/영문 요약본 준비 여부",
    "최종보고회 발표자료 준비 여부",
    "정산보고서 준비 여부"
  ].map((title, index) => ({ id: id("ins", index + 1), title, checked: false, owner: "PM", note: "" })),
  risks: [
    ["납품기한 지연", "높음", "높음", "주요 산출물 내부 검토 일정을 1주 이상 선행 관리"],
    ["발주처 검토 지연", "보통", "높음", "검토 요청 산출물을 조기 공유하고 회신기한 명시"],
    ["설문 응답률 부족", "높음", "보통", "대체 표본 및 리마인드 계획 운영"],
    ["베트남 측 자료 미제공", "보통", "높음", "필수 자료 목록을 우선순위별로 재요청"],
    ["원격 면담 응답 편향", "보통", "보통", "자료원 다변화 및 삼각검증"],
    ["현장방문 미실시에 따른 검증 한계", "보통", "보통", "운영자료와 복수 이해관계자 면담으로 보완"],
    ["플랫폼 운영자료 부족", "보통", "높음", "대체 성과지표와 정성근거 병행"],
    ["영문 요약본 지연", "낮음", "보통", "최종보고서 초안 단계부터 병행 작성"]
  ].map(([name, likelihood, impact, mitigation], index) => ({
    id: id("risk", index + 1),
    name,
    likelihood: likelihood as "낮음" | "보통" | "높음",
    impact: impact as "낮음" | "보통" | "높음",
    mitigation,
    owner: index % 2 === 0 ? "PM" : "연구원",
    status: "모니터링"
  }))
};
