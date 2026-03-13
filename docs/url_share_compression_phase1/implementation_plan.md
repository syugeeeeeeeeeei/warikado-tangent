# 実装計画

## 1. 入力制限UI

- `src/constants/inputLimits.ts` を新設し、上限を一元管理。
- イベント名入力は20文字を超える場合に自動トリム。
- メンバー名入力は10文字を超える場合に自動トリム。
- 超過時トーストは連打を避けるため、同一超過状態では1回だけ表示。

## 2. 圧縮/展開ロジック

- `src/utils/shareCodec.ts` を新設。
- `EventData -> 固定配列スキーマ(v1) -> JSON -> gzip圧縮 -> Base64URL` でエンコード。
- `Base64URL -> gunzip -> JSON` でデコード。
- `gz.` プレフィックスを持たせ、将来フォーマット拡張に備える。
- 共有スキーマはキー名をほぼ排除し、`ratios` は 0 を持たない疎表現を採用。
- 共有直前にIDを `m0,m1... / e0,e1...` へ正規化し、UUID混入時もサイズを抑える。

## 3. ID生成最適化

- 新規メンバーID・精算項目IDは `crypto.randomUUID()` を使わず、base36連番で採番。
- 既存ID集合と衝突しない最短IDを選ぶユーティリティを導入。

## 4. テストデータ

- `tests/fixtures/share_codec/` に5ケースを作成。
  - 最小ケース
  - 小規模ケース
  - 中規模ケース
  - 日本語境界文字ケース
  - 大規模密ケース

## 5. テストと分析

- `tests/shareCodec.test.cjs`
  - round-trip可逆性
  - URL safe文字列検証
  - ケースごとの文字列長しきい値検証
- `tests/shareCodec.analysis.cjs`
  - Raw JSON長 / Raw Base64URL長 / 圧縮後長を算出
  - `docs/url_share_compression_phase1/compression_report.md` へ出力
