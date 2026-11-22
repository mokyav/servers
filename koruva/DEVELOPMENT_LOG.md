# DEVELOPMENT_LOG

## 2026-11-21 JST — 統合初回調査と描画負荷設定の初期スライス
- 添付Koruva作業版と`client.zip`を調査。`client/version.json`で参照版26.3/world version 5023を確認。アーカイブはデータ/資産ファイル中心で、全挙動を調査したとは言わない。
- 全Koruva ZIPを展開してNodeの既存33個テストファイルを実行し170件合格を確認。npm/tsc/vite/wranglerは環境に無く、build/typecheckは未実行。
- 必須5資料に加えて`TODO.md`,`BUGS.md`,`TEST_REPORT.md`を追加。
- 既存は描画距離3–12と視点感度のみだったため、10段階profileとCustom表示、opt-in FPS hysteresisを実装。手動描画距離変更はCustom化しautoを解除。現時点では描画距離だけを制御し、server simulationには触れない。
- 新規4 unit testsを追加。実行・結果は`TEST_REPORT.md`。
- 未完: 10レベル各項目の完全対応、shader capability probing、AI自動最適化、ゲーム全機能/実機検証。

### 次回再開手順
1. このファイル、`TODO.md`, `BUGS.md`, `TEST_REPORT.md`, `IMPLEMENTATION_STATUS.md`を読み、添付の最新ZIP/作業ツリーと差分を確認。
2. まずローカル依存が利用可能なら`npm test`, `npm run typecheck`, `npm run build`を実施。
3. 未確認の型/ビルド修正後、次の優先タスクをTODOから選び、関連unit/integration testsを追加。


## 2026-11-21 JST — 開発サイクル2: チャンク処理予算
- cycle 1の作業版から再開し、`ChunkView.update`に既存の生成/メッシュ予算引数がある一方、ゲームループでは固定値(通常2/3、読込6/6)だったことを確認。
- 10段階profileへ `chunkGenBudget` と `chunkMeshBudget` を追加し、通常/ロード中の両方で設定値を使用。処理上限は生成1–2、メッシュ1–3件/フレームに限定し、サーバーシミュレーションには接続しない。
- 旧localStorage設定の予算値を距離/レベルから補完。TypeScript module import用の宣言を追加。FPS適応は従来どおり描画距離だけ。
- Node mjs suite: 176 / 176 passed (exit 0); `node --check src/client/performance.js` PASS.
- TypeScript typecheck/Vite build not run: local tsc/vite toolchain unavailable; no network install attempted. ブラウザ/複数人実機試験も未実施。
- 未完: チャンク先読み/エンティティ描画距離、GPU capability/shader、広範なゲーム機能統合。


## 2026-11-21 JST — 開発サイクル3: Mobクライアント描画距離
- 10段階プリセットにMob描画距離(16〜96ブロック)を追加し、設定UIから確認・手動変更できるようにした。古い設定に値がない場合はプリセット/描画距離から既定値を補完し、不正値は範囲内に制限。
- Mobモデルの可視性だけをクライアント側で3D距離カリング。サーバーAI、自然スポーン、同期、死亡処理は距離設定で停止しない。
- `test/performance.test.mjs`で10段階値、設定移行、Custom設定、距離境界をカバー。詳細は`TEST_REPORT.md`。
- 未確認: TypeScript typecheck、Vite/Workers build、ブラウザ/WebGL視認性、サーバー実シミュレーション負荷。


## 2026-11-21 JST — 開発サイクル4: プレイヤー保存スナップショット
- TODOのP0にある保存スキーマ移行を優先。従来は位置(loc:), vitals(p:), inventory(i:)を独立キーで読書きしていたため、途中失敗で異なる時点の値が混ざり得た。
- `shared/player-save.js`にschema v1 snapshot、旧3キーからのfallback/migration、一部フィールド更新時のread-merge-writeを追加。snapshotと後方互換キーをDurable Object storage transactionで一括保存。
- Room joinはBAN/名前検証を通過してから保存を移行。既存の位置・vitals・inventory normalizerを通したcanonical snapshotを保存し、移動/体力/所持品の永続化もhelperへ接続。
- migration、破損snapshotからのlegacy fallback、snapshot優先、部分更新、transaction rollback、Room配線のunit testsを追加。
- 未完: world-level backup/restore、Cloudflare実環境でのcrash/restart、multi-client item integrity、typecheck/build/deploy/browser QA。


## 2026-11-21 JST — 開発サイクル5: モバイル操作
- タッチ端末ではPointer Lockを要求せず、ゲーム再開もタッチ操作向けに切替。従来のキーボード入力と同じ移動キー集合へ仮想スティックを統合し、Canvas上のドラッグで視点を操作する。
- 画面上にジャンプ、しゃがみ、採掘/攻撃、使用/設置、インベントリ、一時停止を追加。既存のブロック破壊・設置・Mob攻撃メソッドを呼び出し、入力を二重実装しない。ホットバーは既存スロットをタップ選択できる。
- pointer capture/cancel/blurで押しっぱなし入力を解除し、safe-area対応・狭い画面用CSSを追加。純粋なタッチ判定、スティック方向、ホットバーindexのNodeテストを追加。
- 未確認: TypeScript/Vite build、実端末でのブラウザ/画面回転/同時マルチタッチ/操作感・誤タップ。


## Mobile controls cycle 6 — 2026-11-21
- Hardened touch input lifecycle: single active look pointer, radial joystick clamping, pointer-capture cleanup, and release of held actions on pause, inventory, blur, pagehide, and backgrounding.
- Corrected the mobile Shift action label to ダッシュ because the current movement core maps Shift to sprint; crouch is not implemented by that core.
- Refined safe-area-aware portrait/landscape layouts and added helper regression tests. Native-device/browser smoke testing remains outstanding.

## 統合作業 2026-11-21

- サイクル6のモバイル操作・描画設定・自動最適化と Inventory Stage 2 のアイテム／インベントリ処理を統合。A側の性能UI・モバイル操作を残し、B側のインベントリUIとデータ処理を合流。
- サーバーの versioned player save（位置・体力・所持品）を維持し、装備スロットも保存対象に追加。
- Minecraftクライアント由来のシェーダー／リソース素材は成果物へコピーしていない。`client.zip` は構造調査のみで全ファイル解析ではなく、素材の完全ライセンス調査も未了。
- アイテムIDカタログ件数は、各アイテムの完全な挙動・レシピ・テクスチャ実装件数を意味しない。



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


## 2026-11-22 JST — Cycle28 / Stage6 / Mobfix 再統合・復旧
- 死亡時に所持品／装備数量をワールドドロップ化し、レベルに応じたXP dropを生成。XP pickupはサーバー権威・残量保存・再接続を処理し、XP専用dropの保存validatorも修正。
- Mob素材lootの限定テーブルを実アイテムEntityへ接続。これは完全なJava 26.3 Loot Tableではなく、対応Mob・アイテム・死亡経路に制限がある。
- 作業台3×3 UI・材料配置・サーバー検証を統合し、プレイヤー2×2クラフトの不正3×3入力を拒否。
- 旧64×32スキン左右UVミラーを復旧。アイテム個体単位の耐久値をHUD／インベントリスロットへバー表示。
- 別ディメンションでのdig-startがOverworld block lookupを使う問題を修正。
- Node strip-types mjs suite: 327/327 PASS。JS/TS syntax check: PASS。`tsc` / buildは依存型定義不足で未確認。詳細は`INTEGRATION_NOTES.md`。
