# Koruva 26.3 統合レポート — 2026-11-22

## Source ZIPs

1. `koruva-current-progress-cycle28-2026-11-21.zip`
2. `koruva-fixed-26.3-stage6-vanilla(1).zip`
3. `koruva-26.3-mob-texture-position-fix.zip`

## 統合結果

- Mobfixの26.3レジストリ・テクスチャ・Mob位置補正を維持。
- Stage 6のブロック状態・モデル描画・設置破壊・サーバー状態更新を統合。
- Cycle28の死亡時Item/XP drop、XP pickup、Mob素材ドロップ、モバイル操作、描画性能、保存、ポータル機能を現行構造へ接続。
- 3×3作業台クラフトをクライアントUIとWorker検証の両方に接続。
- 旧形式スキンの左右UV補正、耐久表示、採掘API互換を復旧。

## 検証

- Node `.mjs` テスト（Node strip-types有効）: 327 passed / 327 total。
- JavaScript構文検査: PASS。
- TypeScript構文検査（Node strip-types）: PASS。
- TypeScript完全型検査: BLOCKED（`vite/client` と `@cloudflare/workers-types` の型定義が実行環境にない）。
- Vite / Workers build、ブラウザ、WebGL、Cloudflare実環境のマルチプレイ検証: NOT RUN。

機能の詳細と制限は `INTEGRATION_NOTES.md` を参照。
