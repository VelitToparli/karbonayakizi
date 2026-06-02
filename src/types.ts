export type StepTemplate = {
  id: string;
  label: string;
  unit: string;
  factor: number;
};

export type GroupTemplate = {
  id: string;
  title: string;
  description: string;
  steps: StepTemplate[];
};

export type GroupTotal = {
  groupId: string;
  groupTitle: string;
  total: number;
};

export type StepDetail = {
  stepId: string;
  stepLabel: string;
  unit: string;
  groupTitle: string;
  value: number;
  factor: number;
  emission: number;
};

export type CalculationResult = {
  grandTotal: number;
  totalSteps: number;
  activeInputs: number;
  groupTotals: GroupTotal[];
  stepDetails: StepDetail[];
};

export type PeriodType = "monthly" | "yearly";

export type Company = {
  id: string;
  name: string;
  taxNumber: string;
  sector: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
};

export type RecordItem = {
  id: string;
  companyId: string | null;
  createdAt: string;
  companyName: string;
  periodType: PeriodType;
  month: number | null;
  year: number;
  grandTotal: number;
  groupTotals?: GroupTotal[];
  stepDetails?: StepDetail[];
};

export type AnalyticsData = {
  monthlyTotals: Array<{ month: number; total: number }>;
  yearlyTotals: Array<{ year: number; total: number }>;
};
