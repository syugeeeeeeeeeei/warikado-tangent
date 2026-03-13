# React + Vite + TypeScript + Tailwind CSS Template

このリポジトリは、最新のWebフロントエンド開発を素早く立ち上げるためのプロジェクトテンプレートです。
React, Vite, TypeScript, Tailwind CSSを組み合わせたモダンで高速な開発環境があらかじめ構築されています。

## 📦 主なライブラリとバージョン情報

- **React**: `^19.2.4`
- **Vite**: `^8.0.0`
- **TypeScript**: `~5.9.3`
- **Tailwind CSS**: `^3.4.0`
- **パッケージマネージャー**: `yarn`

## ✨ 特徴 (Features)

- **Viteによる爆速な起動とHMR**: 開発体験を大きく向上させる高速なビルドツール
- **TypeScriptの静的型付け**: 安全で保守性の高いコードベースの構築
- **Tailwind CSSのユーティリティファースト**: 直感的で素早いスタイリング
- **ESLint適用済み**: コードの品質を一定に保つためのLinter構成
- **GitHub Actions連携済み**: GitHub Pagesへの自動デプロイワークフローを内包

## 🚀 リポジトリの活用方法 (How to Use)

このリポジトリは「テンプレートリポジトリ」として設定されています。以下の手順で自分自身の開発プロジェクトを開始できます。

1. GitHub上の対象リポジトリページ右上にある **[Use this template]** ボタンをクリックし、**[Create a new repository]** を選択します。
2. 作成するリポジトリ名を入力し、ご自身のアカウント下に新しいリポジトリを作成（Clone）します。
3. 作成したご自身のリポジトリをローカル環境にクローンします。

\`\`\`bash
git clone https://github.com/あなたのユーザー名/作成したリポジトリ名.git
cd 作成したリポジトリ名
\`\`\`

## 🛠️ ローカルでの開発手順

依存関係のインストールには **yarn** を推奨します。

### 1. 依存関係のインストール

\`\`\`bash
yarn install
\`\`\`

### 2. 開発用サーバーの起動

\`\`\`bash
yarn dev
\`\`\`
起動後、ブラウザで `http://localhost:5173/` にアクセスすると開発画面が表示されます。

### 3. 本番用ビルドの実装テスト

\`\`\`bash
yarn build
\`\`\`
エラーなく実行されれば、本番環境向けの軽量な静的ファイル群が `dist/` ディレクトリに生成されます。

## 🌐 GitHub Pagesへの自動デプロイ

このテンプレートには `.github/workflows/deploy.yml` に記載の通り、GitHub Pages向けデプロイ用アクションが組み込まれています。

**デプロイ設定を有効化する手順：**

1. 作成したご自身のリポジトリの **Settings** を開きます。
2. 左側メニューから **Pages** を選択します。
3. **Build and deployment** セクションの **Source** を `Deploy from a branch` から **`GitHub Actions`** に変更してください。
4. 以降、`main` (または `master`) ブランチへ変更を Push するたびに、自動的にGitHub Actionsが実行され、GitHub Pagesに変更が反映されます。
