# MATE共通：公開前の運営・問い合わせ管理・PLAY修正 (2026-10-23)

運営 NextEdu / 窓口 kosodatemate@gmail.com
CARE https://kosuke-saito0807.github.io/mate/
SPARK https://mate-spark.web.app/
PLAY https://mate-play.kosuke-saito0807.chatgpt.site/
営業CRM https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit

## 掲載と送客のルール
事業者の掲載意思と、保護者情報を取次先へ提供するための許諾は別々に確認する。フォームの任意の「相談希望」は送客開始の許可ではない。掲載契約・掲載内容確認と保護者の第三者提供同意が揃うまで、公開・紹介を自動で実行しない。
SPARKの通常ページは実在教室のみ。0件なら掲載準備中。架空12教室の体験は ?demo=1#discover からのみ、実申込不可。

## CARE・SPARK共通の掲載申込
サービス識別 service=CARE または SPARK、会社・教室名 company、公式URL website、担当者 name、メール email、内容確認日 listing_content_checked_at を収集。
掲載申込の意向 listing_permission は必須、体験取次相談 trial_referral_consent は任意。実際の取次開始には別途契約確認を行う。個人情報の取扱いと外部送信を案内する。

## 問い合わせ管理タブ（私的なGoogle Sheets）
シート『問い合わせ管理』：受付ID、受付日時、サービス、問い合わせ種別、事業者ID・名、GmailメッセージID、希望教室ID、進捗、掲載許諾確認、体験取次許諾確認、保護者同意、次回対応日、取次日時、結果確認日、結果、担当者、メモ。
進捗は 受付→確認→教室へ取次→結果確認→完了。許諾不備なら対応不可。依頼者の個人名・メールアドレス・電話・子どもの情報・問い合わせ全文をこの営業シートに転記しない。原文はメールで管理する。
『3サービス営業リスト』W掲載内容確認日、X体験・取次許諾、Y最終問い合わせIDを利用。Xの『相談希望』は正式許諾ではない。
現時点の登録は手動。FormSubmitの転送先メールボックスはこの接続から確認できず、受信メール→シートへの自動入力は未稼働。実運用時は当該Gmailへのアクセス権と利用者の個人情報取り扱いを設定してから自動化する。

### 自動受付ログの有効化（所有者の任意操作／未実行）
1. kosodatemate@gmail.com のアカウントで https://script.google.com/ にログインする。
2. 新しいGoogle Apps Scriptプロジェクトを作り、このリポジトリの scripts/mate_inquiry_intake.gs の内容を貼り付ける。
3. シート『問い合わせ管理』に当該アカウントの編集権限があることを確認する。
4. recordMATEInquiries を手動で一度実行し、GmailとSheetsのアクセスを承認。送信済み・テストの過去メールが登録されないか確認する。
5. 自動実行する場合はApps Scriptのトリガーで recordMATEInquiries の時間主導型・15分ごと等を設定する。
6. 最初の登録結果・重複除外・対象のメール件名を人が確認する。記録は受付の仮登録であり、送客や公開の許諾ではない。
**注意**：当該アカウントの権限承認なしには動作しない。MATE以外のメールの本文や送信元の個人情報は台帳に保存しない。

## GA4
CAREで従来使用しているID G-NG57XX4Y5D をCAREとSPARKで共用。公開サイトのドメインと、イベントのservice項目で区別する。
CARE: provider_outbound、成功応答時だけgenerate_lead。
SPARK: school_detail_view、school_outbound_click、school_compare（実在教室のみ）、listing_inquiry_submit_attempt、trial_inquiry_submit_attempt（両者は送信試行、受付確定ではない）。
送信するイベントに氏名、メールアドレス、電話番号、保護者の本文などを含めない。デプロイ成功だけで計測を保証せず、GA4のリアルタイム画面で受信を検証する。

## PLAY：ChatGPT Sites編集画面への指示文
既存のMATE PLAYの画像、体験、日程、公開状況、管理データを保持して次を実装してください。
1. 掲載相談フォームをCARE・SPARKと統一し、service=PLAY / company / website / name / email / listing_content_checked_at / listing_permission（掲載相談の意向）/ trial_referral_consent（任意の取次相談）を実装する。掲載許諾と保護者の体験取次許諾は別に確認し、承諾まで取次を停止する。
2. NextEdu、kosodatemate@gmail.com、利用規約、プライバシーポリシー、掲載条件、運営者情報、問い合わせ導線を統一する。
3. 47都道府県の検索を維持し、実際の掲載がない都道府県は0件のまま表示する。架空の体験は実在の掲載と混在させない。
4. GA4測定ID G-NG57XX4Y5D のpage_view、play_detail_view、play_outbound_click、listing_inquiry_submit_attempt に service=PLAY を付与し、氏名・メールなど個人情報を送信しない。Google Analytics利用をプライバシーポリシーに記載する。
5. フォーム着信確認前に送信成功と断定しない。保護者情報の第三者への自動転送を行わない。
6. PC/スマホ・検索・フォームの非送信テストを行い、既存データが残ることを確認してからプレビューを提示する。確認前は公開しない。

## 育休中の運用
事業としての開発、営業、契約、問い合わせなど実際の活動は、無報酬であっても稼働日・時間を記録し、勤務先の規定と給付要件をハローワーク・人事に確認する。育児休業等給付コールセンター：0570-200-406。