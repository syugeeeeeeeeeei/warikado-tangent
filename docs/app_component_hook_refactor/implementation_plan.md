# 実装計画

## 目的
`App.tsx` に集中していた型定義・ビジネスロジック・画面描画・状態管理を分離し、保守性と再利用性を向上させる。

## 方針
1. ドメイン型を `types` へ切り出す。
2. 計算ロジックとデータ入出力を `utils` へ切り出す。
3. 状態管理ロジックを `hooks` へ切り出す。
4. 画面単位を `views`、再利用UIを `components` へ分割する。
5. `App.tsx` はルーティング的な制御と上位state保持に限定する。
6. 最後に `yarn build` で型・ビルド整合性を確認する。

## 想定ディレクトリ
- `src/types/domain.ts`
- `src/utils/settlement.ts`
- `src/utils/dataIO.ts`
- `src/hooks/useToast.ts`
- `src/hooks/useExpenseForm.ts`
- `src/views/HomeView.tsx`
- `src/views/MemberManageView.tsx`
- `src/views/ExpenseManageView.tsx`
- `src/components/layout/*`
- `src/components/home/*`
