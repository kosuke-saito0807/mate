# MATE SPARK 0円構成・公開運営手順

## 正式公開と更新

- 公開先: https://mate-spark.web.app/ （Firebase Hosting / Spark）
- 正本コード: https://github.com/kosuke-saito0807/mate/tree/main/spark
- 元ChatGPT Sitesサイト: https://naraico.kosuke-saito0807.chatgpt.site/ （別プロジェクト。Firebaseには自動同期されない）
- 非公開営業・許諾DB: https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit
- GitHub PagesのSPARK版は開発プレビュー。商用配信はFirebaseを利用する

これまで使っていたCloud Shellで、次を実行する（~/mate にclone済みの場合）:

    cd ~/mate
    git status --short
    git pull --ff-only origin main
    firebase deploy --only hosting --project mate-spark

git statusでローカル変更が表示された場合、削除・上書きの前に内容を確認すること。

## 将来の更新をFirebaseへ自動反映（現在は準備済み、既定OFF）

公式手順: https://firebase.google.com/docs/hosting/github-integration

1. Cloud Shellで cd ~/mate を実行
2. firebase init hosting:github を実行。GitHubリポジトリ kosuke-saito0807/mate と Firebaseプロジェクト mate-spark を選ぶ
3. Firebase CLIが専用サービスアカウントを作り、GitHubのActions Secretへ暗号化して登録したことを確認する
4. GitHub Settings → Secrets and variables → Actions → Secrets に FIREBASE_SERVICE_ACCOUNT_MATE_SPARK があることを確認（**秘密鍵の値をチャットやリポジトリに貼らない**）
5. GitHub Settings → Secrets and variables → Actions → Variables に MATE_FIREBASE_AUTO_DEPLOY_ENABLED を true として追加
6. GitHub Actionsに用意した Deploy MATE SPARK to Firebase Hosting (free) を手動実行し、成功を確認する

上記のFirebase CLIが別名の追加ワークフローをローカルに作っても、二重デプロイ防止のためGitHubには追加コミットしない。すでに専用の .github/workflows/firebase-spark-live.yml がある。変数がtrueでない限りFirebase自動デプロイは無効。

自動デプロイ有効後、mainへのSPARK変更または教室公開JSON更新がFirebaseにも反映される。認証情報が不足した場合はビルドが失敗し、公開処理は完了しない。

## 教室掲載と許諾

Google Sheetsの「SPARK営業候補」タブで管理する主な列:

- A ID、B 教室名、C 都県、D ジャンル、E 公式HTTPS URL、K 掲載許諾
- M 対象学年、N 最寄駅、O 承認済み紹介文、P 体験受付許諾、Q 掲載内容確認日
- R 月謝税込円、S 体験料金税込円、T/U 対象最少年齢/最高年齢、V 曜日、W 所在地、X 特徴タグ、Y 次回体験予定日

未確認の料金・曜日・年齢・体験日時を推測で入力しない。無料の体験料は数字0とする。

掲載開始には、K掲載許諾が「許可/承諾済/許諾済」であること、および「掲載契約」タブに有効なSPARK契約ID、同意者、日時、合意証跡、開始・終了条件の記録が必要。掲載の許諾と体験申込の取次許諾は別物。Pが「可」の教室のみ体験相談の対象となる。

非公開の担当者連絡先、合意証跡、契約金額、申込者の個人情報は公開JSONに絶対含めない。掲載停止依頼があった場合は同意を撤回し、同期・Firebase更新を確認する。

Google Sheets→GitHubの公開データ同期は原則30分ごと（既存の読み取りサービスアカウントが正常に動く場合）。GitHub→Firebaseは上記の自動公開設定が有効な場合だけ自動。

## 0円の一般相談と体験取次ぎ（2026-10-30 更新）

- **一般相談窓口**：SPARKの「習い事の相談」から共通の `https://kosuke-saito0807.github.io/mate/consult.html?service=SPARK` に遷移する。CARE・PLAYと同じApps Script「MATE 直接掲載受付」で受け付け、事務局Gmailに非公開通知、申込者のアドレスに受付番号のみの自動受付メールを送る。
- **提供しない機能**：一括体験相談フォームは依然停止。未承認の教室、架空12件、取次許諾のない教室には保護者情報を一切転送しない。`spark/config.json` の `trialIntakeEnabled=false`、`applyEnabled=false` は維持。
- **本番テスト**：GitHub PagesとFirebase Hostingそれぞれの更新実施状況をActionsと実サイトで確認し、実際のSPARK相談を1件提出。受付番号がGoogle Sheetsの「問い合わせ管理」、運営Gmail通知、申込者への受付確認メールで一致するまで「実送受信完了」と表示しない。
- **予約の扱い**：通常相談は日程確定や体験予約、教室への自動取次ぎではない。具体的な教室への取次ぎには掲載契約・受入れ許諾と保護者の別途同意が必要。
- **旧FormSubmit手順の廃止**：初回メール認証、旧フォームURL、Legacyメール取込を復活させない。GitHubでのApps Script原本更新だけでは本番GASは切り替わらず、運営者による既存デプロイの新バージョン更新が必要。

## 元サイトとの一致状況と残作業

元サイトの文章・ABOUT・OUR MISSION・検索条件・比較・お気に入り・掲載相談等に近づけた独立サイトである。元サイトの実際の写真・画像原本、会員/運営管理画面、元のCMS実装を取得できていないため、ピクセル完全一致ではない。元の画像・ソースを権利を確認して移行すればさらに一致度を高められる。

### 公開後チェック
- PCとスマホのトップ、ロゴ、すべてのリンク
- 12件の架空サンプルの詳細・比較、料金・曜日・ジャンル・年齢検索
- お気に入りの端末保存、最大5件比較
- デモ時は体験相談ボタンを必ず無効にする
- 掲載許諾と体験受付許諾の分離
- 事務局メール受信と手動の契約照合作業
- FirebaseデプロイとGitHub Actionsの成功ログ


## 2026-10-21 品質監査・公開安全性（補足）

- 正式サイトのCARE→SPARK導線は https://mate-spark.web.app/ に統一。旧 `/spark/compare.html` は新トップへ案内して旧申込フォームを使用不可とした。
- `spark/config.json` の `trialIntakeEnabled` は初期値 `false`。掲載許諾＋体験受付許諾を取得した**だけでは**フォームは開かない。事務局がFormSubmitの宛先メール認証、実受信、利用規約/個人情報同意、掲載契約と取次体制を検証してから別途有効化する。
- CAREの承認済み掲載データは、公開許諾／MATE掲載ステータスの両方・有効なHTTPS公式URL・掲載情報確認日（未来日不可）が必要。未知の情報や日付を補完しない。
- Google Sheets同期は `GITHUB_TOKEN` でmainにcommitしても別のpushワークフローを起動しないため、`sync-smartsheet-public.yml` 内で同期結果に差分があれば、Firebaseデプロイを**直接実行**するよう修正済み（変数ONかつSecret登録済の場合）。
- CARE/SPARKのPC/スマホ実ブラウザ操作は `.github/workflows/browser-smoke.yml` で自動検証する。スクリーンショットはActionsの成果物に7日間保存。フォーム送信は遮断し、ダミーデータのみで挙動を検証する。
- ChatGPT SitesでホストされるPLAYと元SPARKは、現状そのサイトの編集用ソースと認証付き操作画面を取得できない。元サイトとの写真・ピクセル完全一致、PLAYのライブ実機操作、FormSubmitの実受信、Vercel APIの接続先はこのCIでは検証していない。**未検証を合格と記録しない**。
- 営業V3 Apps Scriptは別のGoogle環境で稼働する。キューの実送信承認と送信ONが必要だが、スクリプトプロパティ・トリガーの実設定はGitHub CIから取得不可。ユーザーからの送信許可がないため変更も送信も実施しない。
