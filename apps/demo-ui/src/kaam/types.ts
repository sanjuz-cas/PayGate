import type {
  PassportRequirementResponse,
  DocumentVerificationResponse,
  PassportFormAssistResponse,
  KaamCapabilityExecutionRecord,
} from "@juicebag-mail/shared";

export type KaamStep =
  | "landing"
  | "understanding"
  | "requirements"
  | "document_selection"
  | "verification"
  | "form_preparation"
  | "completed";

export interface SyntheticDocumentData {
  id: string;
  name: string;
  documentType: string;
  documentTypeLabel: string;
  address: string;
  date: string;
  authority: string;
  consumerNumber: string;
  rawText: string;
  isSyntheticDemo: boolean;
}

export const DEFAULT_SYNTHETIC_DOCUMENT: SyntheticDocumentData = {
  id: "doc_kseb_01",
  name: "Arjun Menon",
  documentType: "electricity_bill",
  documentTypeLabel: "Electricity Bill (KSEB)",
  address: "12 Lake View Road, Kochi, Kerala 682001",
  date: "15 August 2026",
  authority: "Kerala State Electricity Board (KSEB)",
  consumerNumber: "KSEB-ERN-9482103",
  rawText: `KERALA STATE ELECTRICITY BOARD
CONSUMER BILL & RECEIPT
Consumer Name: Arjun Menon
Consumer No: KSEB-ERN-9482103
Premises Address: 12 Lake View Road, Kochi, Kerala 682001
Bill Date: 15 August 2026
Due Date: 05 September 2026
Units Consumed: 142 kWh
Total Payable: ₹840.00
Status: PAID (Valid Proof of Current Residence)`,
  isSyntheticDemo: true,
};

export interface KaamSessionState {
  step: KaamStep;
  userPrompt: string;
  interpretedGoal: string;
  taskBudgetInr: number;
  totalSpentInr: number;
  requirements?: PassportRequirementResponse;
  selectedDocument: SyntheticDocumentData;
  verificationResult?: DocumentVerificationResponse;
  formDraft?: PassportFormAssistResponse;
  capabilitiesUsed: KaamCapabilityExecutionRecord[];
  isExecuting: boolean;
  activeCapability?: string;
  simulatedErrorState?: "none" | "budget_exceeded" | "verification_failed" | "capability_unavailable";
  errorMessage?: string;
  isLiveApi: boolean;
}
