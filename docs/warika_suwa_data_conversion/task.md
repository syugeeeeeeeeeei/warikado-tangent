# タスクリスト

## 依頼内容

- ワリカ画面情報（HTML断片）から必要データを抽出する。
- このアプリで使用できる `EventData` 形式へ変換する。
- テストデータとして `suwa_testdata.json` を保存する。
- URL化（圧縮 + Base64URL）テストを実行し、結果を確認する。

## 実施項目

- [x] 参加者、立替項目、立替者、対象者、金額を抽出。
- [x] 抽出データを `EventData` 形式へ変換。
- [x] `tests/fixtures/share_codec/suwa_testdata.json` を作成。
- [x] URL化分析 (`yarn analyze:share-codec`) を実行。
- [x] URL化テスト (`yarn test:share-codec`) にケース追加し検証。
