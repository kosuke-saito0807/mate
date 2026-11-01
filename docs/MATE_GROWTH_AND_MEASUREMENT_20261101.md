# MATE検索流入・掲載・成果計測 運用基準（2026-11-01）

この文書は本番データの書き込みや営業送信を行わない。公開コード、GA4、Search Console、非公開Sheetの役割を分ける。

## 1. 検索流入

- CARE「初回のシッター依頼」、SPARK「体験レッスン後の比較」、PLAY「赤ちゃんとのお出かけ準備」の実用ガイド3本を追加。PLAYのガイドはCAREのドメイン上に掲載。
- 記事の作成と合わせて、ガイド一覧・関連記事・sitemap.xmlを更新。架空の掲載実績、価格、専門家監修、地域施設情報を作らない。
- Search Consoleの処理完了後にページ別インデックス状況を調べる。サイトマップ送信とインデックス登録は異なる。検索順位は保証しない。
- PLAY本体のFirebase本番公開は別リポジトリの手動承認のまま維持。

## 2. 自主掲載申請を増やす

- CARE: https://care.kosodatemate.jp/contact.html
- SPARK: https://spark.kosodatemate.jp/partners.html
- PLAY: https://care.kosodatemate.jp/play-listing.html
- 表示される実在事業者は、本人の掲載申請意思・権限確認・情報確認・審査承認・契約条件を満たした事業者だけ。内部テストは一切公開しない。
- 営業メールの自動送信はOFF。無許諾の公開、取次、自動課金、有料契約への変更は行わない。

## 3. 成果計測の境界

| 計測対象 | 現在の仕組み | 成果として数えるか |
| --- | --- | --- |
| page_view | 3サービスGA4測定ID G-CHXY0DC2WP | いいえ |
| mate_partner_click | 承認済み実在掲載先への外部リンク | クリック数のみ。送客・成約ではない |
| family_inquiry_submit_attempt | 家族向け相談フォームの送信試行 | いいえ |
| listing_inquiry_submit_attempt | 掲載申請フォームの送信試行 | いいえ |
| 受付成功 | Apps Scriptと非公開Sheetsに保存され受付番号が確定した記録 | 成功確認後のみ。GA4連携は未実装 |
| 取次・成約・売上 | 非公開の送客実績V1で本人同意・契約・結果証跡を確認 | 証拠確認後のみ |

- Google推奨イベント generate_lead は問い合わせ・申請獲得の計測に使えるが、単に送信ボタンを押しただけで送信してはいけない。
- GAS側の成功応答・保存確定と安全に連携できるまで、GA4に「成功」と偽装したイベントを送らない。
- 氏名・メール・電話・子ども情報・フォーム本文・受付番号・未検証のクエリ文字列をGA4へ送らない。

## 4. アクセス品質

- GA4探索でホスト名、ページタイトル、参照元/メディアを比較し、3サービスを分けて確認する。
- care.kosodatemate.jp からの内部referralと、自動ブラウザQAなどのテストアクセスを識別して分析する。
- 米国・オランダなど国名だけでbotと断定しない。内部トラフィック除外を使うなら、信頼できる固定IPのみ定義し、まずテストモードで確認する。
- 公開テスト用noindex、プレビューのGA4送信抑制を維持する。フィルタで本物の利用者データを消さない。

## 安全な検証順

1. 本PRのCIとブラウザテスト成功後に公開する。
2. Search Consoleの集計が出てからページ別登録状況を確認。
3. GA4のリアルタイムと探索でサービス別イベントを確認。
4. Apps Scriptの正規受付成功の検証後に限り generate_lead の実装・キーイベント設定を検討する。

Google公式参考: https://support.google.com/analytics/answer/9267735  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
