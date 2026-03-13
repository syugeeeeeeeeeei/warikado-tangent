// イベント参加者の最小単位。
export interface Member {
  id: string;
  name: string;
}

// 各精算項目におけるメンバーごとの負担比率。
// isGradientMode=false の場合は ratio>0 を「負担対象」として扱う。
export interface ExpenseRatio {
  memberId: string;
  ratio: number;
}

// 精算項目（1つの支出）を表すドメインモデル。
export interface Expense {
  id: string;
  name: string;
  amount: number;
  // 立て替え払いしたメンバー ID。
  payerId: string;
  ratios: ExpenseRatio[];
  // true: 割合（%）をそのまま使用 / false: 対象人数ベースで等分。
  isGradientMode: boolean;
  // 端数（切り捨て後の残額）を最終的に負担するメンバー ID。
  fractionBearerId: string;
}

// アプリ全体で保存・復元するイベントデータ。
export interface EventData {
  name: string;
  members: Member[];
  expenses: Expense[];
}

// 最終精算で必要な送金情報。
export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

// CSV 出力向けの計算ログ。
export interface CalculationLog {
  memberId: string;
  expenseName: string;
  formula: string;
  amountOwed: number;
  amountPaid: number;
  net: number;
}

// 1つの精算項目における、各メンバーの負担内訳。
export interface ExpenseBreakdownItem {
  memberId: string;
  amountOwed: number;
  formula: string;
}

// 精算項目単位の内訳情報（詳細表示用）。
export interface ExpenseBreakdown {
  expenseId: string;
  expenseName: string;
  payerId: string;
  amount: number;
  items: ExpenseBreakdownItem[];
}

// 画面遷移状態。
export type ViewState = 'home' | 'manage_members' | 'manage_expenses';
