# MATE AutoOps V4：運用開始の手順（2026-10-31）

## 追加済み
- 3サイト営業候補174件の元データは保存したまま。
- MATE営業管理DBに7タブ追加：収集元設定V1、営業候補_自動収集、営業送信ログV4、配信停止V1、送客実績V1、送客集計V1、営業・掲載自動化設定。
- Apps Scriptコード：scripts/mate_auto_ops_v4.gs。毎時の候補取込、配信停止監視、法的根拠ゲート付き送信、取次実績の自動台帳化。
- CARE・SPARK・PLAYのGA4に mate_partner_click イベントを追加。公式サイトクリックは実紹介・成約とは別。

## オーナーの一度だけの設定
1. 専用Gmail kosodatemate@gmail.com で営業管理DBを開く：https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit
2. 拡張機能→Apps Scriptを開く。既存フォーム処理・doPost等のコードは削除しない。新しい.gsファイルに次のコードを全文コピーして保存：https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs
3. 関数 installMateAutoOpsV4 を選んで実行し、Google権限を承認。1時間に1回のトリガーを設置。
4. 初回、mateAutoOpsV4Cycle を手動実行してログを確認。メールは初期状態OFF。
5. 新規収集には「収集元設定V1」タブに、公開利用が許可された公式・ライセンス付きHTTPS CSVのURLを記入し、再利用許諾確認=確認済み、有効=TRUEを設定する。一般的な日本語列名（事業者名・施設名・公式サイトURL・所在地等）も読めるが、メール営業根拠は自動認定されず、窓口確認待ちとなる。公式データのない時点では0件のまま。個人用メールや無許可スクレイピングは対象外。
6. 実営業メールを解禁するときだけ、Apps Scriptのプロジェクト設定→スクリプトプロパティで次を設定する。MATE_AUTO_SEND=ON、MATE_AUTO_SEND_LEGAL_REVIEWED=YES、MATE_SENDER_NAME=正しい運営事業者名、MATE_SENDER_ADDRESS=正しい営業所在地。上限はMATE_DAILY_CAP=5。住所や秘密情報はGitHubに保存しない。

## 自動収集CSV列（順序不問）
service,name,website,region,email,contact_url,source_url,mail_basis,checked_at,solicitation_prohibited

- service：CARE、SPARK、PLAY
- 公式websiteとsource_url：HTTPS
- checked_at：YYYY-MM-DD。自動営業には14日以内の窓口情報が必要
- mail_basis：明示的な送信同意ならOPT_IN、公式で営業・協業提案を募集する専用窓口ならSOLICITATIONS_WELCOME。不明ならUNVERIFIED
- solicitation_prohibited：TRUEは必ず送信禁止
- 公開メールだけで自動的に許諾済みとは扱わない
- 同じ会社・ドメイン・サービスの重複、同一アドレスへの重複送信を防止
- 自動送信は1日最大5件。送信成否が不明な先に自動再送しない
- 明示された配信停止は停止台帳へ登録して以後の送信を抑止する

## 承認と成果のルール
- 掲載申請 → 事業者担当権限・掲載申請意思・内容・許諾を人が審査 → 公開データ同期。自動承認禁止
- PLAYは追加で有効な掲載契約と独立本番リリース承認が必要
- 相談受付は紹介・成約ではない。送客台帳に実紹介を入れるには、事業者の取次許諾、保護者の情報提供同意、紹介先ID、取次日時、Gmail証跡が必要
- 売上は有料契約・単価・請求対象の成果が確定した場合だけ計上。無料掲載を勝手に有料化しない
- 個人名・健康情報・問い合わせ本文を送客台帳へ保存しない
- 公式サイトクリックはGA4でイベントとして計測する。GA4→Sheetsのクリック集計は別途連携が必要であり、Sheetsのクリック欄が0でもサイトで0クリックとは限らない

## 検証と公開
自動化コードのテスト：https://github.com/kosuke-saito0807/mate/actions/workflows/test-mate-auto-ops.yml
PLAYの変更を本番公開する場合：https://github.com/kosuke-saito0807/mate-platform-private/actions/workflows/play-production-release.yml
メール広告は特定電子メール法などの適用条件と各社の営業拒否表示を確認し、適法な根拠が不明な場合は送信しない。
