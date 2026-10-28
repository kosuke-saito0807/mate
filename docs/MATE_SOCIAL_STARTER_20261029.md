# MATE SNS・無料集客 実装・運用パック（2026-10-29）

## 作成したSNSプロフィールの共通リンク
**https://kosuke-saito0807.github.io/mate/links.html**
MATE CARE / SPARK / PLAY、公開記事3本、運営者情報・プライバシー・問い合わせを案内する。
Instagram / Threads / note / Pinterestのプロフィールリンクをこの1件に統一。新ドメイン取得時はリンク先を差し替える。
ページはnoindex（検索記事の重複を避ける）、サービスクリックは匿名GA4イベント `mate_service_select` で計測する。

## ブランドプロフィール
- 表示名：MATE｜子育て家庭の頼れる相棒
- アカウントID候補：`@kosodate.mate`、`@mate.family.jp`（空きは未確認。勝手に登録しない）
- 説明文：『子育ての「探す」をもっと身近に。ベビーシッター・育児サポートのCARE、習い事探しのSPARK、親子お出かけのPLAY。家族に寄り添う3つの無料情報サービス。』
- リンク：`https://kosuke-saito0807.github.io/mate/links.html`
- 窓口：`kosodatemate@gmail.com`
- 運営：NextEdu（実名・顔写真・勤務先/育休経歴は公開しない）
- 掲載中の実在サービス・提携事業者数は現状0件。サービスの機能紹介と安全な選び方の記事を中心にする。

## 無料チャネルと役割
| チャネル | アカウント構成 | 推奨投稿 |
|---|---|---|
| Instagram | MATEブランド1アカウント、CARE/SPARK/PLAYをシリーズ化 | カルーセル4〜6枚、週2回。特定施設の無許諾画像は使わない |
| Threads | Instagramに紐づく1アカウント | 短文の選び方・Q&A、週2〜3回 |
| note | MATE運営公式1アカウント | オリジナル記事の概要と追加解説を週1本、公式記事へのリンク |
| Pinterest | MATEのビジネス用1アカウント | チェックリスト画像と記事URLを週2回 |
| Google検索・Bing | Search Console・Bing Webmaster Tools | サイトマップ登録、記事ごとに検索/公開状態を週次確認 |

アカウント作成、ログイン、投稿、フォロー、DMは**未実施**。所有者の認証が必要。
※掲載が無い状態で「予約できます」「多数の教室を比較できます」「提携施設数」などの誤認表現を避ける。

## 投稿文案：初週
### 1 CARE — Instagram / Threads
ベビーシッターを初めて探すとき、料金だけで選んでいませんか？
依頼する前に「対応年齢」「安全面と緊急連絡」「補償・保険」「追加料金」など、7つの確認ポイントをまとめました。
▶ MATE CAREの無料ガイド
https://kosuke-saito0807.github.io/mate/guide-sitter-choice.html
#ベビーシッター #子育て #育児サポート

### 2 SPARK — Instagram / Threads
子どもの習い事選びで大切なのは「本人の興味」と「無理なく通えること」。
体験レッスンを申し込む前に、曜日・移動・年間費用・先生との相性など6つを比較しよう。
▶ MATE SPARKの無料ガイド
https://mate-spark.web.app/guide-lessons-choice.html
※実在教室の掲載は準備中です。
#習い事 #子育て #習い事選び

### 3 PLAY — Instagram / Threads
雨の日の子連れお出かけ、どこを先に確認する？
「営業状況」「年齢制限」「授乳室」「予約の有無」「濡れずに移動できるか」。
当日困らないためのチェックリストをまとめました。
▶ MATE PLAYの無料ガイド
https://kosuke-saito0807.github.io/mate/guide-family-outing.html
#子連れお出かけ #親子おでかけ #雨の日

## Instagramのカルーセル構成
- 表紙：「ベビーシッター依頼前の7つの確認」
- 2枚目：対応地域と時間、保育内容
- 3枚目：研修・資格・本人確認、緊急連絡体制
- 4枚目：料金総額、キャンセル条件
- 5枚目：事前面談と確認メモ
- 6枚目：まとめ、「詳しくはプロフィールのリンクから」
素材は自作文字図解を優先し、子どもの顔写真や施設の写真の無断転載はしない。

## 週次の運用
- 月：CARE、記事をもとに一つのテーマで短文投稿
- 水：SPARK、体験前チェックをカルーセル化
- 金：PLAY、親子お出かけのチェックリスト
- 日：質問・アンケートへの回答、サイト流入を確認
- 月末：GA4のオーガニック/リファラル流入、Search Consoleの表示回数・クリック、実問い合わせ成功件数を比較

## 投稿URL計測（UTM）
プロフィール共通: `https://kosuke-saito0807.github.io/mate/links.html?utm_source=instagram&utm_medium=social&utm_campaign=mate_launch`
Threads: `?utm_source=threads&utm_medium=social&utm_campaign=mate_launch`
note: `?utm_source=note&utm_medium=referral&utm_campaign=mate_launch`
Pinterest: `?utm_source=pinterest&utm_medium=social&utm_campaign=mate_launch`
リンクのクエリに個人識別情報や投稿閲覧者情報を入れない。

## 完了と保留
- [x] サイト3つと記事3本を集約したプロフィール用リンクページをGitHubで実装
- [x] 投稿案、プロフィール案、運用ルールを準備
- [x] MATE公式記事にGA4計測コードを実装（GA4リアルタイム受信確認は別）
- [ ] SNS各サービスでブランドアカウントを本人が作成・認証
- [ ] 実際の投稿・画像・権利・見え方を確認
- [ ] サイトマップをGoogle Search Console / Bing Webmaster Toolsに登録
- [ ] GA4カスタムディメンション（service, destination_service）登録とリアルタイム受信の確認
