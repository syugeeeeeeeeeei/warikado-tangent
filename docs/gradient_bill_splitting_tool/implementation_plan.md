# 勾配割り勘ツール (Gradient Bill Splitting Tool) - 実装計画

本アプリ「勾配割り勘ツール」をローカルリポジトリにセットアップし、GitHub Pagesにデプロイ可能な状態にするための計画です。

## 提案する変更

### 1. 依存関係の更新・追加
- **追加**: `lucide-react` (アイコン用) を最新バージョンでインストールします。
- `Tailwind CSS` は既定で入っているプロファイル(Vite+React+Tailwind)と思われるため、設定を確認・調整します。

### 2. ソースコードの反映
#### [MODIFY] [App.tsx](file:///home/multics/work/warikado-tangent/src/App.tsx)
- 提供されたReactコード（勾配割り勘ツールのSPA）に完全に置き換えます。

### 3. 不要ファイルの削除
- 初期テンプレートに含まれる不要なCSS (`App.css` など) やアセット (`react.svg` 等) を削除し、プロジェクトをクリーンにします。

### 4. GitHub Pages向けデプロイ設定
#### [MODIFY] [vite.config.ts](file:///home/multics/work/warikado-tangent/vite.config.ts)
- `base: '/warikado-tangent/'` を追加し、GitHub Pagesのサブディレクトリで正しくアセットが読み込まれるようにします。

#### [NEW] [deploy.yml](file:///home/multics/work/warikado-tangent/.github/workflows/deploy.yml)
- (リポジトリに既存のワークフローがなければ) GitHub Actionsを使用して自動でビルドし、GitHub Pagesにデプロイするための設定ファイルを作成します。

## 確認計画
- `yarn install` と `yarn build` を実行し、エラーなくビルドできることを確認します。
- ブラウザ上で提供されたコードが正常にレンダリング・動作するかどうかを確かめる構成にします。
