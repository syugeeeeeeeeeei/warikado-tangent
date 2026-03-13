# 修正内容の確認

## 1. 生成ファイル

- `tests/fixtures/share_codec/suwa_testdata.json` を作成。
- イベント名は `諏訪旅`。
- メンバー5名、立替項目18件を格納。

## 2. データ変換の要点

- 対象者略号マッピング:
  - `澤 -> 澤村`
  - `ま -> まつひろ`
  - `塩 -> 塩田`
  - `と -> ともやん`
  - `し -> しょーま`
- 各項目はこのアプリの `EventData.expenses[]` 形式へ変換。
- すべて短ID（`m*`, `e*`）で保存。

## 3. URL化テスト結果

- `yarn analyze:share-codec` の `suwa_testdata` 行:
  - Raw JSON長: `10009`
  - Raw Base64URL長: `13706`
  - 圧縮後文字列長: `663`
  - Raw比: `6.6%`
- `yarn test:share-codec` は6ケースで成功。
- `suwa_testdata` のしきい値を `900` に設定し、回帰テスト化。
