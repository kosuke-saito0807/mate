# MATE：kosodatemate.jp 取得・3サービス独自ドメイン移行手順（2026-10-31）

## ステータス：オーナーから購入完了の申告あり／レジストラ・DNSの外部確認は未完了

- 利用者が第一希望を **`kosodatemate.jp`**、レジストラを **XServerドメイン**、DNS管理を **Cloudflare** として承認した。
- 2026-10-31、オーナーから購入完了の連絡があった。前の会話で合意したドメインは `kosodatemate.jp`。ただし、XServerの購入画面・レジストラの登録内容・Cloudflareの有効化状態は接続できていないため、**技術的な所有権検証は未了**。追加の購入を促さない。
- 新ドメインのDNSレコード、ネームサーバー、GitHub Pages設定、Firebase接続、Search Consoleは**未変更**。事前の公開サイトは維持し、旧PLAYの予約・管理機能を停止しない。

## 1. オーナー実施済みと申告：XServerドメイン取得（再購入不要）

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

## 2. 次の作業：CloudflareでDNS管理ゾーンを追加

1. Cloudflareの**Free**プランに実際に取得した `kosodatemate.jp` ゾーンを追加。XServerではレジストラ契約を維持する。
2. Cloudflareが**そのゾーン専用に指定した2つのネームサーバー名**を記録する。値はまだ不明のため推測・固定記載しない。
3. **Cloudflareが取り込んだDNSレコードを先に確認**し、既存MX/TXT/SPF等の必要レコードを残す。XServer「ネームサーバー設定」でCloudflareの2件を**完全一致**で入力する。DS/DNSSECの旧設定がある場合はCloudflare公式手順に従い移行前に整合を確認する。
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

## 2026-10-31 ネームサーバー変更の申告と次のゲート

- オーナーがXServerでCloudflareネームサーバーへの変更を保存したと申告（現時点でCloudflareのゾーンが **Active** になったことや親JPゾーンへの反映は独立検証できていない）。
- Cloudflareがこのゾーンに表示した割当NS：`noel.ns.cloudflare.com` / `ruth.ns.cloudflare.com`。XServerの古い5件ではなく、これら2件だけが登録されているか、XServer画面とCloudflare Overviewで確認する。
- Cloudflare **Overview → Active** を確認する。Pendingなら「Check nameservers now」を押せる場合に実行し、DNSSECの旧DSレコード・NSの一致を確認する。時間経過が必要な場合もある。
- 新規ドメインのDNSレコード0件というCloudflare取込結果は既存メール・Web等の利用がない場合に正常。`kosodatemate@gmail.com` はGmailであり、このドメインのMXは必須ではない。**メールを `@kosodatemate.jp` で使う場合は別途MXが必要**。
- Activeを確認できたら**既存本番に影響しないFirebase Hostingのサブドメイン接続から開始する**。Firebaseコンソールで `mate-spark` → `spark.kosodatemate.jp`、`mate-play-production` → `play.kosodatemate.jp` を個別に追加し、Firebaseが提示したDNSのTXT/A/CNAMEのみCloudflareで **DNS only** 設定で登録。固定値を憶測で作成しない。
- CAREはGitHub Pagesの独自ドメイン設定が必要。GitHub Actionsでデプロイするため**CNAMEファイルだけでは不十分**。Pages設定画面で `care.kosodatemate.jp` を登録したら、Cloudflare DNSに `CNAME care → kosuke-saito0807.github.io`（DNS only）を追加し、HTTPS/旧URLの動作を確認。既存リンクの転送・ルートパス変更に注意。
- 全サイトの証明書/HTTPSが準備できるまではcanonical・内部リンク・検索登録を新URLへまとめて変更しない。フォーム/掲載の許諾、旧PLAYへのリンク切替保留を維持する。

## 2026-10-31 購入申告後の引継ぎメモ

- **オーナーが実施したと報告済み**：Cloudflare Freeゾーン追加、割当NS2件をXServerに設定。**次に必要なのはCloudflareでゾーンが Active と表示されることの確認**（まだ未検証）。
- 移行時にメールレコード（MX・TXT/SPF・DKIM等）がある場合はCloudflareへ引き継ぐ。レジストラ側のDNSSECが有効なら切替前に適切に無効化し、Cloudflare稼働後に再設定する。
- 2件のネームサーバー（例示せず、実際の割当値）とCloudflareでのステータス Active を確認したら、CARE GitHub PagesとSPARK/PLAY Firebaseの**個別のカスタムドメイン設定**に進む。
- ここまでのGitHub編集は**管理用ドキュメントのみ**。既存URL・SEOメタデータ・フォーム・公開データ・本番DNSを変更していない。
