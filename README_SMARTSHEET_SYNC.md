# MATE営業管理DB → 公開サイト

営業DBの正本はSmartsheetの「MATE営業管理DB」です。

## 公開条件
- 「掲載許可」 = 「許可」
- 「公式サイト」が入力済み

「MATE掲載ステータス」はSmartsheetの数式で「掲載許可」から自動表示されるため、営業担当が手動で変更する必要はありません。

この2条件を満たす行だけが公開サイトに反映されます。営業担当はSmartsheetで「掲載許可」を「許可」にするだけでOKです。

## 自動同期
GitHub Actionsが1時間ごとにSmartsheet APIを読み込み、公開対象だけをdata.jsonへ反映します。CSV作成やMATE_CRM_CSVの手動更新は不要です。

## 初回だけ必要
GitHub Repository Secretに「SMARTSHEET_ACCESS_TOKEN」を1回だけ登録します。これはSmartsheet APIの認証用です。以後の事業者追加・掲載許可変更では、このSecretを触りません。

Smartsheet APIはAPIアクセストークンで認証できます。
