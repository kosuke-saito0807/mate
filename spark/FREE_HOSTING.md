# MATE SPARK: 商用利用可能な無料ホスティング

GitHub Pagesはオンライン事業のための無料ホスティングに用途制限があるため、**商用の正式公開には使わない**。既存のGitHub Pages URLは移行までの開発デモとして扱う。

## 第一候補：Firebase Hosting（Spark 無料プラン）

- Google Firebaseプロジェクトを **Spark（No-cost）** で作り、Firebase Hostingサイトを明示的に作成（2026-10-15以降、プロジェクトにデフォルトサイトが自動生成されない場合がある）
- このリポジトリのルートにある `firebase.json` は `spark/` を公開対象に設定済み
- CLIで `firebase deploy --only hosting --project PROJECT_ID` または接続したFirebaseアプリからデプロイ
- 公開URL（`*.web.app`）が確定したら、掲載相談フォーム `_next` と `_url` は読み込み時に同ドメインへ自動設定される
- GitHub上のMATE CAREの公開設定は変更不要。Firebaseには `spark/` だけをデプロイする
- URL公開後、サイトの上部/下部のリンクを既存SPARKドメインや新しい公開URLへ整合させる

## 第二候補：Netlify Free
- `netlify.toml` を同梱。NetlifyにGitHubリポジトリ `kosuke-saito0807/mate` を接続し、publish directory = `spark`
- ドメイン `*.netlify.app` を割り当て。Netlify Freeは商用プロジェクトに利用可。無料枠を超えると停止する場合があるため使用量を確認

## フォーム受付（$0）
- `partners.html` の教室掲載相談フォームは **FormSubmit** の既存事務局メール `kosodatemate@gmail.com` 宛に送信
- FormSubmit初回利用時には事務局メールでリンク認証が必要な場合がある（同メールで既存MATE CAREフォームを利用中）
- 送信を検証するまでは **メール着信を確認済みと表示しない**
- スパム防止のreCAPTCHAとhoneypotを無効にしない
- 掲載相談は掲載許諾ではない。提供されたデータを自動公開しない
- 体験相談機能は契約教室・同意・安全な受付機能が整うまで `config.json` の `applyEnabled=false` を維持

## 公式情報
- Firebase公式: https://firebase.google.com/pricing
- Netlify公式: https://www.netlify.com/blog/introducing-netlify-free-plan/
- GitHub Pagesの利用制限: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- FormSubmit: https://formsubmit.co/documentation
