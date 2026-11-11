# MATE営業V4 本番移行・自動審査ガイド（2026-11-11）

## 2026-11-11追記：個人事業主の正式氏名を表示する方式で開始準備
- オーナーは正式氏名を営業メールで表示することに同意した。**Gmail差出人表示はMATE運営事務局を維持**。本文末尾の送信責任主体にはGAS Script Propertiesに入力した個人事業主の正式氏名を使う。
- GitHubには個人氏名を直書きしない。正しい正式氏名は専用Apps Script **MATE_営業自動化V4** の「プロジェクトの設定→スクリプトプロパティ」にのみ登録する。
- [最新版コード](https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs) で既存 `コード.gs` を全文置換。関数 `prepareMatePersonalNameV4` を**1回実行**すると `MATE_AUTO_SEND=OFF`, `MATE_LEGAL_IDENTITY_MODE=PERSONAL_NAME`, `MATE_SENDER_NAME=MATE運営事務局` にする。以前の `BALANCED_15` / `MATE_DAILY_CAP=15` 設定は維持。ここでは送信しない。
- `MATE_FORMAL_SENDER_NAME` に自分の正式な氏名（全姓名）、`MATE_FORMAL_SENDER_VERIFIED=YES` を設定（本人の名と同一であることを確認したときのみ）。`MATE_LEGAL_IDENTITY_MODE=PERSONAL_NAME` を保持。
- `MATE_SENDER_ADDRESS` に実際に正しい住所を登録。公開の `operator.html` に正式所在地と問い合わせ先が表示されていることを確認して `MATE_LEGAL_ADDRESS_PAGE_VERIFIED=YES`。住所は公開されるので自身で確認する。
- 特定電子メール法の送信者表示、公開業務用メールの例外、配信停止手段を確認し、実際に適合する場合のみ `MATE_AUTO_SEND_LEGAL_REVIEWED=YES`, `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES`。
- `checkMateAutoOpsV4` を実行し、`legalIdentityMode=PERSONAL_NAME`, `registeredSenderIdentityReady=true`, `formalSenderVerified=true`, `senderAddressSet=true`, `legalAddressPageVerified=true` を確認。 `phase=BALANCED_15`、`dailyCap=15`、`dailyPerServiceCap=5`、日付・トリガー各1件を確認。
- さらに `eligibleByScriptChecks` の CARE・SPARK・PLAY 各5件を確認し、二重送信・配信停止や送信者情報の誤りがないかチェック。条件を満たすときに限り最後に `MATE_AUTO_SEND=ON`。テストの成功は実際のGAS設定完了を意味しない。
- 本体のソースやGitHub Actionsに氏名・非公開プロパティを保存しない。現状のApps Script本番プロパティはChatGPTから直接照会・更新できない。


## 個人名を営業メールに表示しない運用（2026-11-11追記）
- **NextEdu が現在ただの個人事業の屋号なら、これを正式な氏名・名称として営業送信する設定はできない。** 消費者庁の特定電子メール法ガイドラインでは、サービス名・「○○運営事務局」・屋号だけでは表示義務を満たさない。https://www.caa.go.jp/policies/policy/consumer_transaction/specifed_email/pdf/110831kouhyou_2.pdf
- 現実的な候補は (a) 個人事業者として「NextEdu」の**商号登記を行う** (b) 法人を設立して実際の法人名を正式な送信主体にする、の2経路。「商業登記された商号」は消費者庁の**特定商取引法**に関する公式Q&Aで、個人事業者の氏名の代替として案内されている。ただし**これは特定電子メール法での個々の広告メールにも自動的に十分と確定した意味ではない**。送信する前に法務局/法律専門家/消費者庁等の専門窓口で該当ルートの適用を確認すること。https://www.no-trouble.caa.go.jp/qa/advertising.html
- 商号登記も、氏名と商号の関係を法務局の公開記録から一切たどれなくする仕組みではない。**メール・MATEサイトに個人名を表示しない**ことと、行政・登記情報を含め一切外部に出ないことは別の要件。
- 登記前にGASのスクリプトプロパティへ `MATE_LEGAL_IDENTITY_MODE=REGISTERED_TRADE_NAME` や `MATE_TRADE_NAME_REGISTRATION_VERIFIED=YES` を虚偽設定しないこと。
- 正式に「NextEdu」が商業登記され、用途に応じた表示適法性が確認できた後に、以下の値を設定：
  `MATE_LEGAL_IDENTITY_MODE=REGISTERED_TRADE_NAME`、
  `MATE_FORMAL_SENDER_NAME=NextEdu`（登記事項に記載された商号が正確に一致する場合のみ）、
  `MATE_TRADE_NAME_REGISTRATION_VERIFIED=YES`、
  `MATE_FORMAL_SENDER_VERIFIED=YES`。
- 法人設立ルートなら `MATE_LEGAL_IDENTITY_MODE=REGISTERED_COMPANY`、`MATE_FORMAL_SENDER_NAME` は実在する法人の登記名、`MATE_COMPANY_REGISTRATION_VERIFIED=YES`、`MATE_FORMAL_SENDER_VERIFIED=YES`。法人の商号を「NextEdu」と同一視することはできない。
- いずれもブランド表示 `MATE運営事務局` は Gmail差出人表示として維持。法律上必要な正式名称はメール本文に付記する。住所、広告メールの送信根拠、受信拒否の適切な案内も必要。
- 全て整うまで `MATE_AUTO_SEND=OFF`。現状の台帳には営業の送信ログは0件。GitHubで実装済みでも、GASへの更新と登記・法令確認・送信設定はオーナーによる実作業が必要。


## 何ができるか
- CARE・SPARK・PLAY合計15通／日、**各サービス5通**を上限にする `BALANCED_15`。
- 公式HTTPSサイトで**一般業務用メール**が実際に公開されていることを確認して、既存の同意不要の法定例外の適用対象となり得る候補を**人手を挟まず技術的に審査**。公式メールの所在確認、営業拒否表示、重複、配信停止、根拠の鮮度14日を判定する。
- 結果が曖昧な場合は保留、営業拒否表示を検出すれば **配信禁止**。返信で配信停止が届いた場合も配信停止台帳に取り込む。**法的適格性の完全自動保証ではない**ので、運営者側で公開メール例外・送信者表示の一般要件を確認する。
- 3サービスそれぞれ送信可能な候補が5件未満なら**1通も送らない**。上限超過や重複宛先を防ぐ。
- 新たな「公式サイト掲載の校舎候補」は基本的にメールなし・掲載許諾なし。`営業候補_自動収集`に候補として登録してもそのまま公開や送信はしない。同一法人の校舎には本部単位で1通だけ。
- 2026-11-11にオーナー宛メールテストは送信済み（本番営業未送信）。毎時の`mateAutoOpsV4Cycle`および朝の`mateV4DailyGrowthDigest`のトリガー各1件がユーザーログで確認されている。

## 住所・個人名の法的注意
- 正式な郵便住所は、運営者情報ページ `https://care.kosodatemate.jp/operator.html` に表示するようソースを更新した。**住所は世界中から閲覧可能になるため、自宅の場合は注意すること**。希望すれば、適法に使用できる事業用住所へ差し替える。
- メール本文は「所在地：東京都（詳細は運営者情報に掲載）」のみ。リンク先の正確な住所と問い合わせ先を公開したときに限り `MATE_LEGAL_ADDRESS_PAGE_VERIFIED=YES`。
- Gmailの差出人表示は「MATE運営事務局」のまま。ただし、**特定電子メール法の表示義務は正式な個人名または法人名であり、「MATE運営事務局」「NextEdu」のような屋号だけでは法定要件を満たすと断定できない**。ガイドライン: https://www.caa.go.jp/policies/policy/consumer_transaction/specifed_email/pdf/110831kouhyou_2.pdf
- よって本番送信関数は `MATE_FORMAL_SENDER_NAME` と `MATE_FORMAL_SENDER_VERIFIED=YES` がない場合に停止する。正式な法人名を使用できれば、個人名を載せず送信できる可能性がある。法人がなければ本人名の表示要否を確認する必要がある。法人名は推測しない。
- 同意不要の例外は特定電子メール法第3条第1項第4号、受信拒否は同条第3項、送信者名・配信停止表示は第4条の規律がある。https://laws.e-gov.go.jp/law/414AC0100000026

## ユーザーによる最終GAS反映手順
1. <https://script.google.com/home>で **MATE_営業自動化V4** を開く（「MATE 問い合わせ自動管理」は触らない）。
2. 既存 **コード.gs** の内容を <https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs> で**全文置換・保存**。GitHubだけ変更してもGASには反映されない。
3. 既存の`BALANCED_15`設定と送信OFFを確認するため、まず **`checkMateAutoOpsV4`** を実行。`phase=BALANCED_15`、`dailyCap=15`、`dailyPerServiceCap=5`、`outreachStartDate=2026-11-12`、2種のトリガー各1件を確認。トリガーの再インストール不要。
4. 必要時のみ **`prepareMateBalanced15V4`** を実行。この関数は設定を整えるが**送信をOFFへ戻す**。
5. Apps Script「プロジェクトの設定」→「スクリプトプロパティ」に、本物の事業者の所在地を`MATE_SENDER_ADDRESS`として入力（GitHubのソースコードには住所を埋め込まない）。公式の運営者情報ページで所在地・問い合わせ先を確認して `MATE_LEGAL_ADDRESS_PAGE_VERIFIED=YES`。
6. 実際の正式な送信主体を `MATE_FORMAL_SENDER_NAME` に登録し、法定表示名と一致する場合のみ `MATE_FORMAL_SENDER_VERIFIED=YES`。**法人名・個人名を推測で作らない**。
7. 公表業務用メール例外が適用できること、送信停止表示の要件、広告メールの内容を確認して `MATE_AUTO_SEND_LEGAL_REVIEWED=YES` および適切な場合のみ `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES`。
8. **`mateV4AuditOfficialContacts`** は送信をせず、自社公式ページの公開アドレスと「営業お断り」を確認する。通常は毎時自動実行され、1サイクル最大12件。一定件数を待つため手動で大量連続実行しない。
9. **`checkMateAutoOpsV4`** で `formalSenderNameSet=true`、`formalSenderVerified=true`、`senderAddressSet=true`、`legalAddressPageVerified=true`、`legalReviewFlag=true` 等を確認。**`eligibleByScriptChecks`は技術的な候補数であり、法律上の安全性の保証ではない**。
10. 3サービスそれぞれ送信可能な法人が5件以上で、業務メールの用途・送信拒否・重複排除に問題がなく、正式な送信者表示が整った場合に限り **`MATE_AUTO_SEND=ON`** を設定。次の毎時処理で最大15通／日。運用後は `営業送信ログV4` とMATE Gmail「送信済み」を突合。問題があれば `MATE_AUTO_SEND=OFF` に戻す。

## 注意事項
- Apps ScriptプロジェクトとスクリプトプロパティはGitHubから直接変更されない。ここでのコードマージは本番GAS更新や外部メール送信の実施を意味しない。
- 「候補行数」「独立した営業先事業者数」「実際の無料掲載件数」は別々に数える。全国展開事業者の校舎を追加した分は見込み掲載候補であり、承認済み掲載数ではない。
- 掲載先の申込意思・権限確認・正式承認なしに無料掲載の公開、第三者への送客、課金をしない。
- 2つの無題GASプロジェクトは、トリガー・デプロイ0件でも手動利用や旧受付の残骸である可能性があるので、削除前のバックアップと接続URL確認が必要。
