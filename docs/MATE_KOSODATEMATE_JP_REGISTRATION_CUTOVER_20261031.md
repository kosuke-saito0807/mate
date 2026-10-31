# MATE：kosodatemate.jp 取得・3サービス独自ドメイン移行手順（2026-10-31）

## ステータス：取得**未確認・未実施**

- 利用者が第一希望を **`kosodatemate.jp`**、レジストラを **XServerドメイン**、DNS管理を **Cloudflare** として承認した。
- これは「取得済み」や「独占使用可能」の証明ではない。XServerの検索画面での**リアルタイム空き状況・決済・登録完了**は、現時点で確認できていない。
- 新ドメインのDNSレコード、ネームサーバー、GitHub Pages設定、Firebase接続、Search Consoleは**未変更**。事前の公開サイトは維持し、旧PLAYの予約・管理機能を停止しない。

## 1. オーナーが実施：XServerドメインで取得

1. 公式のドメイン検索：<https://www.xdomain.ne.jp/search/domain.php> で `kosodatemate.jp` を入力し、ローマ字汎用 `.jp` を検索。取得可能と表示された**場合のみ**申込。
2. 類似する名称・商標や第三者の権利も確認。XServerアカウントへログイン（初回は作成）し、登録者名や所在地などの**正確な情報**を入力する。
3. 必要でないレンタルサーバー・メール・有料オプションは追加しない。3サイトの運用は既存のGitHub PagesとFirebaseを継続する。
4. 登録・更新の金額を決済画面で確認。公式掲載の通常更新はローマ字 `.jp` 年間税込3,102円。初年度0円キャンペーンは利用条件次第であり、適用を保証しない。自動更新を有効にし、2FAも確認。
5. **公開情報の設定に注意：** 汎用 `.jp` は登録者名以外が原則WHOIS非公開。該当理由・規則を満たす場合、XServer「Whois初期値設定 → 汎用JP、都道府県型JP」から**登録者情報非表示**を有効にする。公開連絡窓口をXServer名義にする代理設定も確認。これらは別設定で、契約登録時の正確な氏名等の登録は必要。
6. 完了時、管理画面の**登録ドメイン名と有効期限**を確認して運営者から共有してもらう。パスワード、クレジットカード情報、認証コード、APIトークンの共有は不要。

XServer公式：
- 検索：<https://www.xdomain.ne.jp/search/domain.php>
- 料金：<https://www.xdomain.ne.jp/>
- WHOIS設定：<https://www.xdomain.ne.jp/manual/man_member_setting_whois.php>
- ネームサーバー：<https://www.xdomain.ne.jp/manual/man_domain_namesever_setting.php>

## 2. 取得後：CloudflareでDNS管理（**まだ実施しない**）

1. Cloudflareの**Free**プランに実際に取得した `kosodatemate.jp` ゾーンを追加。XServerではレジストラ契約を維持する。
2. Cloudflareが**そのゾーン専用に指定した2つのネームサーバー名**を記録する。値はまだ不明のため推測・固定記載しない。
3. XServer「ネームサーバー設定」でCloudflareの2件を**完全一致**で入力する。移行前に既存MX/TXT/SPF等の必要レコードを確認し、メールを壊さない。DS/DNSSECの旧設定がある場合はCloudflare公式手順に従い移行前に整合を確認する。
4. Cloudflareが **Active** になったことを確認。サービス提供開始時のプロキシ（オレンジ雲）は認証・証明書の妨げになる場合があるため、まず必要なレコードを **DNS only**（グレー雲）にして各ホスティングの確認を行う。
5. `@/www` の行き先は事前にHTTPS、ブランド名、重複コンテンツ方針を決める。暫定案は `kosodatemate.jp` からCAREへ**明示的なリダイレクト**。ルールの実在・動作確認前は未設定のままにする。

Cloudflare公式：<https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/>

## 3. 3サイトの接続先（取得後のターゲット）

| サービス | 新URL（計画） | 既存の本番 | 作業 |
|---|---|---|---|
| CARE | `https://care.kosodatemate.jp/` | `https://kosuke-saito0807.github.io/mate/` | **リポジトリ `kosuke-saito0807/mate`** のGitHub Pagesにカスタムドメインを設定・所有権確認。DNS `CNAME care → kosuke-saito0807.github.io`（**/mateをCNAME値に入れない**）。GitHub Pages側のカスタムドメイン設定をDNSより先に実施 |
| SPARK | `https://spark.kosodatemate.jp/` | `https://mate-spark.web.app/` | Firebase **`mate-spark`** のHostingで「カスタムドメインを追加」。所有権TXTおよびA/CNAME等は**Firebaseが実際に提示した値**のみ使用 |
| PLAY | `https://play.kosodatemate.jp/` | `https://mate-play-production.web.app/` | 別のFirebase本番 **`mate-play-production`** に設定。SPARKと混同しない。GitHub mainのレビュー済みSHAによるオーナー承認付き本番リリースを保持 |

- GitHub PagesはGitHub Actionsで生成物をデプロイするため、**リポジトリ直下にCNAMEファイルを置くだけでは設定が完了しない**。GitHub Settings → Pages → Custom domain の設定が必要。
- CAREの現在のプロジェクトパス `/mate/` は独自ホストへの変更でルート構成が変わるため、絶対リンク・アセット・GA4・検索ルートを広く検証する。単純な文字列全置換は危険。
- Firebaseのカスタムドメイン所有権を示すTXT値、A値、証明書情報はウィザードで確認。**発行されていないTXT値を作らない**。TLS/SSLがConnectedになるまで公開URLを切り替えない。
- Cloudflareワイルドカード（`*.kosodatemate.jp`）は使用しない。DNSレコードは必要なホストだけ追加。

GitHub Pages公式：<https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>  
Firebase公式：<https://firebase.google.com/docs/hosting/custom-domain>

## 4. 公開前の必須ゲート

- [ ] XServerの登録・支払・自動更新・WHOIS非表示条件確認、CloudflareのNS情報をオーナー側で完了。
- [ ] care/spark/playの正しいサービス・正しいHostingプロジェクト・証明書・HTTPSを確認。
- [ ] CAREの相対パスとフォーム、SPARKのデモ隔離、PLAY静的版と旧PLAY予約・管理CMSの機能差を監査。
- [ ] Google Analytics ID `G-CHXY0DC2WP`、各 `page_view`、必要なイベント送出を確認。
- [ ] 3サイトのcanonical、OG、WebSite構造化データ、内部・相互リンク、robots、sitemapを新URLに同時に更新。
- [ ] メール受信とSheets管理、承認前の掲載ゼロ／権限・掲載意思・内容確認日の条件を維持。
- [ ] Chrome/Safari、PC/スマホ、全主要フォームで実際の送信テスト（本人の操作・同意が必要）。
- [ ] 一般公開後、新Search Consoleの所有権・サイトマップを1回ずつ確認。旧URLでの日次インデックス登録制限の再試行は行わない。
- [ ] 旧URLからのリダイレクトは**各ホスティング元で実際に可能なもののみ**採用し、旧PLAYを勝手に停止しない。
- [ ] GitHubのDraft PR #43（旧PLAYリンク切替）は、静的版の機能差が解消・レビューされるまでマージしない。

## 5. コードで準備済みの読み取り専用チェック

```bash
python3 scripts/mate_domain_cutover_inventory.py --domain kosodatemate.jp
python3 -m unittest discover -s tests -p 'test_mate_domain_cutover.py' -v
```

この`--domain`引数は**候補URLを表示するだけ**。ドメインを所有していると判定しない。DNS、GitHub/Firebase本番、Search Console、公開内容を変更しない。

最初に必要なユーザー操作は **XServerで`kosodatemate.jp`を検索し、取得可能なら登録・決済すること**。その後は購入完了画面の状態・ドメイン名だけ共有してもらえばよい。
