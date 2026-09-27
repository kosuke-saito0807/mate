# MATE 営業DB → 公開サイト 連携仕様

## 公開条件
営業DBで「MATE掲載ステータス = 掲載許可」「掲載許可 = 許可」「公式サイトURL入力済み」の3条件を満たした事業者だけ公開する。

## 公開データ
id / name / area / kind / official_url / verified / data_as_of / status

## 非公開
担当者名、電話・メール、営業メモ、営業優先度、接触日、先方反応、有料化見込、月額見込などの営業情報はGitHub Pagesに置かない。

## 運用フロー
営業DB追加 → 事業者へ連絡 → 情報確認 → 掲載許可 → 公式URL登録 → 公開データ反映 → GitHubへpush → Pages自動更新。

## 次段階
Google Sheets等を営業DBの正本にし、GitHub Actionsで公開用data.jsonを自動生成する。掲載許可があり、公式URLがある行だけを公開する。
