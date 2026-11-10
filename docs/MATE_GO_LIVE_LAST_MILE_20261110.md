# MATE 完全稼働：残工程・操作先の確定版（2026-11-10 JST）

## この時点で確定した実績
- PR #109: CARE/SPARKのカテゴリー画像・実画像を切らないCSS・V4営業改善をマージ。GitHub PagesとSPARK Firebaseの該当デプロイは成功。
- PLAY の独立非公開リポジトリ `kosuke-saito0807/mate-platform-private` PR #39: カテゴリー別画像9種とノートリミングをマージ。ソースビルドとUI/フォーム検証は成功。ただし新UIを本番PLAYへデプロイする手動ゲートは未実行。
- PR #110/#111: 画像ファイルの閲覧権限を承認済みの画像だけに付与する独立GASと、実行ログへのプレビュー出力をマージ。
- `Sync MATE SITTER public data from Google Sheets`（run 42831682049）でSPARK掲載写真5枚すべて **metadata_http_403**。承認済み／契約済み／SPARK掲載済みだが公開JSONは `images: []` のまま。同期が成功表示でも写真が公開されたとは限らない。
- 同じ同期ジョブのGoogleサービスアカウントの**SHA256先頭16文字フィンガープリント**は `e77d390ba84d37d4`（メールアドレス・鍵そのものは記録しない）。
- `営業候補_自動収集` に2026-11-10のWeb公式サイト調査による**新規8件**を追記。A174:P181、SPARK3件/PLAY5件。すべて `UNVERIFIED` + `窓口確認待ち`、メール空欄、営業拒否も `未確認`。既存172件から180件。登録を理由に自動送信しない。
- 本番のGASスクリプトプロパティ、トリガーはGitHub側から直接操作できない。営業送信ログV4は照合時点でヘッダーのみ。Gmailには別の手動送信履歴があるため重複回避コードを追加済み。
- SPARK CodeCampKIDS 大崎教室は同意・契約・公開・掲載完了メール送信済み。

## 必要操作1：SPARK登録写真を公開可能にする
プロジェクト名：**MATE 直接掲載受付**（「MATE_掲載審査・公開自動化」ではない）

1. `kosodatemate@gmail.com` で `script.google.com/home` を開き、**MATE 直接掲載受付**を選択。
2. ＋「スクリプト」で **`mate_approved_media_access_repair.gs`** を**新規追加**。既存 `コード.gs` や `doPost` は絶対に上書きしない。
3. `https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_approved_media_access_repair.gs` のコード全文を貼り付けて保存。
4. `previewMateApprovedMediaAccessV1` を実行。実行ログJSONの `readerFingerprints` の一つが **`e77d390ba84d37d4`** と一致し、`approvedApplications>=1`、`selectedFiles>=5`、`fileMembershipRejected=0` を確認。メールアドレスや秘密鍵をチャットに貼らない。
5. フィンガープリントが不一致なら**修復を実行しない**。`MATE_MEDIA_READER_EMAILS` が実際のSPARK公開同期用サービスアカウントと一致するよう設定を見直す。GASとGitHubの秘密鍵はチャットに貼らない。
6. 一致した場合のみ `repairMateApprovedMediaAccessV1` を**1回**実行。ログ `viewerGrants>=5`、`grantErrors=0` を確認。Google Driveは「制限付き」のまま。本人承認、画像審査、契約、公開一致でない画像には付与しない。
7. `https://github.com/kosuke-saito0807/mate/actions/workflows/sync-smartsheet-public.yml` の **Run workflow** で再同期。結果に `public_assets=5` を確認。GitHub `spark/schools.json` のCodeCampKIDS行の `images` が5件、SPARK実サイトのカルーセルで5件表示されるか確認。写真の権利状態が変わったら削除・公開同期の取り下げも実施する。
8. 403が続く場合、GASとCIのサービスアカウントの指紋を再照合し、`viewerGrants` の権限エラーと所属フォルダを確かめる。無条件に一般公開をONにしない。

## 必要操作2：PLAY画像の新UIを本番デプロイ
リポジトリ `https://github.com/kosuke-saito0807/mate-platform-private`。
`https://github.com/kosuke-saito0807/mate-platform-private/actions/workflows/play-production-release.yml` の **Run workflow** はGitHubユーザー `kosuke-saito0807` が手動承認する仕組み。スイッチ `PLAY_PRODUCTION_DEPLOY_ENABLED=true`、正しい独立Firebase設定が必要。
- `reviewed_sha`: `ba3b8e354c89bb4b24f11a71378731a28122efbc`（2026-11-10時点のPLAY main SHA、実行時に変わっていれば最新を再確認）
- `confirmation`: `RELEASE_MATE_PLAY_PRODUCTION`
- その後、実サイト `https://play.kosodatemate.jp/` の陶芸・料理・自然などで適切な代替画像と人物が切れない実画像表示を確認。
- この承認ゲートは新UIの任意デプロイであり、**掲載事業者の人間承認ゲートをスキップする許可ではない**。

## 必要操作3：営業V4の本人GAS設定
- 既存のGASプロジェクトで `mateAutoOpsV4Cycle` / `previewMateOutreachReadinessV4` が登録されているか最初に確認。二重トリガーを作らない。
- `https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs` の最新版を既存V4コードへ反映。直接受付GASや公開承認GASを上書きしない。
- `previewMateOutreachReadinessV4` は**読み取りだけ**。`installMateAutoOpsV4` は候補収集・監査・返信・営業を1時間ごとに処理するトリガーを登録。ただし営業送信は多重スイッチがOFFなら起こらない。
- `installMateV4DailyDigest` は **運営者自身**への9時台の集計サマリーを登録。ChatGPTにも毎朝9時台の読み取り専用営業・承認チェックを設定済み。
- 外部メールは正式な送信者名称・所在地、送信根拠、送信禁止表示、配信停止対応、過去Gmail送信済み重複、営業候補の状態をすべて確認した上で本人がスイッチを設定する。まず `MATE_OUTREACH_PHASE=PILOT`、`MATE_DAILY_CAP=1` の1件/日。その後問題なければLIVE（最大5件/日）。既存コードは `MATE_AUTO_SEND=ON`、`MATE_AUTO_SEND_LEGAL_REVIEWED=YES`、`MATE_SENDER_NAME`、`MATE_SENDER_ADDRESS` などが必須。公開された業務用アドレスへの特例を用いる場合は法令と実際の用途をレビューしてから `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES`。
- 2026-11-10の新規8件は`窓口確認待ち`のため、上記スイッチがONでも自動送信されない。相手の業務上の送信適格性を先に確認する。

## 本当に「完全稼働」と判定できる条件
1. SPARK実画像5/5がDriveから正常取り込みされ、本番で確認できる。
2. PLAY独立本番リリースが成功し、新画像が本番で確認できる。
3. MATE営業V4の本番GAS反映とトリガーが確認でき、送信根拠が明確な1件でPILOT運用を検証できる。
4. 3サービスの正規の実事業者で、申請→運営承認→公開→掲載完了メールまで実施・証拠を照合できる。
5. 営業停止と重複送信防止、画像掲載権限取り消し時の削除処理まで検証できる。

**その他：** 現状の自動化は作業・承認者を代替しない。未承認掲載／同意なし営業／課金・請求／未承認画像の公開をしない。
