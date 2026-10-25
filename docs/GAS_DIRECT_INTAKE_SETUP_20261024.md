# MATE｜FormSubmitを使わない掲載申請受付（導入手順）

**実装日：2026-10-24／最新確認：2026-10-25／状態：CARE・PLAY各運営テストフォームの実申請・非公開保存を実証。SPARKの実送信、本番切替待ち。**
対象：CARE 掲載申請 `contact.html`、SPARK 教室掲載 `spark/partners.html`、PLAY 体験掲載 `play-listing.html`。
保護者向けの `consult.html` と SPARK 体験相談は **まだ従来受付**。本リリースの対象外。


## 2026-10-25　実証結果と残タスク（更新）

### 実証済み
- GAS Webアプリの `doGet` が応答。URLを直接開くと「このURLは申請フォームではありません」は**仕様どおり**。
- NextEdu管理者によるCARE相当の内部QAフォームからの**実POST**成功。発行ID `MATE-WEB-43c607dd-f185-404a-8a57-b134eb29c756`。
- `MATE営業管理DB` の `掲載セルフ申請` A2と `掲載申請連絡先` A2に同じIDがそれぞれ1件登録された（2026-10-25 15:53:59 JST、サービスCARE）。
- PLAY専用運営QAフォームから実POST成功。受付ID `MATE-WEB-677b4626-8de0-49c3-8334-4dfb46502866`。`掲載セルフ申請` A3と `掲載申請連絡先` A3に同一IDがそれぞれ1件、サービスPLAYで登録（2026-10-25 16:27:10 JST）。
- テスト申請 `掲載セルフ申請!Y2` と `Y3` をともに `差戻し`、`AC2` と `AC3` に公開・承認・取次・送客禁止の理由を記録。両方とも公開IDは空欄。
- CARE/PLAY共通の一時的なQAページ `direct-intake-test-20261025.html` と PLAY単独の `play-direct-intake-test-20261025.html` はテスト後に `enabled:false` へ戻し、追加送信を停止済み。
- GitHubブランチ `feat/mate-direct-gas-intake-20261024` の公開設定ファイルは新 `/exec` と公開Turnstile Site keyを保持し、**本番反映防止のため `enabled:false`** のまま。
- CARE/PLAYの内部QAページを用いた送信経路のブラウザ検証はHTTPリクエストを**捕捉して模擬応答**する方式。実書き込みが確認されたのはCARE・PLAYの各1件のみ。SPARKもCloudflareとGASをモックしたFirebaseドメイン模擬ブラウザ検証を追加（実送信ではない）。
- SPARKフォームの電話番号・申請メモはGASが認識する英語フィールド名 `phone`、`message` に修正済み。

### 切り替え前に必須
1. **PLAYの専用QA申請は完了**：GitHub Pagesホストで実POST・Sheets両タブ保存・差戻し・QA停止済み。ただし一般向け `play-listing.html` の本番送信テストは切替時に別途必要。
2. **SPARKの実申請**：`mate-spark.web.app` **実ホスト**から送信する必要あり。Cloudflareのホスト制限とGAS側の `service:SPARK` の検証があるため、GitHub Pagesや任意のpreview別ドメインからの模擬申請は本番接続の証拠にはならない。
3. **本番フォームとの差分再確認**：一般向けCARE/PLAY/SPARKの実ページの必須項目、同意、Turnstile、有効/無効の見え方、携帯ブラウザを確認する。自動テスト通過と本人の実POST成功は別の証拠。
4. **PR #22の現行mainとの統合チェック**：古い差分が混在しているため、PRをそのままマージしない。フォームの本番変更のみを精査して小さなリリースに分ける。保護者相談・SPARK体験相談は対象外（FormSubmitからはまだ移行しない）。
5. **デプロイ確認**：CARE/PLAYはGitHub Pagesの `.github/workflows/pages.yml` でmain更新時に自動デプロイされる。SPARKのFirebaseワークフロー `.github/workflows/firebase-spark-live.yml` は `vars.MATE_FIREBASE_AUTO_DEPLOY_ENABLED == 'true'` の場合のみジョブを実行し、Firebaseサービスアカウントの登録も必要。設定状況はGitHub内の秘密値を見られないため**未確認**。
6. **ロールバックを用意**：切替前の本番コミットとFirebase公開版を控える。問題が起きたら受付を一時停止しメール連絡先を表示、必要に応じ旧バージョンへ戻す。受け付けたSheets行は消去しない。

**個人情報の注意**：`掲載申請連絡先` は「非公開タブ」ではあるが、Google Sheets全体にアクセスできるユーザーからは見える。将来、共同編集権限を広げるなら**別の閲覧制限付き台帳への分離**が必要。

## 結果のしくみ

```
CARE / SPARK / PLAY（公開フォーム）
  └─ Cloudflare Turnstile（ブラウザ認証）
  └─ 通常の POST（CORSが不要）
       └─ 専用アカウントの Google Apps Script Webアプリ /exec
          ├─ Cloudflare Siteverify（サーバー側必須）
          ├─ 入力値検証・ハニーポット・90秒再申請制限・受付ID重複除外
          ├─ Google Sheets「掲載セルフ申請」へ「未審査」で保存
          ├─ Google Sheets「掲載申請連絡先」へ担当者の連絡先を別保存
          └─ 書き込み成功後だけ、専用の受付番号付き完了画面
```

保護者情報は取り込まない。掲載申請の担当者情報は非公開の事務局用台帳のみ。投稿者に公開許諾権限があること、事業者の本人性、正式な契約と体験取次同意は、別途レビューを行う。**送信直後の自動公開・営業送信・教室への個人情報転送は行わない**。既存申請タブと営業DBのレコードは削除しない。

## 1．専用Gmailで Apps Script を作成（所有者操作が必要）

1. `kosodatemate@gmail.com` で <https://script.google.com/> にログイン
2. **新しいプロジェクト** → 名前を `MATE 直接掲載受付` にする。旧 `mate_self_service.gs` と **別の** プロジェクトを作る（複数 `doPost` 競合を避ける）
3. `scripts/mate_direct_intake.gs` をすべて新しい `コード.gs` に貼り付けて保存
4. **プロジェクトの設定 → スクリプト プロパティ** で秘密のキーを登録：
   - 名前 `MATE_TURNSTILE_SECRET`
   - 値：Cloudflare Turnstileの **Secret key**。**GitHubやブラウザJSには絶対に書かない**
5. エディタ上部の関数選択から `setupMateDirectIntake` を選び「実行」。Google Sheetsへのアクセス権を付与
6. 成功すると既存の `MATE営業管理DB` に「掲載申請連絡先」タブを作り、既存「掲載セルフ申請」の29列との整合性を検査する。**途中でエラーになったらWeb公開しない。**
7. 右上「デプロイ」→「新しいデプロイ」→「種類：ウェブアプリ」を選択し、**実行するユーザー：自分（kosodatemate@gmail.com）、アクセスできるユーザー：全員**。許可を確認
8. 生成されたURL `https://script.google.com/macros/s/.../exec` をコピーする。**/dev ではなく /exec** を使う

公式 Apps Script Webアプリヘルプ：<https://developers.google.com/apps-script/guides/web>

## 2．Cloudflare Turnstile を作成

1. <https://dash.cloudflare.com/> から Turnstile → 「ウィジェットを追加」
2. 利用するホストを `kosuke-saito0807.github.io` および `mate-spark.web.app` にする（PLAYの現行 **掲載ページ** はGitHub Pages）
3. 発行される **Site key**（公開用）と **Secret key**（非公開用）を区別する
4. Secret key は上記の Apps Script スクリプトプロパティだけに保存する

ブラウザのtokenだけでは不十分。Apps Script側で `https://challenges.cloudflare.com/turnstile/v0/siteverify` の認証結果、アクション `mate_listing`、サービスごとのホスト名を**必ず**検証する。認証できなければ書き込まない。

公式 Turnstileヘルプ：<https://developers.cloudflare.com/turnstile/get-started/>

## 3．サイト側の公開用設定（URLと公開キーのみ）

次の **2つ** のファイルの3項目を設定する：

- `assets/mate-direct-intake-config.js` ← CARE / PLAY GitHub Pages 共通
- `spark/assets/mate-direct-intake-config.js` ← SPARK Firebase Hosting

```js
window.MATE_DIRECT_INTAKE = Object.freeze({
  enabled: true,
  endpoint: "https://script.google.com/macros/s/本番のID/exec",
  siteKey: "Cloudflareの公開Site key"
});
```

この値は公開情報であり、秘密鍵やGoogle認証情報ではない。**未設定の間は `enabled:false` のままで、開発ブランチ上では送信不可**。公開中の `main` は従来版に残す。

## 4．本番切替の確認手順

1. パスワードや子どもの情報を入力せず、**自分が管理する事業者名**でCARE / SPARK / PLAYを1回ずつテストする。Test用の申請は掲載未承認にする
2. 各画面から送信後、Apps Script提供の「申請を受け付けました」「受付番号」が表示されること
3. 非公開Sheetsの「掲載セルフ申請」に各サービス **未審査** で1件ずつ記録され、審査担当者・公開ID・承認欄は空のままなこと
4. 「掲載申請連絡先」タブに同じ受付IDで連絡先があり、**公開JSONやGitHubには含まれていない**こと
5. 同じ受付IDの重複書き込みが発生しないこと。Turnstile失敗・URL不正・同意チェックなしでは書き込まないこと
6. 実サイトで初めて通信を確認してから `main` へのマージとSPARK Firebaseデプロイを行う。影響範囲を確認し、戻せるよう現行 `main` のSHAを記録する
7. テスト行は「差戻し」などの非公開ステータスにして、外部公開しない

**注意：CARE・PLAYの運営QAフォームで実POSTと保存は確認済み。SPARKの実POSTと3サービスの一般向けフォーム切り替えは未実施。**

## 管理情報と安全上の制約

- Google SheetsのIDは既存の `MATE営業管理DB` を指定。専用Gmailには既存Sheetsの編集権限があることを再確認する
- 追加の「掲載申請連絡先」は**同じ非公開ワークブック内**なので、ワークブックに閲覧権限がある共同編集者にはこのタブも見える。より厳格な分離が必要なら独立の制限付きGoogle Sheetsへ移す
- Apps Script公開Webアプリは誰からでもPOSTできるため、Turnstileと申請の審査状態チェックを切らない。IPレート制限の代替となる90秒のメールアドレス単位の制限は完全な迷惑投稿対策ではない
- 旧 `mate_self_service.gs` のGmail取込はそのまま残るが、**直接投稿のWEB受付はGmail本文を生成しない**。レガシー列「GmailメッセージID」に `WEB-...` という受付証跡IDを置き、旧ロジックの照合に利用する。いずれカラムを正式名称へ移行する際は旧トリガーと列名検証を同時に直す
- 既存の「承認」処理は人の審査が必要。SPARKの正式契約・体験取次許諾、PLAY CMSの掲載公開には別の処理が残る
- 受付日時・審査状態は現行Sheetsで管理。名前と返信先は運営だけが使い、外部送信・公開データ変換へ混入させない
- 本コードの検証は Node mock による確認。**CARE・PLAY内部QAフォームで実送受信テストは成功。SPARK実ページとCARE・PLAY一般向けフォームでの送受信は未実施**。GitHub Actionsで `node tests/test_mate_direct_intake.cjs` を実行できる
