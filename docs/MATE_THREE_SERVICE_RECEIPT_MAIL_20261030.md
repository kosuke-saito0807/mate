# MATE CARE / SPARK / PLAY 自動受付確認メール導入（2026-10-30）

## 対応範囲

- 一般利用者の相談：共通 `consult.html?service=CARE|SPARK|PLAY` → 既存の Apps Script `doPost` → 非公開「問い合わせ管理」→ 運営Gmail通知 → 申込者本人への自動受付確認メール。
- 事業者の掲載申請：既存の3サービス直接掲載申請 → 非公開「掲載申請連絡先」「掲載セルフ申請」→ 申込者本人への自動受付確認メール。**掲載審査・公開・契約・事業者への取次ぎは一切自動化しない**。
- SPARK「教室をまとめて体験相談する」は、実在教室の契約・取次許諾・実受付の整備まで引き続き **OFF**。一般的な習い事の相談フォームのみ今回提供。

## メール設計・運用上の注意

- 申込者向けメール：受付番号、サービス名、受付した事実、注意事項、運営窓口だけを送る。**申込者の氏名・電話・相談本文・お子さまの情報や事業者連絡先は転載しない**。
- 返信先は `kosodatemate@gmail.com`、送信元は同アカウントで実行される Web アプリの `MailApp`。
- 既存受付IDの再送は新たなメールを送らない。Turnstile、同意、90秒のレート制限、運営者権限、非公開Sheetの審査状態を維持。
- APIがメール送信を受け付けても、**最終的なメール到着までは保証しない**。Sheet の内部メモに `自動受付メール送信API:成功/失敗` を記録。
- 家族向け相談：事務局通知が成功した後で「受付」とし、その後の自動返信エラーは受付を取り消さない。掲載申請も保存済みの申請を返信失敗で破棄しない。
- 自動返信の件名には連続した `MATE CARE` / `MATE SPARK` / `MATE PLAY` を含めず、旧Gmail取込スクリプトが自動返信を新しい申込として誤記録することを防止。

## 本番反映（所有者のみ／安全な順序）

1. GitHub PRの `scripts/mate_direct_intake.gs` と、Apps Script の「MATE 直接掲載受付」現行コードを比較。既存の独自変更があれば差分を取り込み、誤って上書きしない。事前にコピー/バージョン保存。
2. `kosodatemate@gmail.com` の [Apps Script](https://script.google.com/home) で既存の **MATE 直接掲載受付** を開き、既存の `doPost` の定義を二重化せず今回のコードへ置き換える。プロパティ `MATE_TURNSTILE_SECRET` を公開しない・削除しない。
3. 保存後、**デプロイ → デプロイを管理 → 現在使用しているWebアプリの編集 → バージョン「新しいバージョン」→ デプロイ**。既存の実行ユーザーが自分、アクセスが全員であることを確認。新しい別URLを作らず、`assets/mate-direct-intake-config.js` の既存 endpoint を変えない。必要なら MailApp の再認可を行う。
4. まずCAREまたはPLAYで本人向けの受信＋運営通知＋Sheets受付番号の一致を1件確認。**同じメールアドレスへの短時間連続投稿は90秒制限される**ので、前のテストの直後に連続送信しない。
5. テストが通ったらこのPRのフロントエンドをマージして GitHub Pages を更新。SPARK一般相談URL `https://kosuke-saito0807.github.io/mate/consult.html?service=SPARK` でテスト。
6. SPARK本番サイトの相談リンクを表示するには、`spark/index.html` の変更を **Firebase Hosting本番 `mate-spark` に別途反映**。GitHubマージだけでは反映保証なし。
7. SPARKとPLAYの掲載申請についても、必要ならテスト用の**架空であることが明らかな**入力で申込者受信と未審査保存を確認し、絶対に公開承認しない。テスト申請は運営で差戻し/処理済みにする。
8. アカウント権限・MailApp・Sheets・Turnstileの変更により不具合が起きた場合は Apps Script「デプロイを管理」で前バージョンに戻す。PLAY元SitesやFirebase TESTの停止・転送はしない。

## 回帰試験（いずれも実送信なし）

- `node tests/test_mate_family_consult_intake.cjs`
- `node tests/test_mate_direct_intake.cjs`
- `python -m unittest tests/test_family_consultation.py`

**状態**：GitHubコード変更とモック検証を準備。Google Apps Scriptの本番反映・利用者Gmail実着信・SPARK Firebase実反映は運営者の操作と確認が必要。