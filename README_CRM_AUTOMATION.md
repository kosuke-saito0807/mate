# MATE 営業DB → 公開サイト自動連携

営業DBを非公開データとして扱い、次の3条件をすべて満たす事業者だけを公開します。

1. MATE掲載ステータス = 掲載許可
2. 掲載許可 = 許可
3. 公式サイトURLが入力済み

公開されるのは ID / 事業者名 / エリア / 種別 / 東京都施設番号 / 公開一覧掲載基準日 / 公式サイト / ステータスだけです。
営業担当者、電話、メール、反応、営業優先度、メモ、料金見込などは公開されません。

初回設定:
GitHubリポジトリの Settings → Secrets and variables → Actions で Repository secret を作成します。

Name: MATE_CRM_CSV
Value: 営業DBCSVの全文

その後、Actions の「Sync MATE public data」から手動実行できます。

通常運用:
営業DBを更新 → MATE_CRM_CSV を更新 → Actionsを実行 → 公開サイトの data.json が更新されます。

将来的にGoogle Sheets等の外部DBが利用可能になった場合は、このSecret方式からAPI連携へ置き換え可能です。
