# MATE営業V4 — 送信前チェックとPILOT開始手順 (2026-11-11)

## 現状
- GAS「MATE_営業自動化V4」は毎時 `mateAutoOpsV4Cycle` および9時台 `mateV4DailyGrowthDigest` のトリガー各1件を登録済み（ユーザー実行ログ2026-11-11 08:31）。
- `MATE_AUTO_SEND=OFF`、`MATE_OUTREACH_PHASE=OFF`、本人の事業所在地は未登録。
- `営業候補_自動収集`：180件（CARE 68、SPARK 61、PLAY 51）。現状の「営業可能候補」5件はすべてCAREで公開業務メール。残る30件は公式公開メール確認済・送信待機、145件は窓口確認待ち。
- `営業送信ログV4`：0件。新コードでは各公開メールに `PUBLIC_EMAIL_REVIEW_OK:YYYY-MM-DD` が「備考」に必要。現時点でこの根拠を付けた候補は0件。
- 送信者名：以前確認された `NextEdu 代表 斎藤幸輔` を、送信時に人が確定すべき初期値として扱う。
- `MATE運営事務局（東京）` は所在地の実住所ではなく、正式な住所として登録しない。送信者の住所は本当の事業所住所を使い、チャットへの開示は不要。

## 手順 A: GAS最新版を反映してPILOTを安全に準備
1. [Google Apps Script](https://script.google.com/home)の**MATE_営業自動化V4**を開く。**MATE 問い合わせ自動管理**、**MATE 直接掲載受付**には追加しない。
2. `コード.gs` に[最新版 mate_auto_ops_v4.gs](https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs)を全文貼り付け保存（旧コードを入れ替える。同じ関数を二重追加しない）。
3. `prepareMatePilotV4` を**1回実行**。返り値 `mode=PILOT_PREPARED_NO_SEND`、`autoSend=OFF`、`dailyCap=1` を確認。これはメール送信なし。法的許可フラグや住所は勝手に設定しない。
4. `checkMateAutoOpsV4` を実行。毎時トリガー・9時台トリガー各1、`automationSwitch=OFF`、`phase=PILOT`、`dailyCap=1` を確認。トリガーの重複がなければinstall関数の再実行は不要。
5. GASの「プロジェクトの設定」→「スクリプトプロパティ」で `MATE_SENDER_NAME` を正式な責任主体・名称に確定し、`MATE_SENDER_ADDRESS` に**実在・確認済みの正式な郵便住所（市区町村以下の番地等を含む）**を本人が設定。送信者の連絡先と配信停止案内を実メール・運営者情報ページで確認する。
6. 法的な適用要件（同意、事業者公開アドレスの例外、受信拒否、送信者情報等）を確認のうえ `MATE_AUTO_SEND_LEGAL_REVIEWED=YES`。公開業務メールの例外を実際に適用する場合のみ `MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES`。**これらを自動設定しない**。

## 手順 B: 送信先候補を個別確認
1. Google Sheets `MATE営業管理DB` の `営業候補_自動収集` で各行の `G列 業務用メール`、`I列 確認元URL`、`J列 メール用途・営業可の根拠`、`K列 根拠確認日時`、`M列 営業拒否`、`N列 状態`、`P列 備考` を照合。
2. 会社の公式サイトで事業者の現在の公開メールアドレス、問い合わせ用途、営業・勧誘お断りの文言、配信停止や過去送信歴を確認する。個人メールや会員向けサポート窓口は営業先にしない。
3. **本当に適格と確認し、送信先ごとに運営者が許可した場合のみ**、P列の備考に半角スペース区切りで `PUBLIC_EMAIL_REVIEW_OK:2026-11-11` を追記。この日付は本当に確認した日を使うこと。14日を過ぎるとコード上の許可は無効。
4. 人が確認するまでは既存の `営業可能候補` 表示であっても**送信禁止**。最新版コードは人による個別確認が無い公開業務メールを送信から外す。
5. 公式な参考法令は[特定電子メール法](https://laws.e-gov.go.jp/law/414AC0100000026)および[消費者庁の表示義務解説](https://www.caa.go.jp/policies/policy/consumer_transaction/specifed_email/pdf/specifed_email_180709_0001.pdf)。公開メールの存在だけで広告宣伝がすべて許されるわけではない。

## 手順 C: 1日1件のPILOTを本人が開始
- `checkMateAutoOpsV4`で `senderNameSet=true`、`senderAddressSet=true`、`legalReviewFlag=true`、`phase=PILOT`、`dailyCap=1`、該当する `eligibleByScriptChecks` が1件以上であることを確認。
- 過去のGmail送信済みとの重複チェック・配信停止・拒否・個別レビュー記録を最終確認してから **`MATE_AUTO_SEND=ON`** を明示的に設定。トリガーは次の毎時サイクルに従い、最大1通/日（メール配送の成功は送信ログとGmailで確認）。
- まず手動で `mateAutoOpsV4Cycle` を1回実行すると同時刻にトリガーが競合しうるため、無理に手動実行せず次の毎時サイクル後に `営業送信ログV4` と送信済みGmailで照合。
- `MATE_AUTO_SEND=OFF` でいつでも停止可能。送信拒否の記録・実際の返信・申請率を確認してから送信量を増やす。自動掲載承認や自動課金はしない。

## 現時点の候補スクリーニング観察
- ジャパンベビーシッターサービスは公式サイトに業務用メール `info@jbs-mom.co.jp` と企業・自治体の問い合わせ種別があるため、**まず用途を確認する候補**。営業を受け付ける意思の明示ではない。
- ル・アンジェ `info@leange.co.jp` は契約・登録利用者向けの利用ガイドにも掲載されており、用途確認前は保留。
- ポピンズシッターの窓口は顧客向けサポート用途の可能性があるため、別途提携担当部署が確認できなければ送信を控える。
- 他候補も公開メールだけでは最終許可しない。

## 本番の未確認
GASの新しいスクリプトプロパティはGitHubのコードマージでは設定されない。MATEの実事業所在地と各相手への送信適格性判断が未確認なので、**実際の営業メールはまだ0通**。本運用への切り替え後も成果はログの送信済みとGmailの実履歴で照合する。
