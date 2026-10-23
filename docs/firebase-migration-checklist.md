# MATE 3サービス公開統一：移行チェックリスト

## 現状（2026-10-23）
- CARE: GitHub Pages (`kosuke-saito0807.github.io/mate/`)。ソースは `kosuke-saito0807/mate`。
- SPARK: Firebase Hosting (`mate-spark.web.app`)。元のソース・FirebaseプロジェクトID・認証/DBの管理権限は未取得。
- PLAY: `mate-play.kosuke-saito0807.chatgpt.site`。公開中のソースと運用環境への編集権限は未取得。
- Firebase Hosting の実デプロイ、独自ドメイン購入・DNS更新、旧URL転送は**未実行**。

## 移行条件（順序固定）
1. SPARK / PLAY のソース・画像・環境変数名・DB・APIの参照先・フォーム送信先を取得し、非公開バックアップを作成。秘密情報はコミットしない。
2. 両サイトの公開プロフィールを `docs/mate-public-operator-profile.md` と同じ表現にする。法令上必要な事業者情報は適切に扱う。
3. 3サービスのディレクトリを `sites/care`、`sites/spark`、`sites/play` に整理。相対パス・アセット・Google Sheets / Apps Script / Firebase / フォーム連携を実機で確認。
4. Hosting: 各サービス別 Firebase Hosting site + 単一 Firebase プロジェクト運用を基本候補とする。既存SPARKの認証・バックエンド構成を確認してから決める。
5. 独自ドメイン（未取得）に `care.`、`spark.`、`play.` サブドメインを割り当て、DNS検証とSSL証明書を確認。
6. 旧URLを順次301/308転送。GitHub Pages / Firebase / chatgpt.site の各旧環境で転送設定が可能か別途確認。移行後も旧URLから到達をテストする。
7. PC/スマホで検索・詳細・掲載申込・相談・Sheets承認・通知・プライバシーポリシー・Analyticsを検証し、バックアップ復旧手順を確保してから旧環境停止。

注意：GitHubユーザー名とコミット履歴には個人を識別しうる情報が残り得る。独自ドメイン化はアカウントの完全匿名化と同義ではない。
