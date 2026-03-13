# 修正内容の確認

## 1. App.tsx の軽量化
- 旧 `App.tsx` で同居していたサブビュー・計算・I/O処理を削除。
- 現在は以下に責務を限定。
  - 画面遷移state (`currentView`, `editingExpenseId`)
  - 共有イベントデータstate (`eventData`)
  - FAB開閉state
  - 各ビュー/レイアウト部品の組み立て

## 2. 型定義の分離
- `src/types/domain.ts` に `Member`, `Expense`, `EventData`, `Transfer`, `CalculationLog`, `ViewState` を集約。

## 3. 計算・I/Oロジックの分離
- `src/utils/settlement.ts`
  - 送金フロー計算と明細ログ生成を移植。
- `src/utils/dataIO.ts`
  - JSON保存
  - JSON読込
  - CSV出力

## 4. フックへの分離
- `src/hooks/useToast.ts`
  - トースト表示/自動消去を管理。
- `src/hooks/useExpenseForm.ts`
  - 精算項目フォームのローカルstate
  - 負担比率再計算
  - 端数負担者調整
  - 保存/削除
  - リアルタイムプレビュー計算

## 5. ビュー・コンポーネント分離
- `src/views`
  - `HomeView.tsx`
  - `MemberManageView.tsx`
  - `ExpenseManageView.tsx`
- `src/components/layout`
  - `AppHeader.tsx`
  - `FabMenu.tsx`
  - `Toast.tsx`
- `src/components/home`
  - `SettlementSummary.tsx`
  - `SettlementDetails.tsx`
  - `ExpenseList.tsx`
  - `MemberList.tsx`
  - `DataManagement.tsx`

## 6. 検証
- `yarn build` 実行結果: 成功
