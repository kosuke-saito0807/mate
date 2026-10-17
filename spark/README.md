# MATE SPARK | 学習塾・習い事の比較・一括体験相談

## 現在の状況（2026-10-17）
- \`spark/index.html\`: 画面 / 検索 / 最大5教室の比較 / 体験相談フォームを実装。
- \`spark/schools.json\`: 公開許諾済みの教室だけを掲載する正式データ。現在は **[]**（空）。
- \`spark/demo-schools.json\`: 架空データ。 \`/spark/?demo=1\` で表示し、実際の申込はできない。
- \`spark/config.json\`: 申込受付の有効・無効とAPI URL/Turnstile公開キーを設定。初期値は無効。
- \`api/experience-request.js\`: Vercel（Node.js 18+）用申込受付API。未デプロイ・未設定。
- このリポジトリの本体は **MATE CARE**。MATE SPARK（ChatGPT Sites上の \`naraico.kosuke-saito0807.chatgpt.site\`）とは別。CAREトップページは変更しない。

## 公開教室データの書式
\`\`\`json
[
  {
    "id": "school-001",
    "name": "掲載許諾済みの教室名",
    "region": "東京都",
    "station": "駒込駅",
    "category": "学習塾",
    "ages": ["小学生", "中学生"],
    "description": "事前承認された紹介文",
    "url": "https://school.example/",
    "approved": true,
    "acceptsTrial": true
  }
]
\`\`\`
- 公開済みの企業情報から営業候補を無断転記しない。掲載許諾、最新情報の校正、体験相談の受託可否を事前に確認する。
- \`approved: true\` で表示対象。申込対象はさらに \`acceptsTrial: true\` の教室のみ。
- 公開JSONに担当者メールアドレス、契約情報、申込者の個人情報を置かない。

## APIの準備
GitHub Pagesは静的配信のため \`api/\` を実行できない。**Vercelのようなサーバー環境**にAPIをデプロイする。

環境変数（ブラウザーやGitHubへコミットしないこと）:
- \`ALLOWED_ORIGINS\`: \`https://<site-domain>,https://<approved-preview-domain>\` のように許可する正確なOriginをカンマ区切り
- \`TURNSTILE_SECRET_KEY\`: Cloudflare Turnstileの非公開シークレット
- \`RESEND_API_KEY\`: Resendの非公開APIキー
- \`REQUEST_FROM_EMAIL\`: Resendで検証済みの送信者アドレス
- \`REQUEST_TO_EMAIL\`: NextEdu運営受付メール
- \`PROVIDER_NOTIFICATIONS_ENABLED\`: 初期値 \`false\`。提携教室側の承諾とルーティング確認が済んだ後のみ \`true\`
- \`SCHOOL_NOTIFICATION_ROUTING\`: \`{"school-001":"partner@example.com"}\` のような非公開ID→通知先マッピング。全対象教室の配送先がある場合だけ一斉通知処理を実施する

API動作:
1. 呼び出しOrigin確認とTurnstile認証を行う。
2. 氏名、連絡先、対象学年、同意、教室数の妥当性を検証。
3. 受付可能な教室IDを **サーバー側** で検証し、運営者宛に申込通知を送る。
4. オプトイン設定された場合に限り、教室ごとに必要情報だけを個別通知。通知失敗時は運営側メールをもとに手動フォローする。

\`spark/config.json\` の \`applyEnabled\` を \`true\`、\`apiUrl\` をデプロイしたHTTPSエンドポイント、\`turnstileSiteKey\` を公開キーに設定すると申込UIが有効になる。ただし、掲載データに \`acceptsTrial: true\` がなければ申込不可。

**公開前チェック（必須）**
- [ ] MATE SPARKの利用規約・プライバシーポリシーに、本人同意に基づく選択教室への個人情報提供、保存期間、問い合わせ先を明記
- [ ] 教室が掲載・申込の取次および通知先を承諾
- [ ] HTTPS配信・送信ドメイン認証・SPF/DKIM・Turnstile・Origin設定を完了
- [ ] 1教室/複数教室/入力エラー/認証失敗/通知失敗の実機テスト
- [ ] 申込データの保管・削除と事務局での対応フローを定義
- [ ] トラフィックが増えた場合は永続的な受付ログ・重複排除・レート制限を追加（現行はメール受付のみ）

## 既存のMATE SPARK本体へ統合する場合
現行SPARKの正本はChatGPT Sites。ここで作成したGitHub実装は、その管理画面と同期していない。Sites編集権限のある環境に以下を移植する。
- 公開許諾済み教室DB → 検索条件 → 比較候補 → 体験申込フォーム
- フォーム → HTTPS API → MATE運営通知 → 契約済み教室への個別通知
- 現行SPARKデザイン、既存の習い事カテゴリ、運営者/法務ページに接続
- 同意ログ・永続保存・重複排除が必要なら、Sitesが提供する認証付きDBまたは別のサーバー側DBを使用

**注意：** GitHubのコードをマージするだけではChatGPT Sitesの公開SPARKサイトは変化しない。
