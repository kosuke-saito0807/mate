# MATE SPARK — フェーズ3 開発専用キット（2026-10-23）

**現在の公開サイトと Firebase プロジェクト `mate-spark` には一切変更していません。**

## できたこと

- Firebase Functions v2 の `onCall` 試作（`submitTrialSandbox`, `adminStatusSandbox`）
- `firebase-admin` の Firestore Transaction adapter、管理者確認、掲載契約と体験許諾の二重確認
- 申込重複抑止、定員上限、申込のHMAC識別子を検証するローカルの模擬トランザクション試験
- Firestoreのクライアントアクセスを全面禁止する参考ルール
- `demo-mate-spark-local` に限定したエミュレータ構成（外部接続なし）
- 既存HTML版の単体テストと、HTMLをブラウザのメモリ内に読み込むUIフィクスチャ試験

## 検証結果

| チェック | 結果 |
|---|---|
| Firebase設計／ドメイン／模擬DBの Node.js 単体テスト | 24 / 24 成功 |
| 既存静的版の Python 単体テスト | 29 / 29 成功（元リポジトリの設定ファイルを補足した作業コピー） |
| 静的HTMLのブラウザUIフィクスチャ（PC / 390pxモバイル） | 両方成功。全国47都道府県・デモ12件・5件比較・お気に入り切替・デモ送信不可を確認 |
| Reactお気に入り互換 TypeScript 単体型チェック | 成功 |
| Firebase Emulator / SDKとの実接続 | **未実施**。Firebase CLI・SDKをインストールできない |
| Reactフルビルド／実アプリのブラウザ表示 | **未実施**。依存パッケージ取得不可 |
| 本番への接続・デプロイ・データ移行 | **一切未実施** |

**ブラウザテストは配布済み静的版のHTMLを試験用にメモリ内で読み込み、ネットワークとフォーム送信を遮断したもの。Reactや本番URLのエンドツーエンド試験ではありません。**

## ファイル

- `functions/domain.mjs`：掲載公開・申込入力・契約確認・トランザクションルール
- `functions/firestore-repo.mjs`：Firestore Adminトランザクションの接続境界
- `functions/handlers.mjs`：SDKの検証済みrequestを受けるビジネスロジック
- `functions/index.mjs`：Firebase Functions v2 callable試作、**実デプロイ禁止ガード**付き
- `firebase.json` / `.firebaserc` / `firestore.rules`：`demo-mate-spark-local` 専用のエミュレータ構成
- `test/*.test.mjs`：依存なしのオフライン単体テスト
- `scripts/emulator-smoke.mjs`：SDKインストール後のみ実行するFirestore Emulator専用テスト
- `scripts/browser-baseline.py`：通信遮断・HTMLメモリ試験
- `react-parity-reference/`：React v27の比較／検索／お気に入り差分（**レビュー専用**）
- `docs/SECURITY_AND_GAPS.md`：設計上の未解決事項

## Macでオフライン単体テスト

Node.js 22以降で、このZIPを解凍したフォルダで次を実行します。外部サービスへのアクセスはありません。

```sh
npm test
```

Reactお気に入り互換の型チェック（TypeScript CLI導入済みの場合のみ）：

```sh
tsc --noEmit --lib es2020,dom --target es2020 --strict react-parity-reference/favorites-compat.ts
```

## Macで Firebase Emulator を起動する場合（後の工程）

Firebase Emulator の実行には、Node 22、Java、パッケージ取得可能な開発環境が必要です。

```sh
npm install
(cd functions && npm install)
node scripts/init-local-secret.mjs
npm run emulator:smoke
```

`npm run emulator:smoke` はエミュレータを立ち上げてダミーデータのトランザクションを検査する構成ですが、**この環境では依存が取得できず未検証です**。予めドキュメントとモジュールを確認してください。`firebase deploy` は実行しないでください。

## 本番反映前に必要

1. SDKを導入し、Auth / Functions / Firestore Emulatorで契約承認・権限・同時申込の結合試験。
2. App Checkの本番構成、実際のレート制限、認可、メール送信、監査、保持・削除期間を実装。
3. React v27のプライベートソースを安全な非公開リポジトリでビルドし、API・画像・法務ページを移植。
4. 全国検索、五件比較、Google Sheets連携の機能差分を確認。
5. 現行公開GitHubの個人情報・履歴とドメインに含まれる個人名の問題を整理。
6. 本番の差替えは、すべてテストを終えた後の別途承認時のみ。