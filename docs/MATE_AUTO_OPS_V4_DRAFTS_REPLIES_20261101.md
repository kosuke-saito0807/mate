# MATE AutoOps V4: 無人化を進める運用更新（2026-11-01）

## 何が自動になるか

- 既存営業DB（CARE/SPARK/PLAY）のCRM取込と、事業者の重複除外。
- 再利用許可とHTTPSを確認したCSVの定期取込。CSVに「OPT_IN」とあっても人の送信根拠確認までは窓口確認待ち。
- **社内審査用のGmail下書きを日次最大3件（CARE/SPARK/PLAY各1件）**、運営者本人 `kosodatemate@gmail.com` 宛に作成。下書きであっても**事業者には送信しない**。
- Gmailの配信停止検出、重複送信防止、送信済みメールへの返信検出（本文は台帳にコピーしない）。
- 送信条件を満たした**審査済み宛先に限る**1日最大5通の自動営業送信。送信は初期状態OFF。
- 実際の保護者の情報提供同意と事業者の許諾・取次証跡がある場合に限る送客台帳の更新。

## 一回だけの作業

1. `kosodatemate@gmail.com` で [MATE営業管理DB](https://docs.google.com/spreadsheets/d/1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ/edit) →「拡張機能」→「Apps Script」を開く。
2. 既存の V4 の `.gs` ファイルだけを、[GitHubの最新版](https://github.com/kosuke-saito0807/mate/blob/main/scripts/mate_auto_ops_v4.gs) の **Raw** 全文で置換して保存。フォーム受付など他の `.gs` ファイルは変更しない。
3. 実行関数を `mateAutoOpsV4Cycle` にして一度手動で実行。必要なGoogle権限を承認する。
4. ログの `reviewDrafts`（0〜3）、`outreach`（初期設定OFF）、`replies`（0以上）を確認する。
5. 以前実行済みの `installMateAutoOpsV4` が作った1時間ごとのトリガーはそのままでよい。トリガーが存在しない時のみ `installMateAutoOpsV4` を1度実行する。

社内下書きの台帳は「営業審査下書きV4」。個々のGmail下書きIDと元の事業者の候補キーを記録する。少量・一度だけの作成で、データの未確認や中途失敗からの二重作成を抑止する。

## 自動送信の有効化には別途送信元の本人操作が必要

現状の `営業候補_自動収集` は旧CRM由来で、全件送信根拠未確認のため送信対象ではない。

運営者が、実際の事業者の公式窓口で事前確認し、`営業候補_自動収集` の `メール用途・営業可の根拠`、`根拠確認日時`、`営業拒否`、`状態` 等を事実と証拠に基づいて設定する。根拠は個別の事前同意 `OPT_IN`、または適切な営業・提携提案受け付け `SOLICITATIONS_WELCOME` 等を用いる。公開メールだけでは自動的に可としない。

送信者情報を正しく設定し法令・配信停止対応を確認できた場合に限り、スクリプト プロパティを設定:

- `MATE_AUTO_SEND=ON`
- `MATE_AUTO_SEND_LEGAL_REVIEWED=YES`
- `MATE_SENDER_NAME`：実際の送信者名称（架空・匿名表記では不可）
- `MATE_SENDER_ADDRESS`：実際の営業所在地
- `MATE_DAILY_CAP=5`（任意、最大5通）

これで、送信条件を満たした宛先を次の毎時実行で自動送信する。未確認172件へ一斉送信はしない。

任意: `MATE_REVIEW_DRAFTS=OFF` で社内確認用の自動下書きを停止できる。

## 変えない運用ルール

- 返信ありの候補は人が判断し、契約や掲載同意を自動承認しない。
- 配信停止希望の登録は拒否が優先。Gmail送信が曖昧に失敗した場合、無条件に再送しない。
- 無断掲載、架空事業者・内部デモの本番公開、保護者のPIIの送信や自動第三者提供は行わない。
- 売上は有料契約・取次/成約の確認と証跡がある場合だけ計上する。
- Gmail/Apps Script の接続元は `kosodatemate@gmail.com`。個人用 `kosuke.saito0807@gmail.com` から代送しない。

## 検証

GitHub Actions: https://github.com/kosuke-saito0807/mate/actions/workflows/test-mate-auto-ops.yml

日本の特定電子メール法・各社の送信拒否条件・Googleの日次送信上限を順守する。
