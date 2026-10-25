# MATE 掲載承認から公開までの運用確認（2026-10-25）

対象: CARE / SPARK / PLAY。申請受付自体は3サービスでGAS実送信・Sheets保存記録あり。本書は**公開機能が完成したという宣言ではない**。

## データと安全性
- 管理台帳: [MATE営業管理DB](https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit)
- 「掲載セルフ申請」2〜4行の運営QA（CARE, PLAY, SPARK）は**差戻し維持**。公開IDを入力しない。外部公開と連絡・送客禁止。
- 「掲載申請連絡先」は非公開情報。サイトJSON / GitHub / ログに氏名、メール、電話番号を出さない。
- まず実在の申請者に掲載許諾と内容確認を取り、テストデータと区別する。

## CARE
1. 「掲載セルフ申請」で実在申請のみ審査。Y列「審査状態」=承認、Z列「担当者権限の確認」=確認済み、AA列「審査者」=実担当者、V列に掲載意思、U列に情報確認日、X列に受付証跡が必要。
2. `scripts/mate_self_service.gs` の `publishReviewedMateApplications()` は条件を満たすCARE行を「営業管理DB」へ転記し、申請状態を「公開待ち」、AB列に公開IDを設定する。これだけでは公開URL反映は保証されない。
3. `scripts/sync_google_sheets_public.py` とGitHubのGoogle Sheets同期ワークフローで公開データを生成し、`.github/workflows/pages.yml` でGitHub Pagesを配信。公開許諾・公開日・公開JSONを検査する。
4. Apps Script側の実行権限・トリガー設定、GitHub Actions認証情報・最終実行結果を所有者画面で検証する。

## SPARK
1. CAREと同じ承認条件。ただし `publishReviewedMateApplications()` は「SPARK営業候補」に転記して「掲載契約」へ**未契約**の草案を作り、申請状態を「契約確認待ち」にする。
2. 掲載担当者本人と条件・日時・証跡を確定して初めて「掲載契約」を有効化。`scripts/sync_spark_public.py` は契約が「有効」または「掲載中」、掲載許諾済み、その他必須情報が揃ったデータだけ公開用に出す。
3. `spark/schools.json` の生成・GitHub更新、`.github/workflows/firebase-spark-live.yml` のデプロイを確認。Firebaseの自動デプロイはリポジトリ変数 `MATE_FIREBASE_AUTO_DEPLOY_ENABLED` と秘密値 `FIREBASE_SERVICE_ACCOUNT_MATE_SPARK` に依存。現在の設定状態はソースから判断できない。
4. 体験受付の許諾は掲載許諾とは別であり、許諾が無ければ取次・通知しない。

## PLAY
- `publishReviewedMateApplications()` はPLAYを**明示的に対象外**としている。PLAY申請の承認だけで本番CMSに公開されると説明しない。
- 元編集プロジェクト・CMS・掲載データの正規ソースと公開先を確定してから専用の承認→公開インターフェースを設計する。原本未検証のままFirebaseやGitHub PagesでPLAYを置き換えない。

## 受入試験（実在の掲載許諾済みデータを使用）
- [ ] 申請フォームで受付番号が発行され、2つの非公開シートに同じIDが存在
- [ ] 申請の担当権限と公開許諾、紹介文・画像・公式URLを人が確認
- [ ] 承認処理でCARE/SPARKの台帳に必要な行が一度だけ作成
- [ ] SPARK契約条件が整うまで公開されない
- [ ] 公開データに担当者名・個人メール・電話などが混入しない
- [ ] CARE公開URL、SPARK Firebaseで実際に掲載が見える
- [ ] PLAYはCMS担当者が承認・公開を確認（現在自動化未完成）
- [ ] 異常時は新規掲載を止め、既存のサイトとSheets記録を維持して戻す

## 作業上の注意
`installMateSelfServiceTriggers()` はトリガーを削除して作り直すため、既存GASの配備場所と既存トリガーを確認せずに実行しない。まず所有者が Apps Script の「トリガー」とGitHub Actionsの最新履歴を見る。営業メールの自動送信はここでは行わない。
