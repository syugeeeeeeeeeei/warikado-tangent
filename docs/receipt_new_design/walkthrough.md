# 修正内容の確認 (Walkthrough) - receipt_new_design

## 1. 型定義の追加
`src/types/domain.ts` に以下を追加。
- `ExpenseBreakdownItem`
- `ExpenseBreakdown`

これにより、精算項目ごとの内訳データをUIで扱えるようにした。

## 2. 計算ロジックの整理
`src/utils/settlement.ts` を更新。

- `calculateExpenseBreakdowns(data)` を新規追加。
  - 各精算項目について、対象メンバーの最終負担額（端数反映済み）と式を生成。
- `calculateSettlement(data)` は上記内訳を利用する形へ変更。
  - 返却値に `breakdowns` を追加。
  - 従来どおり `transfers` と `logs` は維持。

これで、最終精算結果と詳細表示の元データの整合性を保ちやすくした。

## 3. HomeViewの受け渡し更新
`src/views/HomeView.tsx` を更新。

- `calculateSettlement` の返却から `breakdowns` を受け取る。
- `SettlementDetails` に以下を渡すよう変更。
  - `transfers`
  - `breakdowns`
  - `getMemberName`

## 4. 詳細UIの全面改修
`src/components/home/SettlementDetails.tsx` を更新。

### 4-1. 複数選択フィルタ
- 表示メンバーを複数選択できるUIを追加。
- 初期状態は全メンバー表示。
- 「全表示」「全解除」をサポート。

### 4-2. 支払う額カード
- 各メンバーが各精算項目で「誰にいくら払うか」を表示。
- 例：Aさん立替の項目では Aさん自身にも `A → A` が表示される。

### 4-3. 受け取る額カード
- 各メンバーが立替人である項目について、
  他メンバーから「いくら受け取るか」を表示。
- 自分自身からの受け取り行は除外。

### 4-4. トータル結果カード
- 最終送金結果（`transfers`）をメンバー視点で集約表示。
- 左に対象メンバー、右に相手メンバーを配置。
- 支払いは `→` かつ赤色、受け取りは `←` かつ緑色。

## 5. 検証結果
- `yarn build` が成功。

## 6. 勾配モードの比率入力改善
- 対象: `src/hooks/useExpenseForm.ts`, `src/views/ExpenseManageView.tsx`, `src/App.tsx`

### 6-1. 0/空欄入力の確定時補完
- 比率入力フォームに `onBlur` を追加し、`0` または空欄で確定された場合はその入力を未編集扱いに戻す。
- 他メンバーの編集済み比率を基準に、残り割合を再分配して補完する。

### 6-2. 0%メンバーの自動再分配
- 比率再計算の結果、アクティブメンバーに0%が出た場合は自動で再分配する。
- 例: 3人で1人に100%入力した場合、`98% / 1% / 1%` に補正。

### 6-3. 警告トースト
- 0%が発生して自動再分配したとき、以下を表示。
  - `負担割合0%のメンバーが出たため自動で再分配しました。`

### 6-4. 受け渡し変更
- `showToast` を `App -> ExpenseManageView -> useExpenseForm` に渡し、フォーム内ロジックから警告表示できるようにした。

## 7. 勾配モードに「均等化」ボタンを追加
- 対象: `src/hooks/useExpenseForm.ts`, `src/views/ExpenseManageView.tsx`
- 勾配モード表示時に `均等化` ボタンを追加。
- 押下時、対象メンバー数に応じて合計100%で均等配分（端数は先頭から+1）する。
  - 例: 3人なら `34 / 33 / 33`

## 8. 勾配入力フォームの編集状態ラベル追加
- 対象: `src/views/ExpenseManageView.tsx`
- 編集済みフォーム（`isEdited=true`）に小さな `変更済み` バッジを表示するように変更。
- 既存の色変化に加えてテキストでも状態が判別できるようにした。
