# MATE CARE / PLAY: Google Apps Script への家族向け相談移行

状態：**レビュー中。まだ本番フォームには反映していません。**

## 構成
- FormSubmitを廃止し、掲載申請用に現在使っているGoogle Apps Scriptの同じWebアプリへネイティブPOSTする。
- Cloudflare Turnstileのアクション「mate_consult」をサーバー側で検証。
- 相談者の返信用メール・電話・氏名・相談本文は運営用メール kosodatemate@gmail.com へMailAppで通知する。
- Google Sheets「MATE営業管理DB」の既存「問い合わせ管理」シートに受付ID・日時・サービス・種別・受付状態だけ保存。個人情報や相談本文は転記しない。
- プライバシーポリシーへの同意を、事業者への第三者提供同意と混同しない。
- 受付完了画面はGmail通知処理とSheet記録が成功した場合だけ表示する。
- 掲載申請用の既存処理はそのまま残す。

## オーナー操作（レビューとCIが合格した後）
1. Googleで kosodatemate@gmail.com にログインし、https://script.google.com/home/projects を開く。
2. **今すでに掲載申請を受け付けているWebアプリのApps Scriptプロジェクト**を開く。新しいプロジェクトは作らない。
3. GitHubのPR #27の scripts/mate_direct_intake.gs の全文を、対象プロジェクトの既存 Code.gs の内容と置き換えて保存。重複した doPost 関数を残さない。
4. プロジェクト設定のスクリプトプロパティに MATE_TURNSTILE_SECRET があることだけ確認。値やパスワードを共有しない。
5. エディターで setupMateDirectIntake を1度実行し、要求されるスプレッドシート操作・MailAppによるメール送信権限を kosodatemate@gmail.com として確認・承認する。失敗したら公開しない。
6. 「デプロイ → デプロイを管理 → 現在の掲載申請用ウェブアプリ → 編集（鉛筆）→ バージョン：新しいバージョン → デプロイ」を実行。実行ユーザーは「自分」、アクセスは「全員」。**今まで使っていた /exec URL を維持**する。
7. GitHub PR #27 を公開側 main にマージするのは、既存掲載申請の互換テスト・GAS更新が完了してから。mainへのマージでGitHub Pagesが更新されるため、先にマージしない。
8. 新フォーム https://kosuke-saito0807.github.io/mate/consult.html?service=PLAY から運営内部の相談テストを1回だけ送信。結果画面の受付番号と、Google Sheetsの「問い合わせ管理」の1行および kosodatemate@gmail.com に届く「【MATE受付】PLAY 家族向け相談...」のメールを照合する。
9. CAREも必要なら service=CARE の相談として別途テストする。複数送信を繰り返さない。

## 安全チェック
- 公開前は旧MATE PLAY ChatGPT Sites、SPARK、CARE、Firebase TESTは変更しない。
- 既存の掲載申請が引き続き動作することを確認する。
- 不正なチャレンジ・送信種別・不正ヘッダー・スパム・重複受付番号・不正な入力は拒否する。
- 新コードは日次メール送信数などApps ScriptとGoogleアカウントの制限の影響を受ける。
- このリポジトリには秘密鍵・Apps Scriptアクセストークンは一切書かない。

## 開発者の検証コマンド

    node tests/test_mate_direct_intake.cjs
    node tests/test_mate_family_consult_intake.cjs
    python3 -m unittest discover -s tests -p test_family_consultation.py -v

これらは模擬環境のテストで、実受信を確定させるものではありません。