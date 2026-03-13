# 実装計画

## 1. 共有UI

- `DataManagement` に共有ボタンを追加し、操作の入口を一本化する。
- 共有操作はホーム画面の `ShareSheet`（ボトムシート）で提供する。
  - リンクをコピー
  - 他アプリで共有（Web Share API対応端末のみ）
  - JSON保存（フォールバック導線）

## 2. 共有リンク生成

- `encodeEventDataToUrlSafe(eventData)` でpayloadを生成する。
- URLは `origin + pathname + search + '#s=' + payload` で組み立てる。
- 生成中/失敗の状態をUIに反映する。

## 3. 共有時UX

- URL長を表示し、推奨値・警戒値を超えたら警告を出す。
- 共有失敗時はトーストで結果を返し、コピーへフォールバックできるようにする。

## 4. 自動ロード

- `App` の初回表示時に `window.location.hash` から `s` を取得。
- decode成功時に `eventData` へ反映し、ホームへ遷移する。
- 読込後は `history.replaceState` でハッシュを消して再利用しやすくする。
