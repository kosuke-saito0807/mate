# MATE — CARE / SPARK

子育て家庭向けサービス「MATE CARE」「MATE SPARK」の**公開Webサイトのコードと運用テスト**を管理するGitHubリポジトリです。MATE PLAYの原本・Firebase移行版は個人情報や非公開の運用コードを含むため、別の**非公開GitHubリポジトリ**で管理します。

## サービス・公開先

| サービス | ソースコード | 公開先 | 配信 |
|---|---|---|---|
| MATE CARE | このリポジトリ `main`（ルートと `assets/`） | https://kosuke-saito0807.github.io/mate/ | GitHub Pages |
| MATE SPARK | このリポジトリ `main` の `spark/` | https://mate-spark.web.app/ | Firebase Hosting（GitHub Actionsで認証確認後に配信） |
| MATE PLAY | 非公開GitHub `mate-platform-private:main` の `firebase-static/` と `play/` | 現在の正式版は旧ChatGPT Sites。FirebaseはTESTのみ | PLAY専用Firebase TEST。正式切替は未実施 |

## GitHubでの運用方法

1. `main` から `feature/*` などの作業ブランチを作り、Pull Requestで変更内容と回帰テストを確認します。
2. CAREは `.github/workflows/pages.yml` でGitHub Pagesへ配信します。
3. SPARKは `.github/workflows/firebase-spark-live.yml` で、権限・GitHub設定が整っている場合に `mate-spark` Firebaseへ配信します。
4. コンテンツ・SEO記事・サイトマップ・GA4計測設定もソースとしてGitHubで管理します。Google Analyticsの実際の受信・Google Search Consoleの登録状況は各Googleサービス上で別途確認します。
5. 掲載の原本・企業との合意・家族からの問い合わせ・同意記録はアクセス制御されたGoogle Sheets等で管理し、**掲載許可を得て確認済みの公開可能な情報だけ**をGitHub管理の公開JSONに反映します。

## よく触る場所

- `index.html` / `*.html`：CAREの画面・案内・記事
- `assets/`：CAREのフロントエンドアセット
- `spark/`：SPARKの画面・検索・公開用データ
- `tests/`：検索・承認・個人情報・SEOなどの自動テスト
- `.github/workflows/`：検証と配信パイプライン
- `docs/`：公開前チェック・更新履歴・集客計画
- `sitemap.xml` と `spark/sitemap.xml`：検索エンジン向けのサイトマップ

### 独自ドメインを取得する前に
現行URLのまま、コード、画面、掲載許可条件、CI、Firebase TEST、SEOコンテンツをGitHubで整備できます。独自ドメイン取得後にcanonical・GA4・Search Console・Firebaseカスタムドメインの設定を切り替えます。**ドメインがなくてもGitHubの整理には意味があります。**

公開リポジトリのGit履歴は外部から閲覧可能です。個人情報、連絡先原本、社内資料、Firebase/Google認証ファイル、PLAYの非公開原本を追加しないでください。
