# MATE 3サービス自動化：本番導入・検証手順（2026-11-10）

## 証拠と現状
- CARE / SPARK / PLAYの掲載申請受付・運営通知・本人受付メールは、専用Gmailの2026-11-09の実メールで確認。
- 申請受付番号2611100020（SPARK）は「掲載セルフ申請」承認、担当者権限確認済み、公開ID mate_spark_48444d9917e44fd9、対応する有効な無料契約あり。GitHubの spark/schools.json に実在教室データあり。
- 「掲載公開承認V1_運営専用」では上記SPARK申請の進捗が「公開待ち」、URL空欄、完了通知「未送信」。本番JSONと公開ドメインの直接突合が済むまで送信済みとみなさない。
- CARE/PLAYには同じ水準の公開・契約済み実在申請がまだ無い。テスト申請を承認して確認することは禁止。
- 営業送信ログV4はヘッダーのみ。専用Gmailからの3件の外部宛て営業実送信履歴と、毎時の自動営業の稼働は別。送信可否の法的判断・GAS Script Properties実値は未確認。

## 1. 掲載完了メール・公開台帳照合のGAS導入（ユーザーが運営アカウントで1回）
1. kosodatemate@gmail.com で https://script.google.com/home を開き、MATE営業管理DBに接続した**運用用**既存GASを開く。直接受付用 `doPost` プロジェクトには入れない。現在のプロジェクトをバックアップ・バージョン保存する。
2. https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_publication_completion_mail.gs の現行コードを、**同名の新しい .gs ファイル**として追加（既存の `doPost`、営業V4、審査ロジックを上書きしない）。Googleの許可画面で必要なSheets/URL Fetch/MailApp/Trigger権限を本人が確認する。
3. `previewMatePublicationReconciliation` を手動実行（公開先JSONの読み取り、シート・メール変更なし）。SPARK承認済み1件について `live` の集計を確認する。0の場合は本番URL、データ同期、有効契約・権限・規約の項目を修正し、むやみに承認・送信しない。
4. `reconcileMatePublicationReconciliation` を一度だけ手動実行し、実際の公開JSONと承認台帳の一致する行だけ `公開確認済` と正規公開URLが記録されたことを確認。これは掲載作成やメール送信を行わない。
5. `previewMatePublicationMail` を手動実行して `eligible` と `verified` を確認。デフォルトでは `MATE_PUBLICATION_MAIL_ENABLED` を設定しないため、外部へ一通も送られない。
6. `installMatePublicationAutomation` を一度実行。毎時の `matePublicationCycle` トリガーが1件のみ存在することを確認。自動照合は開始されるが送信OFFのまま。
7. **実在掲載への本人承認と公開証拠、正しい送信先、送信文面・メール権限が確認できた後**、スクリプト プロパティ `MATE_PUBLICATION_MAIL_ENABLED=ON` を設定すると、毎時の掲載確認後に完了メールを送る。重複送信防止のため、送信結果が曖昧なら自動再送しない。成功はMailAppへの引き渡しを意味し、受信箱到着は別途確認。
8. 必ず実際の受信者のメールで1件を照合し、「掲載公開承認V1_運営専用」の通知証跡とGmail送信済みを確認。CAREとPLAYについては実在の適切な申請が来るまで実地公開E2Eを「未実施」とする。

## 2. 3サービスの自動公開
- CARE/SPARK: 現在の承認済みデータ同期ワークフロー `sync-smartsheet-public.yml` は30分ごと。本番デプロイのCIと同期の成功を別々に確認する。
- PLAY: `mate-platform-private` の `play-approved-live-data-sync.yml` は3時間ごと、`PLAY_APPROVED_DATA_AUTO_DEPLOY_ENABLED=true` と本番UI一致条件が必要。成功ジョブだけでデータ変化・公開を保証しない。
- CARE/SPARKのリンクは `/#listing-{publicId}`。PLAYの個別詳細直リンクは検証できていないため、公開の本人通知ではPLAYトップページを使用。
- 全サービスの公開データ一致チェックは `mate_publication_completion_mail.gs` が公式JSONをHTTPS 200・非リダイレクト・IDと名称完全一致で判断する。未承認や掲載非同意のダミー申請は対象外。

## 3. 営業メールの本番送信を開始する前
- 毎時営業処理と送信は別。候補収集・重複チェック・拒否配信停止・確認済みの業務窓口・事業主体/正確な住所と配信停止先・日本の特定電子メール法上の許容根拠を確認。
- 特定電子メール法上はオプトイン原則。自ら公開する事業用メールアドレスの例外も、広告宣伝メール拒否の表示がある場合には利用できない。公式サイトメールを見つけただけで機械的に送信しない。
- `previewMateOutreachReadinessV4` を運営アカウントで実行し、実際のスクリプトプロパティ `MATE_AUTO_SEND`, `MATE_OUTREACH_PHASE`, 日次上限、法的確認フラグを確認。条件が満たされない限りONにしない。まず限られた正当な相手へ小規模に開始し、送信済みと配信停止ログを照合する。
- 営業自動送信ONと掲載完了メールONは独立。相互のスイッチ・トリガー・台帳を混在させない。

## 4. 完了判定
- CARE/SPARK/PLAYそれぞれで、実在の申請→事務局通知→申請本人への受付返信→審査と権限証拠→無料契約→承認済みデータ同期→公式サイト実表示→台帳公開確認→本人への完了メール到達を一続きで確認する。
- テスト公開、無断メール、無断課金を禁止。外部送信ログ・受信ログ・正式許諾・公開URLと時刻が一致した時点のみ「本番E2E成功」と報告する。
