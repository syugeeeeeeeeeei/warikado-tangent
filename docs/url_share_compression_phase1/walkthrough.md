# 修正内容の確認

## 1. 入力制限

- イベント名:
  - 20文字上限を導入。
  - 上限超過入力時は自動切り詰めし、トースト通知。
  - 現在文字数をヘッダに表示。
- メンバー名:
  - 10文字上限を導入（新規追加・編集の両方）。
  - 上限超過入力時は自動切り詰めし、トースト通知。

## 2. 圧縮/展開ユーティリティ

- `encodeEventDataToUrlSafe(eventData)`:
  - 共有前にIDを `m0,m1... / e0,e1...` へ正規化
  - JSON化
  - `CompressionStream('gzip')` で圧縮
  - Base64URL化
  - `gz.` プレフィックス付与
- `decodeEventDataFromUrlSafe(encoded)`:
  - プレフィックス検証
  - Base64URL復号
  - `DecompressionStream('gzip')` で展開
  - JSONパースと最低限構造検証

## 3. ID生成

- 新規メンバーID:
  - `crypto.randomUUID()` から `m0,m1...`（base36連番）に変更。
- 新規精算項目ID:
  - `crypto.randomUUID()` から `e0,e1...`（base36連番）に変更。
- 既存IDとの衝突を避けるため、利用中ID集合を見て最短空きIDを採用。

## 4. テスト

- 5つのJSONケースで round-trip を確認。
- URL safe 正規表現検証。
- 文字列長しきい値検証を追加。
- 実行コマンド:
  - `yarn test:share-codec`
  - `yarn analyze:share-codec`

## 5. 分析結果（要約）

- ケース別圧縮後文字列長:
  - 最小: 247
  - 小規模: 455
  - 中規模: 1209
  - 日本語境界: 1050
  - 大規模: 2442
- 合計圧縮率:
  - Raw JSON比: 7.6%
  - Raw Base64URL比: 5.7%

詳細は `compression_report.md` を参照。
