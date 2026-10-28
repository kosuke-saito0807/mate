# MATE CARE / SPARK / PLAY — 無料SEO・集客実行パック（2026-10-29）

> 検索順位・インデックス・集客数は保証できません。GitHub変更はレビュー用ブランチにあり、本番反映・Googleアカウントでの登録は別途確認すること。
> 2026-10-28のシートでは実在掲載許諾0件。架空デモ、未許諾掲載、未稼働の体験送客は宣伝しない。

## 1. 公開URLと検索導線

| サービス | 現行URL | 用意した検索用記事 |
|---|---|---|
| CARE | https://kosuke-saito0807.github.io/mate/ | /mate/guide-sitter-choice.html |
| SPARK | https://mate-spark.web.app/ | /guide-lessons-choice.html |
| PLAY | https://mate-play.kosuke-saito0807.chatgpt.site/ | 元CMS完全移行前。専用記事は原本構成と公開権限確認後に追加 |

- CARE: ホームのtitle/description、canonical、OGP、WebSite構造化データ、サイトマップ、記事と内部リンクを整備。
- SPARK: ホームのtitle/description、OGP、WebSite構造化データ、サイトマップ、記事と内部リンクを整備。
- 検索記事は依頼前の確認ポイントや習い事の比較方法を提供する。店舗、料金、クチコミ、体験受付、提携数の架空情報を使わない。
- Search ConsoleはGoogleの所有者認証が必要。DNSで検証できる独自ドメイン取得後は「ドメイン」プロパティでの管理を推奨。既存の個別URLにはURLプレフィックスプロパティでも対応可能。
- Google Search Console → プロパティを追加 → URLプレフィックスを登録・所有権確認 → サイトマップを送信：
  - CARE: https://kosuke-saito0807.github.io/mate/sitemap.xml
  - SPARK: https://mate-spark.web.app/sitemap.xml
- CAREのGitHub Pagesは `github.io/mate/` のサブパス。robots.txtはオリジン直下 `https://kosuke-saito0807.github.io/robots.txt` でのみ適用される。サブパスに置いたrobots.txtを検索制御として扱わない。必要ならGitHub Pagesの公開構成変更・独自ドメイン化後に設置。
- Bing Webmaster Toolsで同サイトを登録しサイトマップを送信。Search Consoleからインポートできる場合はそちらでもよい。
- PLAYは移行先が本番化するまでFirebase TESTをサーチコンソールに「正式PLAY」として登録しない。移行時は旧URL維持とcanonical/301可否を確認。

## 2. 無料チャネルの優先順位（有料広告ゼロ）

1. **Google検索 / Search Console**: 長期流入の基本。Search Consoleのインデックス・表示回数・クエリとGA4の自然検索流入を月次で確認。
2. **note**: 一次情報の短い記事を週1本。記事からサイトの詳細ガイドへリンク。サイトの記事をそのまま丸ごと転載せず、独自の導入と解説を置く。
3. **Instagram + Threads**: 画像・短文で週2-3投稿。プロフィールに3サービスの入口URLを設置（独自ドメイン取得までは主要サービスの公開URL）。写真・子どもの画像は使用許諾を厳守。
4. **Pinterest（無料ビジネスアカウント）**: 「シッター依頼前チェックリスト」「習い事の比較表」「雨の日お出かけの持ち物」などを縦型画像にし、それぞれ実在記事へリンク。別途アカウントの作成が必要。
5. **Bing検索**: Bing Webmaster ToolsにURL・サイトマップ登録。Googleと同じ公開記事を活用。
6. **地域・育児コミュニティ**: 投稿が許可された場だけで、有益な説明と出典付きで紹介。宣伝禁止の場所への一斉投稿はしない。
7. **掲載先の公式サイト・SNS**: 事業者から正式な掲載許可を得た場合、相互紹介を依頼。未許諾のまま外部の施設情報や住所を借用・転載しない。

### 投稿文案（アカウント所有者が投稿前に確認）

**CARE / note・Threads**:
「ベビーシッターを初めて利用するとき、何から比較すればいい？ 料金だけでなく、対応年齢、保険、緊急時の連絡体制など、依頼前に確認したい7つの項目をまとめました。MATE CAREの無料ガイドはこちら： https://kosuke-saito0807.github.io/mate/guide-sitter-choice.html  ※各サービスの条件は公式案内を確認してください」

**SPARK / note・Instagram**:
「習い事は、子どもの『やってみたい』と家族の通いやすさの両方が大切。体験前にチェックしたい費用・曜日・安全管理など6項目をまとめました。MATE SPARK：https://mate-spark.web.app/guide-lessons-choice.html  ※実在教室の掲載は準備中です」

**PLAY / note・Threads（本体CMSの修正前にも利用可）**:
「雨の日の子連れお出かけ。目的地を決める前に『移動時間』『授乳・おむつ替えの場所』『当日の営業状況』『予約要否』をチェック。MATE PLAYは親子のお出かけ・体験選びを支える情報サービスです。 https://mate-play.kosuke-saito0807.chatgpt.site/  ※施設の開催・料金は必ず公式情報でご確認ください」

### 6週間の無料コンテンツ案

| 週 | CARE | SPARK | PLAY |
|---|---|---|---|
| 1 | シッター依頼前の7つの確認（記事用意） | 習い事体験前の6つの確認（記事用意） | 雨の日のお出かけチェックリスト（投稿文案） |
| 2 | シッター料金の比較で見落としがちな費用 | 月謝以外の年間費用 | 乳児連れ外出の持ち物 |
| 3 | 送迎サービスの確認点 | 年齢別の体験で見ること | ベビーカーで行く外出計画 |
| 4 | 保育方針を質問するコツ | 休会・退会条件の確認 | 季節の親子体験の探し方 |
| 5 | 家族で緊急時連絡を整理 | 送迎負担の見積もり | 施設への確認事項 |
| 6 | 事前面談で聞く質問 | 体験レッスンの振り返り | 雨天時の代替案づくり |

※追加記事は公開準備のみ。地域の実店舗・イベント・施設・料金は裏取りしてから具体名を掲載。

## 3. MEO / Googleマップ

MATEは現時点ではオンライン情報サイト・紹介/リード獲得事業。Googleビジネスプロフィールは、原則として顧客と対面接触する実店舗・訪問事業が対象で、オンライン専業やリード獲得エージェントは対象外。従って**所在地の架空登録、バーチャルオフィス登録、所在地を偽るMEOはしない**。
実際の店舗や訪問対応事業を自社で運営し適格性を満たすことが将来確認できた場合に検討。現状は検索SEOと地域性の高い一般記事を優先し、正式な掲載先の自社Googleマップを代行作成しない。

根拠：https://support.google.com/business/answer/13763036?hl=ja

## 4. CAREメール・GA4・PLAY正式公開のゲート

### CAREの家族向け相談（まだ完了ではない）
- 本番CAREで `consult.html?service=CARE` から**重複しない1件**の内部テストを送信。
- 送信応答の受付番号、非公開シート「問い合わせ管理」の CARE 行、専用 `kosodatemate@gmail.com` の通知メールの件名・受付番号を照合する。
- 現行ChatGPT Gmail接続は `kosuke.saito0807@gmail.com` であり、専用運営Gmailの受信証拠にはならない。
- テストに子どもの氏名、電話番号、健康情報、実在顧客情報を入れない。二重テスト・誤送信を避ける。

### GA4（測定ID G-NG57XX4Y5D）
- 所有者のGoogle Analytics → レポート→リアルタイムを開いた状態で、シークレットウィンドウ等から CAREトップ、SPARKトップ、PLAYトップを順に開く。
- `page_location` / `hostname` とイベントの `service` で流入元を見分ける。CARE/SPARKのソースのタグ設置は確認済みだが、実送信・受信は未確認。
- クリック計測：CARE `provider_outbound`、SPARK `school_outbound_click` / `school_compare`（実在掲載がない間は発火しなくてよい）、PLAYは元CMSに実装確認が必要。
- GA4デバッグビュー・リアルタイムレポートのスクリーンショットや確認結果（アクセス数など個人情報を含まない）を記録。名前・メール・問い合わせ内容はイベントに入れない。
- 専用のGA4/サーチコンソール連携が接続されれば、そのアプリで計測結果を読み取れる（アカウント所有者の接続が必須）。

### PLAY（本体未移行）
- ChatGPT Sites の現行公開URLは維持する。
- 元CMSからの完全な原本ZIP、掲載データ/画像の権利、検索・比較・問い合わせ機能とFirebase TESTとの差分、モバイル表示、承認済み掲載の公開経路を確認する。
- テスト版を正式PLAYと呼んで外部宣伝しない。原本一致とフォーム本番検証後にのみ切り替える。

## 5. 成果KPI（無料運用）

- 毎週：投稿数、記事公開数、Search Consoleのインデックス状況、GA4のユーザー数と自然検索セッション、問い合わせの成功受付件数。
- 毎月：Search Console表示回数・クリック・CTR・上位検索語、サイト別参照元、承認済み掲載件数、掲載希望の返信件数。
- 目標値は現時点の流入データがないため未設定。まず7日間のベースラインを測り、投稿内容と導線を改善する。

公式資料：
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://search.google.com/search-console/
- https://www.bing.com/webmasters/
- https://business.pinterest.com/ja/getting-started/
