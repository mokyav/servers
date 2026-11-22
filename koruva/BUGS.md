# BUGS / 確認事項

## 再現済みの不具合
- このサイクルの対象機能で再現済みの失敗はなし（新しいunit testsと既存Node suiteの結果は`TEST_REPORT.md`）。

## 未検証リスク（不具合がないという意味ではない）
- TypeScript typecheck、Vite build、Workers deploy、実ブラウザ/WebGL、複数クライアント同時接続は未実施。
- 描画負荷自動調整はFPSのみの単純heuristicで、GPU/CPU/memory/network/chunk generationを測定しない。Mob描画距離はクライアント表示のみで、WebGL実機視認性は未確認。
- 参照ZIP由来と記載された画像等の配布ライセンスは未確認。
- 完成仕様の大半（全Mob、全block/item, village, dimensions, redstone, storage backup/auth等）が未実装または未検証。

## 調査時に注意
- 以前の限定抽出でのテスト数と全ZIPテスト数が異なる報告があった。基準は全ZIPを展開して実行した結果のみとし、今回も同じ方法を使う。

## 開発サイクル4 — 保存データ
- プレイヤー状態はバージョン付きsnapshotへ統合し、旧3キーを互換ミラーとして同じtransactionで更新する実装とmock storage testsを追加。Cloudflare実環境での停止・再起動・復旧試験は未実施のため、運用上の耐障害性を確認済みとはしない。


## Mobile controls known limitations (cycle 6)
- Native hardware/browser verification has not been performed in this environment.
- The game movement core currently has sprint mapped to Shift and no crouch state; the mobile button is labeled ダッシュ rather than claiming to crouch.
