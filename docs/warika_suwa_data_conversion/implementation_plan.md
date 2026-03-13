# 実装計画

## 1. 抽出ルール定義

- イベント名: `諏訪旅`
- メンバー: `澤村・まつひろ・塩田・ともやん・しょーま`
- 各立替項目の要素:
  - 項目名
  - 金額（`¥` と `,` を除去して整数化）
  - 立替者
  - 対象者（丸アイコンの略号: `澤/ま/塩/と/し`）

## 2. 変換方針

- IDは短IDを採用:
  - メンバー: `m0..`
  - 精算項目: `e0..`
- `isGradientMode=false` とし、対象者は `ratio=1`、非対象者は `ratio=0`。
- `fractionBearerId` は立替者を優先（立替者が対象外なら先頭対象者）。

## 3. テスト反映

- `suwa_testdata.json` を `tests/fixtures/share_codec/` に追加。
- `tests/shareCodec.test.cjs` の長さしきい値に `suwa_testdata` を追加。
- `yarn analyze:share-codec` / `yarn test:share-codec` を実行。
