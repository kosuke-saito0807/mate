# MATE — 子育て家庭のCARE・SPARK・PLAY

MATEはNextEduが運営する、子育て家庭が育児サポート・習い事・親子体験の情報を探せる3つのサービスです。各サイトでは事業者が申請・確認した正式掲載と、MATE編集部が公式情報に基づき独立して作成した**事業者未承認の参考紹介**を区別しています。参考紹介は提携・推薦・空き状況や料金の保証を意味しません。

## 正式な公開サイト

| サービス | 公式URL | 探せる情報 | 配信 |
| --- | --- | --- | --- |
| [MATE CARE](https://care.kosodatemate.jp/) | https://care.kosodatemate.jp/ | ベビーシッター・訪問保育・子育てサポート | GitHub Pages／独自ドメイン |
| [MATE SPARK](https://spark.kosodatemate.jp/) | https://spark.kosodatemate.jp/ | 子どもの習い事・教室・プログラミング・英語・音楽など | Firebase Hosting／独自ドメイン |
| [MATE PLAY](https://play.kosodatemate.jp/) | https://play.kosodatemate.jp/ | 親子のお出かけ・体験・ワークショップ・イベント | PLAY専用Firebase Hosting／独自ドメイン |

上記が正式な案内先です。開発・テスト・ホスティングの既定ドメインは、公開先の案内に使いません。

## 利用者向け：確認に役立つ公開情報

- [全国のベビーシッター事業者の公式情報一覧（CARE）](https://care.kosodatemate.jp/sitter-directory.html) — 編集部が公式サイトを参照した未承認の参考情報を、地域や事業者名で探せます。
- [子どもの習い事・教室の公式情報一覧（SPARK）](https://spark.kosodatemate.jp/school-directory.html) — プログラミング・英語・音楽・アート・スポーツなどをジャンル別に探せます。事業者の正式掲載とは別です。
- [ベビーシッターの選び方](https://care.kosodatemate.jp/guide-sitter-choice.html)と[料金総額の比較方法](https://care.kosodatemate.jp/guide-sitter-hourly-cost.html)。
- [習い事の選び方](https://spark.kosodatemate.jp/guide-lessons-choice.html)と[習い事の年間費用の確認](https://spark.kosodatemate.jp/guide-lesson-total-cost.html)。
- [赤ちゃんとのお出かけ・親子体験ガイド](https://care.kosodatemate.jp/guide-family-outing.html)。

事業者の募集状況・資格・安全管理・対象年齢・価格・開催日・予約方法は、必ず**各公式サイトの最新情報**で確認してください。

## 事業者向け：無料掲載の申請

- [CARE：ベビーシッター事業者の無料掲載](https://care.kosodatemate.jp/contact.html)
- [SPARK：習い事・教室の無料掲載](https://spark.kosodatemate.jp/partners.html)
- [PLAY：親子体験・イベントの無料掲載](https://care.kosodatemate.jp/play-listing.html)

基本情報の掲載料・紹介料は無料です。申請だけで即時公開・有料契約・予約取次ぎは始まりません。正式掲載の可否は、申請者の権限・掲載情報・必要な許諾を運営事務局が確認した後に判断します。独立した参考紹介の修正・削除は運営窓口へご連絡ください。

[運営者・NextEduの情報](https://care.kosodatemate.jp/operator.html) ｜ [お問い合わせ](mailto:kosodatemate@gmail.com)

## このリポジトリの範囲

この公開リポジトリ `kosuke-saito0807/mate` は **CARE と SPARK のWebサイト、公開可能なデータ、検証、SEOと安全な配信処理**を管理しています。MATE PLAYのサイト本体や非公開運用コードは別のアクセス制御されたリポジトリで管理し、PLAY専用Firebaseの公開パイプラインから配信します。

- `index.html` とルートの `*.html`：CARE公開ページ。
- `spark/`：SPARK公開ページ、教室情報、検索コンテンツ。
- `editorial-care.json`、`spark/editorial-schools.json`：**公開事実に基づく未承認の編集部参考情報**。事業者承認済みの公開情報とは別。
- `scripts/sync-care-directory.py`、`scripts/sync-spark-directory.py`：公開参考情報とクロール可能な事業者一覧HTMLを同期。
- `sitemap.xml` と `spark/sitemap.xml`：各公開ドメインのサイトマップ。
- `tests/`：掲載許諾、個人情報、検索、SEO、公開データの整合性等の回帰テスト。
- `.github/workflows/pages.yml`：CARE独自ドメインへ公開。
- `.github/workflows/firebase-spark-live.yml`：SPARK独自ドメインへ公開（検証・権限ゲート付き）。

GitHub上のソース・テストが正常でも、Google検索へのインデックス登録や検索順位は保証されません。実際のGoogle検索状況はSearch Consoleで別途確認します。実際の権限確認済み申請・承認・掲載の証跡は、非公開の運営DBで管理します。

**セキュリティ:** 公開リポジトリやそのGit履歴に、個人情報、認証情報、運営DB原本、内部通知、問い合わせ本文、非公開契約を追加しないでください。
