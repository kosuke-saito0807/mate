# MATE無料改善の実装台帳 — 2026-10-29

## 方針
独自ドメイン取得、営業の実送信、許諾のない掲載、既存サイトの停止は行わず、3サイトの見た目・発見性・操作性・データ安全性をGitHub中心で改善。独自ドメイン取得後に、既存のURLをcanonical・Search Console・GA4側で置換する。PLAY Firebase TESTはnoindex維持。

## 今回ソースに実装した改善

| 区分 | 改善 | 確認方法 | 対象 |
|---|---|---|---|
| 共通デザイン | 青/ネイビー・見出しの折返し・段落・ボタンへの視覚/操作ルール | `assets/mate-ux.css` と `spark/mate-ux.css`、PLAY `src/style.css` | CARE/SPARK/PLAY |
| 操作性 | 本文へのスキップリンク、キーボードのフォーカス、モーション軽減・44pxタップ領域 | `tests/test_discoverability_ux.py`、PLAY UX単体テスト | 3サービス |
| 記事導線 | 家族向け3記事を一画面で探せる無料ガイド一覧 | `guides.html`、ホーム/フッター関連記事内リンク | CARE/SPARK/PLAY |
| SEO | オリジナル3記事のSNS説明文修正・OG画像・Article/BreadcrumbList構造化データ | `tests/test_discoverability_ux.py` | 3記事 |
| AIO/AI検索 | 記事の冒頭に人間が読みやすい要点、実在組織の明記、独自の回答を含む本文と内部リンク | コード/公開HTML。架空のレビューや過剰な構造化データは作らない | 3記事 |
| Core Web Vitals補助 | CAREファーストビュー画像を優先、下部画像は遅延読み込み | `index.html` の `fetchpriority`, `loading` | CARE |
| 掲載管理 | 公開JSONで未承認・デモ・重複ID・不正URL・個人連絡先・異常確認日を拒否 | `scripts/check_public_data_contract.py`、テスト | CARE/SPARK |
| CRM運用 | 重複候補、承認ハッシュなしのキュー、有効扱い契約の同意証拠欠落を匿名集計で可視化 | `scripts/audit_mate_sales.py` 日次実行 | CARE/SPARK/PLAY |
| PLAY本番SEO準備 | 独自ドメイン確認後にのみ canonical/OG/WebSiteスキーマを安全生成 | 非公開GitHub `firebase-static/scripts/prepare_production_release.py` | PLAY |

## 既存のGitHub運用で済んでいるもの（新しい外部課金不要）
- GitHub Pages / Firebase Hosting のテストとデプロイ、元サイトとPLAY Firebase TESTの比較
- CARE/SPARKの sitemap.xml・robots.txt・GA4コード
- 公開承認に必要な権限・同意・契約・審査をチェックする同期スクリプト
- 個人情報のある問い合わせ内容・契約証拠はGoogle Sheetsの非公開業務データに保持
- 日次のブラウザ監査と営業準備の匿名集計

## 今回の変更では完了できないもの
- **Search Console / Bing**：サイト所有権の確認・サイトマップ登録・登録/掲載の確認は実アカウント操作が必要。登録しても検索順位やAI引用は保証されない
- **GA4リアルタイム**：コードはあるが、Googleアカウントで受信・コンバージョンを確認する必要がある
- **専用ドメイン**：Cloudflare等で本人が取得し、各サービスのcanonical、OG URL、sitemap、DNS/HTTPSを切替
- **PLAY正式版**：API/管理/予約機能、ユーザー側の受入れ、運営メールの実送受信が未完。元サイトは継続
- **外部SNS投稿・Googleビジネスプロフィール**：ブランドアカウント認証が必要。実在の来店型店舗でないオンライン専用メディアについてビジネスプロフィールを架空の住所で作成しない
- **実在施設の掲載**：許諾/担当者権限/契約/審査のすべてを確認できるものだけ。掲載件数を偽装しない

## SEO/AIOで避けること
Google Search CentralはAI Overviews/AI Modeのための専用のスキーマや `llms.txt` を必須としていない。強引なキーワード詰め込み、量産した類似地域ページ、実在しない口コミ、掲載/提携を偽るコンテンツは作らない。
参考: https://developers.google.com/search/docs/appearance/ai-features?hl=ja
https://developers.google.com/search/docs/fundamentals/ai-optimization-guide?hl=ja

## 検証とロールバック
- 公開リポジトリ： `kosuke-saito0807/mate` `main`。GitHub ActionsのUI/SEO/掲載データテストが成功してからマージ。
- 非公開： `kosuke-saito0807/mate-platform-private` `main`。PLAY TESTへのみデプロイ、noindex維持。
- 差分が不適切ならPR/コミット単位で元に戻せる。データ同期・CRM送信承認・旧ChatGPT Sitesはこの改善で変更しない。
