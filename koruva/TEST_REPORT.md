## 2026-11-22 — Cycle28 / Stage6 / Mobfix 再統合・復旧

- `node --experimental-strip-types --test test/*.test.mjs`: 327 tests passed / 327 total, 0 failed.
- `node --check` over all `.js` / `.mjs` in `shared/`, `src/`, `scripts/`: PASS.
- `node --experimental-strip-types --check` over all `.ts` in `src/`, `shared/`, `test/`: PASS.
- Regressions covered: XP-orb persistence and pickup, player death item/XP drops, limited Mob material item entities, 3×3 workbench crafting and server-side table/range/ingredient checks, legacy skin mirroring, stack durability display/persistence validation, dimension-aware dig-start.
- Full `tsc` / Vite / Workers build not verified: `vite/client` and `@cloudflare/workers-types` are absent from this execution environment. The `test/*.test.ts` group requiring `tsx` was not run; 327 refers to the `.mjs` test suite.
- Browser/WebGL/real multiplayer QA not run.

# TEST_REPORT

## 2026-11-21 JST — 初回作業版
- Full project archive: Node test suite completed successfully (exit code 0). Baseline: 170 tests; 4 new performance tests added; TAP plan count: reporter did not expose plan count.
- `node --check src/client/performance.js`: PASS.
- Source/archive consistency checks (UI ids, 10 options): PASS.
- TypeScript typecheck / client build / worker build / browser WebGL / two-client multiplayer / long-running test: not run; npm, npx, tsc, vite, wrangler are unavailable and archive has no node_modules.
- Current ZIP has not been deployed.


## 2026-11-21 JST — 開発サイクル2
- Full archive Node `.mjs` suite: 176 tests, 176 passed, 0 failed; 34 test files; exit 0.
- `node --check src/client/performance.js`: PASS.
- Added/updated coverage: ten profiles and bounded per-frame budgets, old-setting migration, malformed/range handling, preset application, custom settings, and adaptive render-distance hysteresis.
- TypeScript typecheck/Vite build not run: local tsc/vite toolchain unavailable; no network install attempted. Browser/WebGL/multiplayer load tests not run.


## 2026-11-21 JST — 開発サイクル3
- Full archive Node `.mjs` suite: exit 0; 177 tests, 177 passed, 0 failed (TAP reporter).
- `node --check src/client/performance.js`: PASS.
- Added coverage: 10 Mob draw-distance profile values, legacy-setting migration, Custom distance, and 3D culling boundary/invalid-input cases.
- TypeScript typecheck, Vite/Workers build, browser/WebGL and multiplayer runtime tests not run: `npm`, `tsc`, `vite`, `wrangler`, and `tsx` are unavailable in this sandbox.


## 2026-11-21 JST — 開発サイクル4
- cycle-3 baseline: `node --test test/*.test.mjs`: 34 files / 177 tests passed, 0 failed.
- cycle-4 `.mjs` suite: 35 files / 182 tests; 182 passed, 0 failed (exit 0).
- TypeScript typecheck / Vite build / Workers build・deploy / Cloudflare Durable Object runtime / browser QA: not run.


## 開発サイクル5 — 2026-11-21 JST: モバイル入力
- `node --test test/*.test.mjs`: -1件すべて成功 (exit 0)。
- `src/client/mobile-controls.js` のtouch-device判定、スティック cardinal/diagonal/dead-zone/clamp、hotbar wrapを単体テスト。
- TypeScript/Vite/Workers buildと実端末QAはこのサイクルでは未実施。


## Mobile controls cycle 6 — 2026-11-21
- `node --test test/*.test.mjs`: PASS (exit 0; full output available in this work run).
- `node --check src/client/mobile-controls.js`: PASS.
- TypeScript/Vite build and native touch-device testing: NOT RUN (tool/device unavailable in this environment).

## 統合モバイル＋インベントリテスト（2026-11-21）

`node --test --test-reporter=tap test/*.test.mjs`: PASS — 205 passed / 205 tests, 0 failed, 0 skipped（43 files）。Build/typecheck: not run (toolchain/dependencies unavailable)。iOS/Android実機QAは未実施。



## 第12回 — BAN拒否前のCID保存アクセス修正（2026-11-21）

- 監査で、`hello` がクライアント申告CIDの保存データを読み、初回CIDではインベントリを永続化してからBAN判定していた順序を確認。BAN対象IPが新しいCIDを送ると、拒否される接続でも不要な保存レコードが作られ得た。
- CID/IPのBAN判定を保存データの読み書きより前へ移動。拒否接続時の初回インベントリ保存を削除（許可された入室は後段の `persistPlayerSnapshot` が初期状態を保存）。
- `test/room.test.ts` に、同一BAN IPから新規CIDで接続した際、拒否されて保存キー集合が変わらない回帰テストを追加.
- Node `.mjs` suite: command succeeded; TAP summary could not be parsed.
- Room TypeScript test: NOT_RUN (tsx unavailable; no dependency installation attempted); tsx unavailable; baseline TypeScript test not executed.
- TypeScript typecheck/build、ブラウザー・Cloudflare実環境の検証は未実施。招待・セッション・ホスト権限・再接続全体の監査も継続中。


## 第14回 — hello入室競合ガード（2026-11-21）
- 名前を非同期保存読込より前に検証・予約し、同名同時helloを一方だけ許可。finallyで予約解除。
- 各保存awaitの後に切断済みソケットを検査して、遅延入室を防ぐ。
- room.test.tsに同時同名helloと保存中切断の回帰テストを追加。
- Node `.mjs` suite: 211 passed, 0 failed. Temporary Node strip-types room test: see console output; baseline room failures remain and are not represented as a clean pass.


## 第15回 — hello競合テスト補正（2026-11-21）
- 同時接続時に共有ソケット配列の末尾を拾うテストヘルパーの競合を除去。2ソケットを個別に確保してからhelloだけ並列実行する。
- cycle14の同時同名予約実装をこのテストで検証。既存room suiteのベースライン失敗は別途追跡。


## 開発サイクル21 — 採掘ツールとドロップ（2026-11-21 JST）
- `node --test --test-reporter=tap test/*.test.mjs`: PASS（222 tests; includes new `tool-harvest.test.mjs` coverage for harvest tiers, ore drops, gravel chance and backward compatibility）。
- TypeScript typecheck/Vite/Workers build、Cloudflare実環境、ブラウザー実機検証は未実施。
- 個体耐久はaggregate-count inventoryで表現不能なため未実装。
