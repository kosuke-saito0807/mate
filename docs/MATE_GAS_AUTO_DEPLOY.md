# MATE GAS：GitHubから自動更新（初回だけ設定）

main に営業自動化コードの変更が入ると、GitHub Actions が既存GASプロジェクトに変更を同期します。対象コード：scripts/mate_auto_ops_v4.gs。

## 既存コードを保護する設計

clasp push はGASプロジェクト全体を書き換えます。そのためワークフローは (1)既存GASの全ソースをpull (2)GAS全ファイルをGitHub Actionsランナーの一時領域で保持（アーティファクトや公開ログには出さない） (3)V4専用ファイル1件だけを置換 (4)他ファイルが変わっていないことを検査 (5)全体をpush という順番で動きます。必要なV4専用ファイルが見つからない場合や複数ある場合は、push前に失敗して止まります。

Webアプリの新デプロイは作らず、既存GASのHEADコードだけを更新します。時間ベースのトリガー、スクリプトプロパティ、他の受付・審査・通知ファイルは変更しません。ただしpullとpushの間に他の人が編集すると競合するため、今後V4の編集はGitHubで行ってください。

## 一度だけ必要な操作

1. MATE運営用Googleアカウント（kosodatemate@gmail.com）で https://script.google.com/home/usersettings を開き、Apps Script APIを有効にします。
2. 今まで mateAutoOpsV4Cycle を実行していたGASの「プロジェクトの設定 → ID → スクリプトID」を取得してください。営業DBのスプレッドシートIDではありません。別の受付・通知・公開プロジェクトを選ばないでください。
3. 自分のMacのターミナルで、Node.js 20以降を入れた上で以下を実行してください。

~~~bash
npm install --global @google/clasp@3
clasp login
~~~

4. 認証画面では必ず kosodatemate@gmail.com を選びます。作成された ~/.clasprc.json は秘密のGoogle認証情報です。チャット、メール、GitHubの通常ファイルには絶対に貼り付けないでください。
5. https://github.com/kosuke-saito0807/mate/settings/secrets/actions の New repository secret から次の2つを登録します。

| Secret名 | 値 |
|---|---|
| CLASPRC_JSON | ~/.clasprc.json の JSON全文 |
| CLASP_JSON | **GASのスクリプトIDだけをそのまま貼り付ける**（JSON形式も対応） |

GitHub Secretの入力欄には、GASのプロジェクト設定からコピーしたスクリプトIDの文字列だけを貼り付けてください。`{"scriptId":"..."}` のJSONを手で作る必要はありません。長いGAS編集画面のURL、スプレッドシートID、`JSON` というラベル、説明文などを貼らないでください。

macOSでは次のコマンドで認証JSONをコピーできます。コピー先は必ずGitHub Secretsの入力欄にしてください。

~~~bash
cat ~/.clasprc.json | pbcopy
~~~

6. https://github.com/kosuke-saito0807/mate/actions/workflows/mate-gas-sync.yml を開き、Run workflow → main → Run workflow を1回実行してください。
7. Actionsの Check JavaScript syntax / Pull existing live project / Replace dedicated V4 file only / Sync full preserved project to GAS HEAD がすべて緑になれば自動同期の初回成功です。失敗しても、エラーを確認せずに別のスクリプトIDを試さないでください。
8. GASの diagnoseMateV4Health で active=true、phase=DAILY_30、pilotDailyCap=30 のままであることを確認してください。送信履歴・スクリプトプロパティ・トリガーは通常のコード同期では意図的に変更されません。

## 以後の運用

GitHub main 上の scripts/mate_auto_ops_v4.gs、scripts/ci/prepare-mate-gas-deploy.mjs、またはGitHub Actionsワークフローが変更されると自動同期します。手動でGASコードを貼り替える必要はなくなります。GitHub Secretsは初回の登録およびGoogle OAuthの失効時の更新だけ必要です。

- 対象は営業V4のあるGASプロジェクト1つ。CARE/SPARK/PLAYのWebサイトや、別の審査・受付・通知GASプロジェクトはこの仕組みでは自動更新しません。
- このリポジトリが公開設定でもGitHub Secretsの認証情報が公開ソースに入ることはありません。GAS本体の全ソースもアーティファクトとしては公開しません。
- 認証情報が漏れた疑いがあればGoogle側のアプリ認可を取り消し、再ログインしてGitHub Secretsを再設定してください。
- このチャットで認証JSONやトークンの提示を求めることはありません。
- GitHub ActionsにGitHub Secretsを登録できる連携権限は現状ないため、所有者によるこの初回1回の作業は残ります。

公式ドキュメント：https://developers.google.com/apps-script/guides/clasp
