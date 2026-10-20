# MATE SPARK｜習い事探しに、頼れる相棒を。

正式公開: https://mate-spark.web.app/ （Firebase Hosting）
ソース: `/spark/` / Google Sheetsで教室掲載の許諾・公開データを管理

## 2026年10月20日時点の公開状態

- GitHubのmain更新時、`spark/**` の変更をGitHub Actionsが自動検証・Firebaseへ公開する。連携テスト https://github.com/kosuke-saito0807/mate/actions/runs/39351112807 は成功。
- `spark/index.html`: ABOUT・OUR MISSION・SCENE・検索・お気に入り・比較・詳細・条件付き体験相談受付。
- `spark/hero-family-robot.svg`: 2人の子どもと2人の大人が工作する専用イラスト。**元ChatGPT Sitesの実際の写真原本とは別素材**。完全一致を宣言しないこと。
- `spark/schools.json`: **掲載許諾＋有効な掲載契約がある教室のみ**。現在は空配列（実在教室の掲載なし）。
- `spark/demo-schools.json`: 12件の架空サンプル。学校名、月謝、日時は説明用。体験申込不可。
- `spark/partners.html`: 本部・教室の掲載相談（利用者用申込フォームとは区別）。
- `spark/privacy.html`, `terms.html`, `disclaimer.html`, `operator.html`: 運営・法務表示。
- `spark/config.json`: 将来の別API向けフラグは無効。現在のFormSubmit運営事務局受付とは別系統。

## 実在教室の掲載を始める条件

1. 非公開のGoogle Sheets「SPARK営業候補」に連絡先、公式情報、紹介文、対象学年などを記録する。
2. **掲載許諾を取得**し、公開前に教室側と紹介文・情報の内容を確認する。
3. 非公開の「掲載契約」タブに掲載先IDが一致する有効契約・同意者・同意日時・合意証跡・必要な契約条件を記録する。
4. 体験相談取次ぎは掲載契約と**別の明示的な許諾**が必要。「体験受付許諾」が「可」でない限り申込不可。
5. GitHub Actionsの`sync-smartsheet-public.yml`が許諾済みデータだけをJSONに公開する。公開JSONに担当者メールや契約証跡を載せない。
6. 保護者からの相談はFormSubmit経由で一度MATE事務局メールへ。**教室には手動で合意と宛先を確認した上で個別取次ぎ**を行う。予約は確定しない。

未許諾の学校を「実在掲載教室」として公開しない。フォーム初回メール認証・受信検証が済むまでは送客できたとみなさない。

## 品質・運用

- `python3 -m unittest discover -s tests -p 'test_spark*.py' -v` で画面・権限・プライバシー・サンプルの扱いを検証。
- 公開テスト: https://mate-spark.web.app/ に表示される最新の修正、スマホレイアウト、検索、法務ページを確認する。
- 自動公開の履歴: https://github.com/kosuke-saito0807/mate/actions/workflows/firebase-spark-live.yml
- GitHubで自動公開に失敗した場合は原因を調べてから再実行し、成功まで公開済みと宣言しない。
- GitHub Actionsの認証用Service Accountは必要権限だけ付与し、Secretは表示・コミットしない。定期的に鍵のローテーションと不要権限の見直しを行う。
- 元ChatGPT Sites https://naraico.kosuke-saito0807.chatgpt.site/ は**別実装で同期されない**。写真・データ・管理機能まで完全に一致させるには原本やアプリDBのエクスポートが必要。
