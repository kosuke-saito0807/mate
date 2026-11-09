# MATE SEO・掲載事業者募集・営業開始前チェック（2026-11-09）

この文書は作業記録・確認手順です。営業スイッチは変更しない。**送信・申請・承認・公開・課金しない。**

## 1. 確認できた現況
- MATEの公式サービス：CARE https://care.kosodatemate.jp/ / SPARK https://spark.kosodatemate.jp/ / PLAY https://play.kosodatemate.jp/
- 掲載申請の正規窓口：
  - CARE https://care.kosodatemate.jp/contact.html
  - SPARK https://spark.kosodatemate.jp/partners.html
  - PLAY https://care.kosodatemate.jp/play-listing.html （PLAY本体とは別の運用フォーム）
- 2026-11-09のSheets読み取り：既存営業CRM174行、営業候補_自動収集49行。「営業可能候補」5、「窓口確認待ち」39、「公式公開メール確認済・送信待機」5。**状態は送信の法的適格性を保証しない**。
- 送信ログV4は見出しのみ、配信停止V1は見出しのみ。すでに送ったこと・解除依頼がないことをすべてのチャネルについて保証するものではない。
- MATE専用Gmailには外部送信用のCARE/SPARK/PLAYの各1通ずつ、計3件の未送信下書きがある。自動生成の運営者宛て内部確認下書きもあるので混同しない。
- CARE/SPARKの公開JSONの掲載数は現時点0。実在事業者の許諾と審査と契約成立前に公開しない。

## 2. SEOと無料掲載の導線
- 検索結果0件でも家族が離脱せずに有用なガイドを読めるよう、CAREの空検索結果から「初めてのベビーシッターの選び方」へ、SPARKの空検索結果から「子どもの習い事の選び方」へリンク。各サイトの**事業者無料掲載申請**リンクもわかりやすい文言にした。
- CAREのGitHub Pagesへの反映はページ公開ワークフローで確認する。SPARKはFirebase本番リリースが別で、`.github/workflows/firebase-spark-live.yml` は `MATE_FIREBASE_AUTO_DEPLOY_ENABLED=true` の場合のみ自動デプロイ。GitHubマージだけではSPARK本番更新を保証しない。
- 3サイトの robots.txt / sitemap.xml / title / description / canonical は読み取り専用の監視を継続。Search Consoleの実インデックス登録・クリックはコンソールで別途確認。
- サイトマップが受理されても検索順位や登録は保証されない。実在しないエリア別掲載や架空事業者のSEOページは作らない。

## 3. 掲載事業者数を増やすための運用
1. 「MATE_初回営業10件」と「営業候補_自動収集」を、名前ではなく正規の**公式窓口・連絡拒否表示・同意／例外の根拠・確認日**で個別審査する。
2. 1件につき **初回接触 → 返答 → 本人無料掲載申請 → 運営の権限確認 → 無料契約の成立 → 公開 → 公開URL報告** の状態で管理し、申請だけでは掲載しない。
3. 不明・拒否・個人メール・取得不能な窓口は送信候補から除外。公式サイトへの問い合わせフォームを機械的に送信しない。
4. 「営業候補」は掲載事業者数として数えず、公開許諾済みの実在事業者だけを掲載件数とする。
5. 営業開始後は週次で送信件数・返信数・無料掲載申請・承認・実際に公開済み件数を別集計する（クリック＝紹介／成約ではない）。

参照管理台帳：
https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit

## 4. すぐ営業ONにする前の技術的な事前検査（送信なし）

1. `kosodatemate@gmail.com` で https://script.google.com/home を開き、**MATE営業自動化**プロジェクトを選択。
2. `scripts/mate_auto_ops_v4.gs` の最新版を既存のV4コードに反映する。別ファイルに重複貼り付けしない。他の受付・審査関数は変更しない。
3. スクリプト関数 `previewMateOutreachReadinessV4` を手動実行（**読み取りのみ・メール送信なし**）。
4. 以下を確認：
   - `mode=READ_ONLY_NO_SEND`
   - `automationSwitch=OFF`（ユーザーが営業開始を明示するまでは維持）
   - `senderNameSet=true` / `senderAddressSet=true` は入力長の**構文確認だけ**。事業主体・法的な表示の正しさは別途人が確認する。
   - `phase` は現在値が表示される。OFFであれば自動送信しない。
   - `legalReviewFlag` / `publicBusinessEmailExceptionReviewed` は設定の有無であり適法性保証ではない。
   - `eligibleByScriptChecks` はプログラムの候補条件を通る件数。**実送信許可件数や法的な送信可能件数ではない**。
5. Gmailの3件の外部宛て下書きだけを個別に見直す。送信先の会社・メール用途・拒否の表示・差出人情報・停止手段を実際に確認する。内部確認用ドラフトを誤送信しない。
6. 実申請のフォーム、受付番号、返信メール、審査未承認の状態と、CARE/SPARK/PLAYの本番表示をユーザー自身が確認する。
7. 上記確認後、ユーザーが営業開始を**改めて明示的に指示**したときのみ、初回は小規模の手動送信で開始する。自動送信に切り替えるときは `MATE_AUTO_SEND` と `MATE_OUTREACH_PHASE` 等の複数設定が関与するため、必ずその時点の現在値と送信根拠・日次上限を再確認する。

**変更しない値：** `MATE_AUTO_SEND=OFF`（現行運用方針。接続先のスクリプトプロパティ実値はこの文書作成時には直接確認できない）。
**行わない操作：** 外部営業送信、実在会社への自動連絡、公開の未承認変更、請求、課金。

## 5. 営業開始後も残る改善
- Search Console https://search.google.com/search-console でCARE/SPARK/PLAYのページ別の索引状況、検索表示回数、検索クエリを確認する。
- GA4 https://analytics.google.com/ で3サービス別のページ閲覧と掲載導線のイベントを確認。フォーム送信試行と受付成功を混同しない。
- 画像・モバイル表示などの回帰テストが成功してから追加の導線改善を小さく継続する。
