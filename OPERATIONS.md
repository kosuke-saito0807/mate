# MATE 公開サイト運用

事業者データは data.json で管理します。

## GA4
index.html と provider.html の G-XXXXXXXXXX を、GA4のMeasurement IDへ置換してください。

計測イベント:
- provider_search：検索
- provider_outbound：事業者公式サイトへのクリック
- provider_id：送客先事業者の識別ID

## 事業者追加
営業DBで情報確認と掲載許可を取得 → 公開用項目だけdata.jsonへ追加 → mainへ更新 → GitHub Pagesが自動更新。

## 次段階
営業DBをGoogle Sheets等へ移し、掲載許可済みだけを自動的に公開データへ変換します。
