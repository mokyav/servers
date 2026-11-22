# IMPLEMENTATION_STATUS — 初回統合監査

状態語: 未着手 / 設計済み / 実装中 / 部分実装 / 実装済み / テスト済み / 統合テスト済み / 完成。見た目だけ、データ資産だけでは「完成」としない。

|カテゴリ|状態|根拠/不足|
|---|---|---|
|ワールド/生成|部分実装|seeded generator等あり。多様な地形/構造物/Java parity未完|
|チャンク|部分実装|ChunkView/World実装とunit testsあり。全保存/streaming stress未確認|
|ブロック|部分実装|ブロック定義、設置/破壊/同期。状態・機能block全網羅なし|
|アイテム|部分実装|一部ブロック・food/material/XP。全item/tool/armor不足|
|インベントリ|部分実装|hotbar/counts中心。27枠/armor/offhand/container transaction不足|
|クラフト|部分実装|限定レシピとrecipe tests。全crafting/furnace/station不足|
|プレイヤー/物理|部分実装|移動、physics等あり。全乗り物/衝突/補正未完|
|サバイバル|部分実装|vitals/food/effectsの一部。酸素、装備、死亡loopなど未完|
|戦闘/PvP|部分実装|melee/遮蔽など限定実装。全武器/設定/ログ未完|
|Mob/AI|部分実装|一部spawn/AI/flee/loot/XP。Mob roster全体の個別行動なし|
|村人/取引|未着手または未確認|職業、村、取引の統合を確認できず|
|ディメンション|部分実装|3 ID/次元分離のコードあり。完全portal/structure loop未完|
|Redstone/液体/農業|部分実装または未確認|限定回路コードあり。Java相当の網羅・長時間検証なし|
|GUI/HUD|部分実装|主要画面/HUDあり。指定screenと完全inventory操作は不足|
|マルチプレイ|部分実装|WebSocket room/DO同期あり。認証/招待等の全要件不足|
|サーバー/権限|部分実装|host token、validation、rate controlsなど一部。認証/監査全体未完|
|保存/再接続|部分実装|プレイヤー位置・体力・所持品をschema v1 snapshotに集約し、Durable Object transactionで旧キー互換ミラーと一括保存。旧loc:/p:/i:データ移行をunit testsで確認。ワールドバックアップ/復旧、実DO再起動試験は未実施|
|シェーダー|未着手/未確認|選択可能なshader pipelineを確認できず|
|グラフィック/負荷設定|部分実装|10段階の描画距離・Mob描画距離・クライアント側チャンク生成/メッシュ予算、opt-in FPS描画距離調整を実装。shader/他効果、GPU/CPU等の自動最適化は未実装または未検証|
|自動最適化|部分実装|FPSのみ参照する固定heuristic。AI/GPU/CPU/memory/network最適化ではない|
|オーディオ|未確認|全カテゴリ・空間音響の実装を検証していない|
|セキュリティ|部分実装|入力検証・host token等あり。session/auth、全攻撃面監査未完|
|テスト|テスト済み（Node unit）|full source archiveのNode tests合格。typecheck/build/browser/multiplayer integration未実施|

## このサイクルの実装範囲
1〜10の名称を個別表示し、現レンダラーが扱う描画距離2〜12を割当。Level 5 Normal=6 chunksを既定。手動距離変更はCustomにし自動調整を解除。FPS自動調整は4回連続<30 FPSで距離を1段下げ、12回連続≥55 FPSで1段上げる。変更対象はclient render distanceだけ。シェーダー、影、SSAO、texture/audio quality等を有効化したと誤認させるスイッチは設けていない。

## サイクル2追記 — 2026-11-21 JST
- 10段階profileは描画距離に加え、1フレームあたりのクライアント側チャンク生成/メッシュ化の上限を切り替える。値は生成1–2、メッシュ1–3で上限を固定。
- 通常時とロード時の両方で選択中予算をChunkViewに渡す。FPS自動調整は従来どおり描画距離だけを変更。Mob AI、液体、レッドストーン等のシミュレーションには接続しない。
- 旧保存設定は予算値が欠けていてもprofile/距離から補完する。型宣言ファイルを追加。


## サイクル3追記 — 2026-11-21 JST
- Mobのクライアント描画距離を10段階設定とCustomスライダーに接続。レンダリング可視性だけを距離で制限し、ゲームシミュレーション/サーバーAIには接続しない。
- 関連Node testsは`TEST_REPORT.md`参照。ブラウザ/WebGL・TypeScript build未確認。


## モバイル操作 — 開発サイクル5
| 機能 | 状態 | 検証/制約 |
|---|---|---|
| タッチ移動スティック、視点スワイプ | 部分実装 | 既存移動キー/カメラへ接続。Node helper testsのみ。実機・回転・複数タッチ未確認 |
| ジャンプ、しゃがみ、採掘/攻撃、使用/設置 | 部分実装 | 既存アクション経路を再利用。ボタンの実ゲーム動作はブラウザ未確認 |
| インベントリ、一時停止、ホットバータップ | 部分実装 | 既存UIを呼出。ホットバーは既存スロットのタップ操作 |


## Mobile controls update (cycle 6)
- Implemented/automated tests: touch look pointer ownership, radial joystick displacement clamping, cleanup of held mobile actions across overlays and page/app lifecycle, and responsive safe-area layouts.
- Partial: on-screen jump, dash, mine/attack, use/place, inventory and pause controls. Existing core does not implement crouching; UI now accurately calls the Shift action dash.
- Not verified: iOS Safari/Android Chrome real-device input, orientation changes on hardware, accessibility/comfort, and long-session touch testing.

## 統合作業 2026-11-21

- サイクル6のモバイル操作・描画設定・自動最適化と Inventory Stage 2 のアイテム／インベントリ処理を統合。A側の性能UI・モバイル操作を残し、B側のインベントリUIとデータ処理を合流。
- サーバーの versioned player save（位置・体力・所持品）を維持し、装備スロットも保存対象に追加。
- Minecraftクライアント由来のシェーダー／リソース素材は成果物へコピーしていない。`client.zip` は構造調査のみで全ファイル解析ではなく、素材の完全ライセンス調査も未了。
- アイテムIDカタログ件数は、各アイテムの完全な挙動・レシピ・テクスチャ実装件数を意味しない。



## 開発サイクル21 — 採掘ツールの採取レベルとドロップ
- サーバーのブロック破壊処理が採掘開始時のツールIDと最新インベントリ所持数を参照し、石系ブロック・鉱石・黒曜石/古代の残骸の採取条件を検証する。
- 石炭/鉄/金/銅等の鉱石を対応する資源アイテムとしてドロップし、砂利の火打石確率、葉/液体/ポータル等の非ドロップを扱う。
- クライアント申告のツールIDを開始時に検査し、サーバー側で採掘時間とドロップ可否を再評価する。
- 未実装: 個体ごとの耐久/破損。現在のインベントリはアイテムID別の個数配列で個体スロット/耐久値を保持しないため、単純な耐久減算は行わない。ツール選択のhotbar slotをサーバー権威化する作業も残る。


## 再統合更新 — 2026-11-22

|カテゴリ|更新状態|根拠/制限|
|---|---|---|
|死亡時ドロップ|部分実装・Nodeテスト済み|Survival/AdventureでInventory item stacksとXP dropを保存・同期。個別Stack Component（耐久/名前/Enchants）はEntityへ保持されず死亡時にクリア。XPは単一Orb。|
|経験値オーブ|部分実装・Nodeテスト済み|死亡時計算、描画、拾得、満杯時残量、保存validatorを接続。Vanillaの複数Orb物理は未再現。|
|Mob素材Loot|部分実装・Nodeテスト済み|限定Mob tableを実World item entity化。全Mob/全条件/環境死/Lootingは未対応。|
|作業台クラフト|部分実装・Nodeテスト済み|3×3入力UI、Server-side recipe/table/range/inventory validation。グリッドのサーバー独立永続化は未対応。|
|アイテム耐久|部分実装・Nodeテスト済み|Stack Componentのdamage、server authoritative wear、保存、HUD/インベントリバー表示。全アイテムのUse/Combat条件を完全網羅していない。|
|旧形式スキン|実装・Nodeテスト済み|64×32 legacy skinをface単位で左右ミラーしてmodern UVへ移行。|
|ディメンション採掘|修正・Nodeテスト済み|dig-startで現在ディメンションのBlockを参照。実Cloudflare環境は未確認。|
|ビルド/実プレイ|未確認|依存型定義不足でtsc/Vite/Workers build未完了。ブラウザ/WebGL/実マルチ接続テスト未実施。|

- `node --experimental-strip-types --test test/*.test.mjs`: 327/327。
- `.js` / `.mjs` 構文検査および `.ts` strip-types構文検査は成功。完全型検査とは別。
