# MATE CARE / SPARK / PLAY 営業V4 — 本番移行ガイド（2026-11-11更新）

## 2026年11月11日追加：自動審査・正式住所・送信者表示の法定要件
- 運営者ページ `operator.html` の「所在地（運営窓口）」にユーザー指定の住所を掲載するソース修正を実施。**GitHub反映後はウェブ上で一般公開される住所**のため、自宅住所を公開したくない場合は事業用住所へ変更すること。
- 営業メールは `MATE運営事務局` を差出人表示名として継続。ただし**消費者庁ガイドラインでは「○○運営事務局」のようなサービス名称だけでは正式な送信者氏名／法人名称の表示義務を満たさない**（ガイドライン: https://www.caa.go.jp/policies/policy/consumer_transaction/specifed_email/pdf/110831kouhyou_2.pdf ）。このため `MATE_FORMAL_SENDER_NAME` に適法な正式の氏名または法人名、`MATE_FORMAL_SENDER_VERIFIED=YES` により責任主体を確認するまで、送信関数はエラーで停止する。法人でない屋号 `NextEdu` のみで足りるとは推定しない。正式名は営業メールの「送信責任主体」に表示される。個人名を公開したくない場合は適法な法人名等が必要で、表示義務の省略はしない。
- 個別の審査クリックを減らすため、最新コードは**自社公式HTTPSサイト上の一般業務用メールと完全一致し、同一ホストの掲載ページ・公開確認日が揃い、営業拒否文言を検出せず、配信停止先でない場合のみ**公開メール例外に基づき自動候補化する。**人が付ける `PUBLIC_EMAIL_REVIEW_OK` は不要**。曖昧な窓口は保留する。各時12件の公式サイトを確認する。
- この自動化を使う前に送信者の法的表示義務と公開メール例外の適用を一度確認し、`MATE_AUTO_SEND_LEGAL_REVIEWED=YES` と `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES` を設定する。これらは**承諾のない相手に対する無条件の営業許可ではない**。相手が営業お断りと表明していれば送らない。公式根拠から再チェックした公開メールのみ対象。
- `MATE_SENDER_ADDRESS` は正式な事業所在地を**Apps Scriptのスクリプトプロパティに直接**入力。公開の `operator.html` に所在地・問い合わせ先が実際に表示されているのを確認して `MATE_LEGAL_ADDRESS_PAGE_VERIFIED=YES` にする。ChatGPTからApps Scriptのプロパティを直接変更する機能はない。
- `BALANCED_15` は最大15通／日、CARE・SPARK・PLAY各5通。3サービスとも適格候補5件が揃うまで送信保留。送信ログとGmail送信済み履歴の重複除外を維持。
- 公開した公式校舎の候補リストはその校舎の**掲載許諾や営業用メールアドレス**を意味しない。チェーン教室は本部に1通、掲載は教室別に事業者の許諾・公開承認を得て実施する。台帳の候補件数≠営業宛先数≠公開掲載数。
- **今のGitHub更新でGASのコードは更新されない**。`MATE_営業自動化V4` の `コード.gs` を改めて全文置換。既存の各トリガー1件をそのまま維持。`prepareMateBalanced15V4` は実行すると **MATE_AUTO_SEND=OFF** へ戻すため、再設定後に審査・表示・法務条件を確認してから手動でONへ切り替える。


## 実装と実績
- 既存GASプロジェクト名：**MATE_営業自動化V4**。置換するソースファイルは既存の **コード.gs**。別プロジェクト「MATE 問い合わせ自動管理」「MATE 直接掲載受付」には貼らない。
- 元ソース：[最新版 mate_auto_ops_v4.gs](https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs)。
- 2026-11-11 08:31のユーザーGASログで、毎時 `mateAutoOpsV4Cycle`・9時台 `mateV4DailyGrowthDigest` のトリガーが各1件、重複なし。両トリガーを再登録する必要はない。
- 2026-11-11の新規候補追加後、`MATE営業管理DB` → `営業候補_自動収集` に**公式・教室候補は随時拡充中**。この数は**候補行数**で、支店や同一ブランドの複数コースを含む。219の独立した送信先メールを意味しない。
- 追加した校舎等は「窓口確認待ち」「UNVERIFIED」「メール空欄」。公式事業存在を確認した候補として登録したのみ。営業時間・イベントの現在の開催有無も送信前に要確認。
- 2026-11-11のMATE Gmail実テスト：差出元 kosodatemate@gmail.com、宛先 kosuke.saito0807@gmail.com、件名 `【送信テスト／MATE SPARK】無料掲載ご案内（外部表示チェック・本番送信前）`、GmailメッセージID `1a1c828d4d35cb6f`。実際の営業先への送信ではない。
- 既存ログは営業送信0件。最新コードでは自社サイト再検証の根拠から自動候補化できる（正式な送信主体、住所、法務の全体条件は別途必要）。

## 送信者に個人名を表示しない
- 送信元のGmail表示名・ブランド署名は**MATE運営事務局**に固定した。**法律上必要な正式な送信主体の名称は別途メールに表示する。**
- 地域はメール本文中に「所在地：東京都（詳細は下記の運営者情報に掲載）」と短く記載する。**ただし住所をメール本文から省略できる条件は、送信者の正確な所在地や連絡先が読める運営者情報ページを併記していること**。
- 法的な正確さを確保するため、完全な事業所住所はGASスクリプトプロパティ `MATE_SENDER_ADDRESS` に入力して検証する。これは**メール本文には出さない**。公開ページは `https://care.kosodatemate.jp/operator.html`。
- **更新前の運営者情報ページには正確な所在地が掲載されていなかった**。そのため `MATE_LEGAL_ADDRESS_PAGE_VERIFIED` は現状 `YES` にしてはいけない。所在地を公開できない場合は、実際に使用できる別の適切な事業所所在地（法人登記住所・利用可能な事業用住所サービス等）の合法性を確認してから掲載する。住所の架空記載や未確認の短縮表示だけでの送信はしない。
- 参考：特定電子メール法と消費者庁の表示義務解説 https://laws.e-gov.go.jp/law/414AC0100000026 / https://www.caa.go.jp/policies/policy/consumer_transaction/specifed_email/pdf/specifed_email_180709_0001.pdf

## GAS側の作業（最新版への反映後）
1. [Google Apps Script](https://script.google.com/home) から **MATE_営業自動化V4** を開く。
2. 既存 **コード.gs** を[GitHub最新版](https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs)で**全文置換**し `Command + S`。旧ファイルを別に残して同名関数を二重追加しない。
3. 関数 **`prepareMatePilotV4`** を1回実行。これで次のScript Propertiesを安全に設定する：
   - `MATE_AUTO_SEND=OFF`（実営業送信は停止）
   - `MATE_OUTREACH_PHASE=PILOT`
   - `MATE_DAILY_CAP=1`
   - `MATE_SENDER_NAME=MATE運営事務局`（旧個人名を強制上書き）
4. 関数 **`checkMateAutoOpsV4`** を実行。`dailyLeadCycleInstalled=true`、`ownerGrowthDigestInstalled=true`、両トリガー1件、`automationSwitch=OFF`、`phase=PILOT`、`dailyCap=1` を確認。
5. 左側の **プロジェクトの設定 → スクリプト プロパティ** で `MATE_SENDER_ADDRESS` を実在する正確な事業所在地として私的に登録。運営者情報ページの事業責任主体、住所、問い合わせ先および配信停止先の表示を人間が検証してからのみ `MATE_LEGAL_ADDRESS_PAGE_VERIFIED=YES` を設定。
6. 法的要件と送信先の根拠確認後のみ `MATE_AUTO_SEND_LEGAL_REVIEWED=YES`。事業者が自己の業務用メールを公開している例外を適用する場合、個別用途審査と合わせて `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES`。フラグを機械が勝手にONにしない。
7. **営業候補_自動収集** の各行：G業務用メール、I根拠URL、J送信根拠、K根拠確認日時、M営業拒否、N状態、P備考を人が確認。**メールアドレスの公開だけでは送信対象にしない**。営業利用可能、相手方の明示拒否なし、法的例外を適法に適用可能と確認したものだけP備考に `PUBLIC_EMAIL_REVIEW_OK:2026-11-11` など**本当に審査した日付**を追記。14日以内の記録が必要。
8. `checkMateAutoOpsV4` で `senderAddressSet=true`、`legalAddressPageVerified=true`、`legalReviewFlag=true`、`phase=PILOT`、`dailyCap=1`、`eligibleByScriptChecks`の対象サービスが1件以上を確認。
9. すべて通ったときのみ人が**`MATE_AUTO_SEND=ON`** を設定。毎時の `mateAutoOpsV4Cycle` から1日最大1通のPILOTを開始。送信直前には過去送信Gmailと停止申請を照合。メールの**送信済み**と `営業送信ログV4` を突合。
10. 返信・配信停止・掲載意向を確認。必要なら `MATE_AUTO_SEND=OFF` に戻し即時停止。

## 無題のApps Scriptプロジェクトを整理する場合
- 2026-11-11にユーザーが確認した2件はトリガー0・デプロイ0・最終編集は10月。稼働Webアプリ・自動処理ではない可能性が高い。
- **exportGmails** は手動書き出し用途で、再利用しないなら控えを取り整理できる。
- **MATE_DIRECT/doPost** が入っている方は、削除前に受付フォームの現行WebアプリURLが別のデプロイ済みプロジェクトを指していることと、必要コードのバックアップを必ず照合。
- 今回は無題プロジェクトを削除していない。
