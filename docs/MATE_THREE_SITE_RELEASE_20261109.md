# MATE 3サイト統一・受付フォーム修正：本番反映手順 (2026-11-09)

## 反映の境界と順番

コードをGitHubに置いただけでApps ScriptのWebアプリは更新されない。PLAY独立Firebaseも専用の手動承認がない限り本番更新されない。

1. コードのレビュー／CI。公開リポジトリ [PR #96](https://github.com/kosuke-saito0807/mate/pull/96) と、MATE非公開リポジトリ [PR #36](https://github.com/kosuke-saito0807/mate-platform-private/pull/36) のチェックを確認する。失敗があればマージしない。
2. 公開リポジトリ PR #96 を main にマージ。CAREは GitHub Pages、SPARKは Firebase の各ワークフローが起動する。実際の完了と本番URLを別々に確認する。
   - https://github.com/kosuke-saito0807/mate/actions/workflows/pages.yml
   - https://github.com/kosuke-saito0807/mate/actions/workflows/firebase-spark-live.yml
   - SPARKは設定 `MATE_FIREBASE_AUTO_DEPLOY_ENABLED=true` の時のみ自動反映（設定変更は今回しない）。
3. 非公開リポジトリ PR #36 を main にマージ。PLAY側は **自動本番公開されない**。
4. PLAY本番を反映する場合は [専用手動ワークフロー](https://github.com/kosuke-saito0807/mate-platform-private/actions/workflows/play-production-release.yml) を開く。「Run workflow」→ branch `main`、`reviewed_sha` に**その時点の非公開リポジトリ main の40文字SHA**、`confirmation` に `RELEASE_MATE_PLAY_PRODUCTION` を入力。サービスアカウント／プロジェクト／本人承認の安全チェックが通る必要がある。失敗時は設定・条件を確認し、他のFirebaseプロジェクトに代替公開しない。
5. 独立した既存の受付用Apps Scriptを、**MATE専用アカウント**で更新する（詳細は次項）。
6. 運営通知専用Apps Scriptも別途最新版を貼り替える。個人Gmail宛ての相談通知は **GitHubでコード更新しただけでは停止しない**ので、優先して対応する。
7. 3つの公開サイト、申し込み・相談フォーム、申請者受付メール、事務局受信、審査未承認、公式トップへ戻るボタンを確認。

## 受付Webアプリの更新（操作必須）

- MATE運営アカウント：`kosodatemate@gmail.com`
- プロジェクト：`MATE 直接掲載受付`。既存の営業・審査・通知プロジェクトとは**別**。
- 編集するコード：https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_direct_intake.gs
- [Apps Script](https://script.google.com/home) で上記プロジェクトを選択し、同名の既存GASファイル内容を最新版に入れ替えて保存する。古いWebアプリ用 `doPost` と二重に定義しない。
- 左上 **デプロイ → デプロイを管理 → 既存のウェブアプリの右の編集（鉛筆） → バージョン：新バージョン → デプロイ**。**「新しいデプロイ」はしない**（既存のフォームから参照される /exec URL を維持するため）。
- 既存URLの例（現在の公開設定）：
  https://script.google.com/macros/s/AKfycbxpUkZ4tS5sZbZo6aan5urZF_p3eGAUPRRsZIw_H-ogz3wP3s9_vqKx5dWce_psf3iK/exec
- `MATE_TURNSTILE_SECRET`、非公開Drive画像フォルダ、既存スクリプトプロパティを変更しない／チャットで共有しない。
- GASの送信完了画面には受付番号が表示される。安全のためWebアプリ由来のPOST後は一度 `script.google.com` 上で受付結果を示す。**「MATE CARE/SPARK/PLAYのトップに戻る」ボタンを押すと** `target="_top"` でそのサービスの独自ドメインへ戻る（ユーザー操作不要の自動転送ではない）。
- 送信失敗の場合は元の独自ドメインの入力フォームに戻れるリンクを表示する。**実際の送信エラー詳細がまだ未特定の場合は、画面のエラー文だけ控える**（氏名・メール・画像・Turnstile秘密鍵は共有しない）。

## 個人Gmailへの問い合わせ通知の停止（操作必須）

1. [Apps Script](https://script.google.com/home) → `MATE_運営通知専用`（`MATE 直接掲載受付` とは別）。
2. 非公開リポジトリの最新版を既存の `mate_owner_notifications.gs` に全文貼替え保存：
   https://github.com/kosuke-saito0807/mate-platform-private/blob/main/scripts/mate_owner_notifications.gs
3. 現行トリガー `runMateOwnerNotifications` は維持。 `setupMateOwnerNotifications` は再実行・カーソル初期化をしない。
4. `inspectMateOwnerNotificationHealth` を手動実行し、`setupComplete=true`、`triggerCount=1` を確認。
5. この版では、**CARE/SPARK/PLAYの家族相談・営業返信の通知は個人Gmailへ送信しない**。家族相談の全文は直接受付Webアプリから **kosodatemate@gmail.com だけへ送信**する。営業返信もMATE専用Gmailで確認する。既存の**新規掲載申請の個人Gmail向け通知だけは継続**する。

## 本番確認（オーナー操作：自分のメールを使用）

- CARE https://care.kosodatemate.jp/contact.html
- SPARK https://spark.kosodatemate.jp/partners.html
- PLAY https://care.kosodatemate.jp/play-listing.html
- 家族向け相談 https://care.kosodatemate.jp/consult.html?service=CARE （SPARK／PLAYは query の service を変更）
- 各フォームで、申請者本人が「内部テスト・非公開」と明記して正規に1件だけ送信。事務局 Sheets `掲載セルフ申請` に `未審査` で登録されること、申請者に受付番号を含む確認メールが届くこと、MATE専用Gmailに申請通知があることを確認。ダミー事業者を承認・公開しない。
- GAS受付後の **トップに戻る** リンクがそれぞれ `https://care.kosodatemate.jp/`、`https://spark.kosodatemate.jp/`、`https://play.kosodatemate.jp/` に戻ること。
- GmailによるAPI送信成功と、実際の受信トレイ到着は別なので、受信も手動確認。
- 2026-11-09にPLAYの申請 `2611090017` は既に受付と申請者のサンキューメールを確認済み。**再デプロイ後**は少数の確認用申請のみでよい。
- PLAY本体フッターは非公開リポジトリの手動本番リリースをしない限り更新されない。

## 商用安全ルール

営業メール送信 `MATE_AUTO_SEND` は操作・有効化しない。掲載承認・公開・料金請求もこの手順では行わない。有料サービスは別途合意制。
