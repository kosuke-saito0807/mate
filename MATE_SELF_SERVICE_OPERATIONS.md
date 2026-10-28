# MATE｜掲載希望者のセルフ登録・低工数運営（2026-10-23）

> **2026-10-28 運用更新（現行版を優先）**：CARE・SPARK・PLAYの事業者掲載申請は直接Google Apps Scriptで受付し、FormSubmitの認証・メール取込は不要です。CARE・PLAYの家族向け相談もGAS＋専用Gmail＋非公開Sheetsへ移行済み。SPARKの一括体験相談は未提供です。過去のFormSubmit設置、Gmailインポート、旧Apps Script追加手順は**実行しないでください**。現状・未完了は [3サービス運用状況](docs/MATE_3_SERVICES_READINESS_20261028.md) を参照。既存の「MATE 直接掲載受付」プロジェクトのCode.gsに別のdoPostを追加しないでください。


## 各サービスの登録URL
- CARE: https://kosuke-saito0807.github.io/mate/contact.html
- SPARK: https://mate-spark.web.app/partners.html
- PLAYセルフ登録（共通システムで稼働）: https://kosuke-saito0807.github.io/mate/play-listing.html
- PLAY本体: https://mate-play.kosuke-saito0807.chatgpt.site/ （別CMS、公開側の掲載操作のみ要連携）

営業メール文面は「3サービス営業リスト」の未接触・下書き未承認のCARE69件・SPARK58件・PLAY46件の未接触候補に、各サービスのセルフ登録リンクを追記済み。**送信はしていない**。対象先の営業可否・拒否意思、勤務先規定と育休中の稼働条件は実際の送信前に確認する。

## 掲載希望者が行うこと
会員登録不要で、公式URL、事業者名、都道府県、市区町村、区分、紹介文、料金等を自身で入力する。営業担当者名・メールは運営確認用にのみ使用し公開しない。
「掲載への同意」は必須、「体験相談の取次ぎ」は任意・別チェック。取次希望のチェックだけで自動送客や保護者情報提供を開始しない。
FormSubmitを通じて専用Gmailへ連絡が届く。事業者がフォームを送信しても、公開は審査後。

## 事務局の作業を最小化する流れ（インストールまでは手動）
1. 専用Gmail `kosodatemate@gmail.com` で Apps Script を開く（https://script.google.com/）。
2. 既存の問い合わせ管理スクリプトと同じプロジェクトに、新しいファイル `mate_self_service.gs` を追加する。GitHubの `scripts/mate_self_service.gs` をそのままコピー。既存のMATE営業V3コードや他用途のスクリプトは上書きしない。
3. 申請の受け皿：同じCRMの「掲載セルフ申請」タブ。専用アカウントにこのシートの編集権限を設定。
4. `syncMateSelfServiceApplications` を最初に一度手動実行・権限承認し、テストメールの取り込みを確認。メール内の `listing_payload_b64` に `MATE_LISTING_V1__` で始まるデータが含まれていること。実メールがFormSubmitから届かない場合はFormSubmit側の受信先承認を先に行う。**この実送受信テストは未実施**。
5. `installMateSelfServiceTriggers` を手動実行する。成功した場合、毎時Gmailから申請内容を取り込み、承認済み原稿を営業DBへ反映する。Googleログインと認可なしには動作しない。Apps Scriptでトリガー登録を確認。
6. 申請内容を原文と照合。公式サイト等で担当者が教室・事業者の掲載権限を持つことを検証。疑わしい場合は差戻し。
7. 権限・内容が確実に確認できた場合のみ「掲載セルフ申請」の **Z列 担当者権限の確認＝確認済み、AA列 審査者＝担当者名、Y列 審査状態＝承認** をセット。申請者の氏名やメール、子どもの個人情報を公開データに貼り付けない。
8. CAREは承認後に「営業管理DB」の掲載許諾と公開原稿へ自動追加し、既存のGitHub Actions同期から公開される。SPARKは「SPARK営業候補」への転記と、「掲載契約」の未契約下書きまで自動。**SPARKの掲載は、正式な同意者・日付・期間・証拠を確認した有効な契約に更新しない限り公開されない。** これは本人なりすましや無断公開防止に必要。
9. PLAYは独立のChatGPT Sites CMS。共通の自動申請受付はこのPLAY登録URLから利用可能。ただし**PLAYの自動公開は未対応**。審査後に元CMSへ掲載する必要がある。

## 専用Gmail自動取り込みでしていないこと
- 営業メールの送信/追客、公開承認、申込者の代理署名、保護者個人情報の営業シート保存
- 届いたメールだけでの権限・送信元・許諾の真偽確認
- PLAYの独立CMSへの直接の編集・公開
- FormSubmit / Google / GA4 のユーザー側ログイン・認証

## 子育て世帯のUXと個人情報方針
- CARE/SPARK：検索、絞り込み、教室比較、公式リンク閲覧は**会員登録不要、氏名・メール入力不要**。
- SPARK：お気に入りは端末localStorage保存でクラウドユーザープロフィールを作らない。
- 実在・許諾済み教室の体験相談が開始できる場合のみメールアドレス（返信用）と同意を必須にする。氏名・電話番号・子どもの学年は任意。お子さまの氏名、学校名、健康情報等は入力を求めない。
- 事業者セルフ申請で求める担当者の氏名とメールは審査連絡用。Gmail原文側に保管し、公開JSONには含めない。
- GASが「掲載セルフ申請」に書くのは公開原稿相当のビジネス情報とGmailメッセージID・審査ステータスのみ。
- ユーザーが送信しない限り、FormSubmitに問い合わせ情報は送られない。
- GA4の計測値はアクセス情報。フォームの個人情報・相談本文をイベントに送らない。Cookie/解析の表示は各サービスのプライバシーポリシーで説明。

## PLAYの編集画面へ貼り付ける指示
既存サイトのデザイン/データを保持して、CARE・SPARK同様「掲載希望者のセルフ登録」を実装してください。
- `company,website,name,email,region,city,category,ages,description,listing_content_checked_at,listing_permission,trial_referral_consent` の共通項目を設ける。
- 公開したい施設・体験の日程、料金（税込）、対象年齢、住所、企画説明、公式URLを事業者自身で入力する。画像等の権利許諾は別確認。
- FormSubmit宛先を kosodatemate@gmail.com に統一し、必ずメール題名に `MATE PLAY` を入れる。
- 非個人情報だけの構造化JSONを `MATE_LISTING_V1__` + UTF-8 base64で hidden の `listing_payload_b64` に入力して送信する。CARE/SPARKの `assets/mate-self-service.js` の形式に合わせる。個人情報をこのJSONに含めない。
- 申請内容は未審査で受け付け、正式な掲載許諾・権限確認と掲載内容チェック後にのみ公開。親子体験の申込みは保護者の同意と相手先の受託許諾後に紹介。事務局の手入力を要しないように登録原稿をそのまま審査待ちにする。
- 保護者は検索・お気に入り利用に会員登録・氏名・メール入力不要。体験予約や正式な取次のときだけ返信用メールアドレスと必要な同意を要求。氏名・電話番号・学年は任意に。子どもの氏名・学校名・健康情報等は原則収集しない。
- NextEdu、代表者紹介、kosodatemate@gmail.com、利用規約、掲載条件、プライバシーポリシー、GA4（G-NG57XX4Y5D）をCARE/SPARKと統一。
- PC/スマホで新規登録→事務局向け申請記録→公開許諾前の非公開維持、検索0件、同意チェックをテストし、元データを削除せず公開前にプレビュー提示。


## 家庭向けCARE/PLAYの個人情報・相談UX（2026-10-23追記）
- CARE相談：https://kosuke-saito0807.github.io/mate/consult.html?service=CARE
- PLAY相談：https://kosuke-saito0807.github.io/mate/consult.html?service=PLAY
- 共通プライバシー：https://kosuke-saito0807.github.io/mate/consult-privacy.html
- いずれも検索時の会員登録不要。相談時は返信用メールアドレスとプライバシー同意のみ必須。名前・電話番号・希望エリア・相談内容は任意。
- 体験・利用予約の確定フォームではない。事務局への相談フォームで、情報の事業者への自動転送は行わない。事業者への個人情報提供が必要なら掲載先と内容を明示し、利用者本人から別途同意を得る。
- PLAY本体のChatGPT Sites編集はGitHub管理外。本体の「相談する」導線から上のPLAY相談URLへ誘導するよう、Sitesエディタで手動設定する必要がある。

## 1件テストの実行結果と本番受信テスト
- Google Sheetsの「掲載登録_E2E検証」タブに、架空のSPARK 1件を対象としたCI検証結果を記録。これは本番申請タブや実在公開データへの書き込みではない。
- GitHubテスト tests/test_mate_selfservice_e2e.cjs は **実際のApps Scriptソース**を偽Gmail・偽スプレッドシートで実行する。受付、重複防止、未審査での停止、審査状態/担当者権限/審査者の3条件、SPARK未契約、CARE承認済み反映、PLAY非公開を検証。実メール送信なし・本番公開なし。
- 実Google Gmailでの受信→台帳取り込みテストはまだ完了していない。専用Gmail「kosodatemate@gmail.com」で Apps Script の権限承認、FormSubmitの宛先認証が必要。

### 専用Gmailの所有者が確認する1件（サイト掲載は禁止）
1. 専用Gmailへログインし、コード scripts/mate_self_service.gs を既存プロジェクトに新ファイルとして追加。**既存の問い合わせ記録コードや営業V3コードを消さない**。
2. スプレッドシートの「掲載セルフ申請」を編集可能にし、syncMateSelfServiceApplications を実行してGmailとSheetsの権限を承認。
3. SPARK掲載フォーム（https://mate-spark.web.app/partners.html）から、自分が権限を持つ運営体の「【非公開テスト】NextEdu 自社内部確認」の名称で、正式な公式URL、実連絡用メール、架空公開禁止がわかる紹介文を送信する。無関係な他社名・個人名を使わず、体験取次希望にはチェックしない。
4. 専用Gmailに件名「MATE SPARK」を含む受付メールが実際に届くか確認。届かなければFormSubmitの宛先認証を完了する。
5. syncMateSelfServiceApplications を再実行し、「掲載セルフ申請」に受付1行が「未審査」で入るか確認。GmailメッセージIDがGmailの実メールと一致し、担当者のメールアドレスが公開原稿に含まれないかを確認。
6. **この自社テストレコードは「承認」にしない。** Y列を「差戻し」、AC列に「自社内部テスト・公開禁止」と記入する。架空の事業者として公開しない。
7. 実在事業者からの初回申請については、メール証跡と権限・公開原稿を確認したうえで、Y列「承認」、Z列「確認済み」、AA列「実際の審査者名」を設定する。CAREは公開DBへの反映を待つ。SPARKは別途有効な「掲載契約」と同意証拠を整備してから公開。
8. 初回の正常動作を確認してから installMateSelfServiceTriggers を実行し、Apps Scriptの画面で毎時のトリガー設定を確認する。

**重要**：テストメールの実送信と専用Gmailの権限承認はユーザーが所有アカウントで実施する。ChatGPTの接続済みGmailは別アカウントなので、この手順を実行したと装わない。
