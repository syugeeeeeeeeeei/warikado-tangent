export interface Member {
  id: string;
  name: string;
}

export interface ExpenseRatio {
  memberId: string;
  ratio: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  payerId: string;
  ratios: ExpenseRatio[];
  isGradientMode: boolean;
  fractionBearerId: string;
}

export interface EventData {
  name: string;
  members: Member[];
  expenses: Expense[];
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface CalculationLog {
  memberId: string;
  expenseName: string;
  formula: string;
  amountOwed: number;
  amountPaid: number;
  net: number;
}

export type ViewState = 'home' | 'manage_members' | 'manage_expenses';
