# KORUVA_ARCHITECTURE — 現行構成と目標境界

## 現行構成（コードを確認した範囲）
- **Client:** `src/client/main.ts` がゲームループ/UIを統合。Three.js描画、`World`/`ChunkView`、`physics.ts`、`Net`、`ui.ts`、Mob/Drop表示などに分割。
- **Worker/server:** `src/worker/index.ts` がHTTP/WebSocket routing。Durable Object `room.ts` がroom state、validation、player/block/mob operations、保存/同期を担当。
- **Shared:** `shared/` にprotocol、blocks、gameplay、combat、vitals、dimensions、world data helpers等。
- **Persistence:** room/server stateはDurable Object storage、solo/profile/settingsはブラウザlocalStorage等。保存対象の全カテゴリを網羅しているとは言えない。
- **Tests:** `test/*.test.mjs` はNodeの組込みテストランナーで実行可能。TypeScript tests/buildは依存導入と実行環境を別途用意する必要がある。

## 設計原則
1. クライアントは入力、予測、表示を担当し、ルーム状態・権限・アイテム/ブロック変更の確定はサーバー側で検証する。
2. 描画設定はクライアント限定。FPS最適化でMob AI、液体、redstone、権限などのサーバーシミュレーションを止めない。
3. 共通データ形式・validationは`shared/`に集約し、UI/描画コードからゲームルールを分離する。
4. 保存形式の変更はversion/migration、atomicity、backup/restoreのテストを伴わせる。
5. リソースの由来・ライセンスを記録し、検証できない素材を新規配布しない。

## 拡張候補（未完了）
- server-side authoritative inventory transaction service、session/auth、room access policy。
- chunk/storage migrationとbackup/restore test harness。
- rendering capability discoveryと段階的 graphics settings。現サイクルの10段階はrender distanceのみ適用。
- item/block/entity definitionsをデータ駆動化し、実装済み挙動と参照データを明示的に区分。


## 2026-11-21 performance profile update
The client-side quality profile now controls `ChunkView.update` generation and mesh job caps per frame, alongside render distance. These are presentation/loading budgets only; server simulation cadence is intentionally unaffected. Current caps remain modest (generation 1–2, meshing 1–3 jobs/frame); shader features and hardware capability detection remain open work.
