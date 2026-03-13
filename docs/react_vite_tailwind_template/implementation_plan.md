# 変更目標 (Implementation Plan)

React + Vite + TypeScript + Tailwind CSSのプロジェクトテンプレートを構築し、GitHub Actionsを用いたGitHub Pagesへの自動デプロイ機能を提供する。
パッケージマネージャーには `yarn` を使用する。

## User Review Required

- GitHub PagesのベースURL（`base` オプション）設定について、Viteではリポジトリ名を使用することが一般的です（例: `/viact-template/`）。今回はテンプレート用なので、環境変数 `process.env.GITHUB_REPOSITORY` から動的にベースURLを取得するか、`'./'` のような相対パスにするかのアプローチをとります。
- 今回はワークフローとして `process.env.GITHUB_REPOSITORY` をパースして `base` にする方針を提案します。

## Proposed Changes

### 初期化と設定 (Project Initialization)

#### [NEW] package.json 他 Viteによる初期ファイル
- `yarn create vite . --template react-ts` を使用してプロジェクトを初期化する。
- 不要な初期CSSファイルの中身を整理する。

#### [NEW] tailwind.config.js / postcss.config.js
- Tailwind CSS、PostCSS、Autoprefixerをインストールし、設定ファイルを初期化・設定する。

#### [MODIFY] src/index.css
- Tailwindのディレクティブ (`@tailwind base; @tailwind components; @tailwind utilities;`) を追加する。

#### [MODIFY] vite.config.ts
- GitHub Pages用のデプロイを考慮し、`base` プロパティを `process.env.GITHUB_REPOSITORY ? \`/${process.env.GITHUB_REPOSITORY.split('/')[1]}/\` : '/'` に設定する。

### GitHub Actions (CI/CD)

#### [NEW] .github/workflows/deploy.yml
- `main` ブランチへのpush時に動作するGitHub Actionsワークフローを作成する。
- 依存関係のインストール (`yarn install`)、ビルド (`yarn build`) を行い、GitHub Pagesにデプロイするアクション (例: `actions/upload-pages-artifact` と `actions/deploy-pages`) を組み込む。

### Git 管理

#### [NEW] .gitignore
- Vite標準の `.gitignore` をベースにする。

## Verification Plan

### Automated Tests
- `yarn run build` コマンドがエラーなく正常に終了することを確認する。
- `yarn run dev` でローカルサーバーが立ち上がることを確認する（必要に応じて）。

### Manual Verification
- Vite、React、Tailwindが正しく統合されているかを確認するため、`src/App.tsx` にTailwindのクラス（例: `text-blue-500`, `bg-gray-100` など）を使用したUIを配置し、ビルド結果に含まれるかを検証する。
- ユーザー自身がGitHubにPushし、GitHub Actionsが正常に完走してGitHub Pagesにデプロイされることを確認する。
