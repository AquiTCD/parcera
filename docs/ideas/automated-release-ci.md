# [Idea] Automated Release Pipeline (GitHub Actions)

## 概要
`Parcera-0.0.0-arm64.dmg` などのリリースバイナリのビルドと配布を、GitHub Actions を使って完全に自動化する。
手動ビルドの手間を省き、誰でも（環境を選ばず）安定したバイナリを生成・取得できるようにする。

## 課題
- ローカル環境（M1 Macなど）に依存したビルドになっている。
- バージョンアップのたびに手動で `npm run package` を叩くのが面倒。
- リリース物の履歴管理がコードベースの外で行われがち。

## 解決策: CI/CD パイプライン
GitHub Actions を導入し、以下のフローを構築する。

1.  **トリガー**:
    - `v*` タグ（例: `v0.1.0`）がプッシュされたときに自動起動。
    - または、手動（workflow_dispatch）での実行。
2.  **ビルドジョブ**:
    - macOS ランナーを使用して `electron-builder` を実行。
    - Apple Silicon (`arm64`) と Intel (`x64`) 両方のバイナリを生成（Universal形式も検討）。
3.  **アーティファクト配布**:
    - 生成された `.dmg` ファイルを GitHub Releases に自動アップロード。
    - リリースノートの自動下書き作成。

## メリット
- **再現性**: 常にクリーンな環境でビルドされるため、「自分の環境では動くのに」を防げる。
- **配布の容易さ**: ユーザーや開発者が GitHub の Releases ページから最新版を直接ダウンロードできる。
- **効率化**: 開発者はコードを書いてタグを打つだけで、リリース作業が完結する。

## 実装上の考慮点
- **Code Signing**: macOS での配布には Apple Developer 証明書による署名（Notarization）が必要になる場合がある。
- **依存関係**: Python サイドカー（`site-packages` やバイナリ）の同梱処理を CI 環境でも正しく再現する必要がある。
- **ランナーコスト**: macOS ランナーは GitHub Actions の料金が高い（または無料枠の消費が早い）ため、最適化が必要。

## 次のステップ
- [ ] シンプルな GitHub Actions ワークフロー (`.github/workflows/release.yml`) のプロトタイプ作成。
- [ ] タグプッシュをトリガーとしたビルド・アップロードの検証。
- [ ] 必要に応じて証明書等のシークレット（GitHub Secrets）設定。
