# KORUVA_IMPLEMENTATION_PROGRESS — 第1回

更新日: 2026-11-20（Asia/Tokyo）
対象依頼: Minecraft Java Edition 26.3準拠を目指す第1回。**本成果は完全な26.3互換実装ではなく、既存Koruvaへの限定的な垂直スライスです。**

## 基準と既存構成
- Java Edition 26.3正式リリース日: 2026-09-15。公式素材は同梱していません。
- 元プロジェクト: `koruva-adventure-survival-v4-combat-update.zip`。Three.jsクライアント、Cloudflare Worker/Durable Object、WebSocket構成を維持。
- 既存定義は 60 block IDs（air含む、非air 59）。現在の代表placeable block itemsは36種（階段の向きを代表IDにまとめる）。これは既存Koruvaの数で、Java 26.3全registry数ではありません。
- 在庫はID別集計count配列で、一般ItemStack、個別item NBT、耐久道具は未実装。

## 今回追加・変更した機能
- `shared/gameplay.js`: 既存ID参照のslab/stair quick-craft 11レシピ、aggregate-count craft関数、簡易既定drop関数。
- Worker: craftはrecipe IDだけを受け、サーバー側countsで材料を検証・消費し、既存`persistInventory`と`inventory`同期を使用。破壊時dropは編集前にWorkerが読んだblock ID由来とし、クライアント申告`msg.d`を信頼しない。
- Client: inventory panelにquick-craft buttonsを追加。soloでは在庫更新・保存、roomではrecipe IDのみ送信。
- `shared/protocol.ts`にcraft message unionを追加。既存block IDsを変更していません。

## 数量
| 項目 | 数 | 状態 |
|---|---:|---|
| 既存block IDs | 60（air込み） | 既存データ。Java 26.3全件ではない |
| 既存placeable block items | 36 | 既存block-item表現。独立item registryではない |
| 今回新規のnon-block items | 0 | 未実装 |
| quick-craft recipes | 11 | 追加・Nodeテスト済み。aggregate counts方式 |
| 今回連携した設備UI | 0 | 作業台・精錬設備未実装 |
| Java 26.3全registryの総数／未実装数 | 未確定 | 完全registry dataを抽出できていないため算出不能 |

## データ・保存・同期
- 既存integer block IDsを維持。recipe形式: `id`, `name`, `grid`, `pattern`, `ingredients[{itemId,count}]`, `output{itemId,count}`。
- `pattern` metadataはあるが、現UI/Workerは配置gridを受けず、材料数だけで作成する簡易方式。2x2/3x3 slot crafting、鏡映、余剰材料/容器、unlock、workbench条件は未実装。
- 在庫保存・同期は既存Worker `persistInventory` / `sendInventory` を再利用。一般item stack保存形式は追加していない。

## 未実装・既知の制約
- Java 26.3正式registryの全block/item/recipeを登録していない。公式version artifact/data generatorによる抽出と差分検証ができていないため、完全件数・完全性は不明。
- dropは簡易既定値のみ: grass→dirt、stone→cobblestone、leaves/bedrock/water→なし、それ以外は対応block item ID。ツール条件、耐久、Silk Touch、Fortune、完全loot tables、複数dropは未実装。
- 採掘時間/道具、全shape/physics/light/fluid、個別stack操作、全item/tools/weapons/armor/foods、full crafting, smelting/設備、enchantment/potion、16色/全樹種/銅系、完全なcreative検索とワールド復元検証は未実装。
- craftはサーバーが現在のcountsを検証するが、全操作の不正対策・同時実行・所有権を監査したものではない。ブラウザと複数人での実機確認は未実施。

## ファイル差分
新規: `shared/gameplay.js`, `shared/gameplay.d.ts`, `test/gameplay.test.mjs`, `KORUVA_IMPLEMENTATION_PROGRESS.md`。
変更: `shared/protocol.ts`, `src/worker/room.ts`, `src/client/main.ts`, `src/client/index.html`, inventory stylesheet。
削除: なし。

## テスト
- Node unit tests: 5件、exit code 0。
- 元ZIP CRCと出力ZIP CRCを確認。
- TypeScript/Vite build: 未実行（依存node_modulesなし、npm install/networkは実行せず）。Worker runtime, browser UI, multiplayer, durable restoration integration test: 未実施。

## 第2回への引き継ぎ
- 拡張候補: `shared/gameplay.js`のrecipe/drop data、専用block/item registry、`room.ts` command handlers、`main.ts` inventory UI。
- 互換性確認必須: block IDs / `blockItemId`, compact counts save, `ClientMsg`, `applyEdit`, `persistInventory`, `sendInventory`。
- Java 26.3全件実装へ進む前に、公式version data extractionとregistry差分検証を行う。ここに示す既存数をJava全件数として扱わないこと。

## 第2回 — 決定的な地形生成の段階拡張（2026-11-20）

### 今回追加した範囲
- 新規生成向けworldgen v2を追加。seeded climate noiseで5区分（snowy / desert / taiga / forest / plains）を生成し、地表と樹木密度を変化させる。
- 3D noise洞窟カービング、決定的な石炭・鉄・金の鉱脈、砂利配置を追加。地形・樹木・鉱脈はseedとワールド座標から生成し、チャンク順に依存しない。ブロックIDは変更していない。
- Solo saveとDurable Object metadataにworldgenVersionを保存。旧save/roomはversion欠落時にv1で読込み、新規worldはv2。クライアントとサーバーで同じversionを共有する。

### 検証
- `node --test test/*.test.mjs`: passed。
- 旧generatorの代表チャンク（seed 123456789、chunk -2,3）SHA-256 `ef13bceb8ac520e1d8d54842ee075d7c4785b70f8845b47097807668c14905ed` とv1出力を照合。
- TypeScript/Vite build、Cloudflare runtime、ブラウザー、複数人接続の実機検証は未実施（環境にnpm/tsc/依存がない）。

### 未実装
- バイオーム固有の地形形状/植生、洞窟内液体、構造物、光伝播、昼夜・天候連携、液体シミュレーションは未実装。
- 第3回（Mobs/AI/戦闘拡張）、第4回（レッドストーン/自動化/村人等）、第5回（ディメンション/ポータル/ボス/総合マルチプレイ）と全体安定化は未完了。これはMinecraft Java Edition 26.3完全互換ではない。


## 第3回 — サーバー権威型Mob AIの初期統合（2026-11-20）

### 今回追加
- 既存6種（pig/cow/chicken/zombie/skeleton/creeper）の共通データ駆動プロファイルとサーバー側AI更新。Mobの体力・AI状態・標的・攻撃間隔・導火時間は既存Mob保存データに任意項目として追加し、旧データ読み込みを維持。
- 生存/アドベンチャーを対象にゾンビの追跡・近接攻撃、スケルトンの距離維持・遠距離攻撃意図、クリーパーの導火・範囲爆発、受動Mobの決定的徘徊を実装。Workerが被ダメージを確定し、Mob状態はDurable Objectに定期保存。
- AI更新を最大5Hz、プレイヤーから96ブロック以内に制限。生成チャンクは上限24個のメモリキャッシュで再利用し、差分Mob配信とクライアント位置補間を追加。

### 検証
- ベースラインNode tests 22/22成功、JS構文検査7ファイル成功。変更後のテスト・構文検査・ZIP整合性は今回の成果物で実行。
- TypeScript型検査、Vite build、Cloudflare Durable Object実行、ブラウザ実動作、複数人統合確認は未実施。

### 未実装・制約
- Mob種類は既存6種のみ。自然スポーン、正式なドロップ/経験値、繁殖・成長、物理飛翔物としての矢、サウンド、経路探索・高度な地形追従、水中行動、防具連携、ボスは未実装。スケルトン遠距離攻撃は物理弾ではなくサーバー側クールダウン付き直接ダメージ。
- Mob衝突は単純なブロックセル判定のみ。ノックバック同期、詳細な当たり判定、Mobのゲームモード/ディメンション保存は未実装。
- 全Java 26.3ブロック/アイテム、完全な第2回環境システム、第4回回路/自動化/取引、第5回Nether/End/Portal/最終統合、第6回総合安定化は未完了。この成果物はJava Edition 26.3完全互換ではない。


## 第3回補修 — ドロップ永続化（2026-11-20）

### 今回の変更
- Worker の Durable Object Storage に `drops` 配列を保存し、起動時に読み込むよう変更。読込時に不正なID/座標/ブロックID、重複、5分超の期限切れ、異常な未来時刻を除外し、最大300件に制限。正規化した配列も保存する。
- 採掘時の生成、期限切れ、上限超過時の退避、クリエイティブ/スペクテイター切替時の削除を永続化。ネットワークメッセージ形式は維持。
- サバイバルでの回収は、ドロップ削除と在庫更新をStorage transactionで同時保存。満杯スタックではドロップを消さない。
- `shared/drop-store.js`と型宣言、正規化テスト、DO再生成時の復元を確認する既存roomテストを追加。

### 検証
- `node --test test/*.test.mjs`: 33/33 passed、0 failed。
- JavaScript/MJS構文検査: 11 files passed。
- TypeScript/Vite build、Cloudflare runtime、ブラウザー、複数人実機テストは未実施（この環境にnpm/tsc/tsx/viteなし）。`test/room.test.ts`の統合テストも未実行。

### 未実装
- 第4〜6回のレッドストーン/自動化/取引、Nether/End/ポータル/ボス、総合マルチプレイ安定化は未実装。Java Edition 26.3の全registry/全機能互換ではない。


## 2026-11-20 — 攻撃チャージメーター表示修正（限定）

- `shared/combat.js` にダメージ倍率と独立した `attackChargeProgress`（0〜1の線形回復進捗）を追加。クライアントのメーターは従来の最低20%ダメージ倍率ではなく、実際の再チャージ率を表示する。サーバー側ダメージ式は変更していない。
- `combat.d.ts` と回帰テストを更新。武器アイテム自体は未実装のため、クライアント/サーバーとも現在は素手の攻撃間隔を使用する。
- 今回もMinecraft Java Edition 26.3全機能・全アイテム・全ディメンションの実装ではない。Cloudflare/TypeScript build、ブラウザー、マルチプレイ実機検証は未実施。

## 第5回 — ディメンション地形基盤（2026-11-20、部分実装）

### 今回の実装
- 3つの正式ID (`minecraft:overworld`, `minecraft:the_nether`, `minecraft:the_end`) の定義・正規化を追加。Overworld-Nether間の8:1座標変換とEndへの中央行先を純粋関数で実装。
- Overworldの既存生成コードを変更せず、別seeded generatorでNetherの床/天井/空洞/溶岩と簡易バイオーム、Endの中央島/外周島/奈落を生成。
- `World`に任意のdimension IDを受ける後方互換コンストラクタを追加し、明示されたNether/Endで専用chunk生成を呼ぶ。
- 既存ID 0–59は維持し、dimension terrain用ID 60–69を追加。アートは既存atlas tileを再利用。

### 未実装・未統合（重要）
- portal構築/起動/接触/クールダウン・サーバー権威移動、room protocolとplayer/chunk persistenceのdimension対応、切替UIは未実装。現在のゲーム起動時は既定Overworldのまま。
- Nether/Endの構造物、固有Mob/ボス/報酬、独立時間/天候/照明、dimension別保存・同期は未実装。
- 新block defsは簡易表示用IDでありJava 26.3完全registry/textureではない。この作業を第5回完了として扱わない。

### 実行検証追記
- `node --test test/*.test.mjs`: exit 0; summary: ℹ duration_ms 611.194208.
- `node --check` on new dimension and generator JS: passed.
- TypeScript/Vite build, Worker runtime, browser/online multiplayer: not run.

## 継続作業 — ディメンション別ソロ保存の基盤（2026-11-20）

### 今回実装した内容
- `World` にディメンション別のブロック編集差分を退避する仕組みを追加。`switchDimension()` は現在の差分を保持し、次元ごとの差分だけを選択してチャンクキャッシュを破棄する。呼出側でプレイヤー移動先・描画ビューの更新が必要。
- ソロの `SoloSave` に任意項目 `dimensionId` / `dimensionEdits` を追加し、autosave / load が読み書きする。旧v1セーブはOverworldとして読み込み、従来の `edits` を移行する。
- 保存データのディメンションID、座標、高さ、ブロックIDを検証する共通関数を追加。既存ID体系とセーブversion=1は維持。

### 変更ファイル
- 新規: `shared/dimension-state.js`, `shared/dimension-state.d.ts`, `test/dimension-state.test.mjs`
- 変更: `src/client/world.ts`, `src/client/save.ts`, `src/client/main.ts`, 本進捗書
- 削除: なし

### 検証と制約
- 今回の回帰テストはZIP再生成後に実行して記録する。
- これはソロの編集差分保存とWorld内切替APIであり、ポータル・UI・プレイヤー座標遷移・サーバー/Durable Objectのディメンション分離・マルチプレイ同期はまだ実装していない。
- この環境にnpm/tsc/Vite/Wranglerはなく、TypeScript型検査、Cloudflare実行、ブラウザ実動作、複数人テストは未確認。したがって第5回・第6回の完了ではなく、Minecraft Java Edition 26.3完全互換でもない。


- 実行結果: `node --test test/combat.test.mjs test/dimension-state.test.mjs test/dimensions.test.mjs test/drop-store.test.mjs test/gameplay.test.mjs test/mob-ai.test.mjs test/room-wiring.test.mjs test/worldgen.test.mjs` は終了コード0で成功（上記テスト群）。TypeScript/build/runtime/browser tests are not run.

## ソロディメンション移動とアイテムIDカタログ（2026-11-20）

### 今回追加した内容
- ソロチャットで `/dimension overworld|nether|end` を実行できるようにし、既存のdimension-local world editsを保ちながら切替。Overworld/Nether間は既存の8:1座標マップを使い、到着地点近傍の安全な地面を探索してプレイヤー/描画ビュー/respawn点を更新、切替時にソロセーブする。ルーム（オンライン）ではこのコマンドを使えない。
- SoloSaveに任意のrespawn座標を追加。古いセーブには安全な地点探索をフォールバックとして使う。
- 添付 `client.zip` のアイテム定義ファイルパスから namespaced identifier 1,658件のみを `shared/minecraft-item-catalog.js` に登録。バージョンキーは添付のdata_version 121.0。公式のmodel/icon/texture/class/recipeはコピーしていない。
- safe spawn探索・カタログ一意性のNodeテストを追加。

### 今回の範囲外
- アイテムカタログは識別子一覧であり、インベントリ表示・スタック制約・ドロップ・使用効果・装備・レシピ等の実装ではない。既存ゲームの有効なblock/item挙動はこれまでの範囲のみ。
- ディメンション移動はソロの管理コマンドであり、実際のポータル作動、マルチプレイ同期/Worker dimension partition、Java版の完全な地形・構造物・Mob/boss/feature互換を追加しない。
- TypeScript/build/browser/Cloudflare runtimeは環境に依存するため、今回検証結果はNode testsとZIP静的検査に限定。
- 検証結果: `node --test test/*.test.mjs`（glob解決済みの10ファイル）: tests=unknown, pass=unknown, fail=unknown。追加したJSモジュールの `node --check` も成功。


## 継続作業 — ソロセーブ読込の構造検証（2026-11-20）

### 今回の変更
- `loadSolo()`が従来はJSONとして読めて`v === 1`なら内部構造を検証せず返していたため、位置・選択スロット・編集配列・任意のディメンション編集等が不正なセーブで後段処理が壊れる可能性があった。
- `shared/save-validation.js`に非破壊の構造検証を追加し、クライアントのソロセーブ読込時に適用。旧v1セーブで追加項目がない形式は引き続き受け入れる。無効データは読み込み対象から外すが、ストレージ上の原文はこの検証処理では削除・書換えしない。
- 回帰テストを3件追加。これは保存形式の完全な破損復旧やクラウド保存を実装したものではない。

### 検証
- `node --test test/*.test.mjs`: 実行結果はこのZIP作成時の検証欄を参照。
- `npm`/`npx`/TypeScript/Vite/Wranglerが実行環境にないため、型検査・フロントエンドビルド・Cloudflare実行・ブラウザ実機確認は未実施。
- `client.zip`はMinecraftクライアントのクラス・アセット等を含むアーカイブであり、Koruvaソースではない。成果ZIPには取り込んでいない。

### 依然として未完了
- レッドストーン一式、汎用アイテム挙動、ポータル/本格的なディメンション遷移、各ディメンション構造物・Mob・ボス、村人取引、乗り物、エリトラ、全進捗/コマンド/ゲームルール、権威型マルチプレイ統合、完全なクラウド保存・認証、ブラウザ/Cloudflareの統合試験。Java Edition 26.3完全互換ではない。


## 第6回 継続 — サーバーコマンド分岐の到達不能バグ修正（2026-11-20）

### 修正内容
- `src/worker/room.ts`: `/give` の処理が `if (cmd === "givefood")` の内側に誤ってネストされていたため、両条件が同時に成立せず付与処理へ到達できない不具合を修正。`/give` を独立したトップレベル分岐に戻した。
- `test/room-wiring.test.mjs`: `/give`・`/summon`・`/kill`・`/givefood` がコマンドハンドラー直下の分岐であることを検査する再発防止テストを追加。
- セーブ形式、ブロックID、アイテムIDは変更せず、基準ZIPにあった既存の部分実装を維持。

### 検証結果（更新ZIPから実行）
- `node --test test/*.test.mjs`: 51 tests, 51 passed, 0 failed。
- ZIP内 `.js` / `.mjs` 20 ファイルに `node --check`: 全件成功。
- ZIP CRC整合性: 作成後に確認。
- TypeScript/Vite build、Worker/Durable Object、browser、実マルチプレイ: 未実施。npm/依存ツールがないため。

### 未完了
この変更はコマンド分岐の到達不能バグ1件の修正であり、第1〜6回の全機能やMinecraft Java Edition 26.3完全互換を意味しない。レッドストーン全般、汎用アイテムの実動作、ポータルとオンラインのディメンション移動、構造物/固有Mob/ボス、村人取引、乗り物、認証/クラウド保存、統合・実機試験等は引き続き未完成または未検証。


## 第6回 継続 — 最新ソース監査・実行可能テスト記録（2026-11-20）

### 対象と変更範囲
- 監査対象: 最新添付 `koruva-command-dispatch-repaired-progress.zip`（141 entries）。入力ZIP CRC検査成功。
- この回は現状監査と再現可能な検証結果を記録した。今回、新たなゲーム機能コードは変更していない。第1〜6回の全機能が完成したという意味ではない。

### 実行結果
- `node --test test/*.test.mjs`: 51件、成功51、失敗0（v26.13.1）。
- ZIP内 `.js` / `.mjs` 全20ファイルを `node --check`: 全件成功。
- `npm` / `tsc` / `npx` はこの実行環境に存在しないため、TypeScript型検査、Vite build、`npm test`全体は未実行。
- Cloudflare Workers/Durable Objects runtime、実ブラウザー、実マルチプレイ、長時間負荷・再起動をまたぐ統合試験も未実施。

### ソースから確認した未実装・統合不足
- `shared/protocol.ts` のプレイヤー・位置プロトコルにディメンションIDがなく、`src/worker/room.ts` の編集チャンクキーもディメンションを含まない。オンラインルームでの権威型ディメンション分離・同期は未実装。
- `/dimension` 操作はクライアントのソロコマンド経路にある。ポータル判定・オンライン移動・サーバー移動処理は未実装。
- Minecraft item catalogは識別子カタログであり、全識別子の使用効果、装備・耐久・レシピ・loot tableまで実装したものではない。
- 既存の進捗書に記録済みのレッドストーン/自動化、村人取引、乗り物、エリトラ、Nether/Endの構造物・Mob・ボス、認証・統合保存等は完成扱いにしない。

### 次の修正候補
- 優先度の高い統合課題は、互換性を保ったサーバー権威型ディメンションID・プレイヤー状態・チャンク編集保存の分離と、旧ルームのOverworld移行テスト。


## 第6回の継続作業 — Workerチャンク編集の保存整合性（2026-11-20）

### 発見・原因
- `Room.applyEdit()` は既存の共有 `Uint8Array` を先に変更してから Durable Object Storage の `put()` を await していた。保存が失敗すると、同じWorkerインスタンス上のメモリだけに新しいブロックが残り、再起動・再接続後の永続状態と食い違う可能性があった。

### 修正
- `shared/chunk-edits.js` の `PersistentChunkEdits` にチャンク編集保存を集約。既存配列をコピーして変更し、storage writeが成功してからライブMapへ公開する。書込失敗時はライブMapを変更しない。
- 同一writer内の保存をPromise queueで直列化。失敗した操作は呼出元へrejectを返しつつqueue自体は回復し、後続編集を処理できる。
- 上限・添字・byte値・保存配列サイズを検証。既存チャンクID、`c:<cx,cz>`キー、データ形式、メッセージ形式は変更しない。

### 変更ファイル
- 追加: `shared/chunk-edits.js`, `shared/chunk-edits.d.ts`, `test/chunk-edits.test.mjs`
- 変更: `src/worker/room.ts`, 本進捗書
- 削除: なし

### 検証
- `node --test test/*.test.mjs`: exit 0; 全件成功。
- `node --check` on all `.js` / `.mjs`: 22 files; all passed.
- npm / TypeScript / Vite / Wranglerを実行できない環境のため、型検査、ビルド、Cloudflare Durable Object実機、ブラウザー、実マルチプレイは未検証。

### 残課題
- 本修正はチャンク編集保存の局所的な整合性改善であり、Koruva全機能の完成を意味しない。レッドストーン、汎用アイテム挙動、サーバー権威型オンライン次元分離・ポータル、村人取引、乗り物・エリトラ、全構造物/Mob/ボス、認証・クラウド保存などは未完了または未検証。


## 2026-11-21 — 独立再監査（現行ZIPの状態確認）

### 確認した基準
- 対象は、この会話で利用可能な最新の作業アーカイブ `koruva-chunk-save-atomicity-progress.zip`。ZIPの展開テスト（CRC）は成功。
- 今回はコードを変更していない。したがって、この監査は新機能追加・バグ修正の完了を意味しない。

### この実行環境で再現できた検証
- `node --test test/*.test.mjs`: 56 tests, 56 pass, 0 fail。
- `.js` / `.mjs` の構文検査（`node --check`）: 22 files, 0 failures。
- ZIP CRC: 成功。
- これらはNode上のユニットテストと静的検査であり、ゲーム全体の統合テストではない。

### 未検証・未完了（この監査でも解消していない）
- この環境に `npm`、`tsc`、`vite`、`wrangler`、`node_modules` がないため、TypeScript型検査・Viteビルド・Cloudflare Worker/Durable Object実行は未実施（失敗ではなく未実行）。
- ブラウザー実動作、オンライン複数人同期、セーブ復元の実環境確認、長時間・負荷試験、認証/OAuth試験は未実施。
- 進捗記録上、Java 26.3全アイテムの実挙動、レッドストーンと自動化、ポータルを含むオンラインのディメンション移動、全ディメンション構造物/Mob/ボス、村人取引、乗り物/エリトラ、完全なゲームルール・コマンド、クラウドアカウント/ワールド保存は未完了または未検証。
- 完全版・Java 26.3互換・デプロイ可能とする根拠はない。

### このZIPの位置付け
これは監査記録を追加した途中版であり、ゲームコードは前版から変わっていない。次の実装では、registry/データ、アイテム挙動、クラフト・UI、サーバー権威状態、保存・マルチプレイ、統合試験を依存関係に沿って段階実装する必要がある。


## 2026-11-21 — レッドストーン計算基盤の追加（未統合）

### 追加内容
- `shared/redstone.js` / `.d.ts` に、データ駆動型の信号グラフ計算を追加。信号値を有限整数0〜15へ正規化し、隣接ソースからの給電、ワイヤ間の1段階減衰、ループの収束、consumerへの入力値を扱う。
- 同ファイルに、tick順で遅延更新を取り出す決定的スケジューラを追加。同一デバイスIDの予約を集約し、保留件数とpop件数を制限する。
- 回帰テストを追加し、壊れたnode/重複ID/上限超過、attenuation、loop、schedulerを検証。既存block/item ID、save形式、Worker protocolは変更していない。

### 検証
- Nodeの既存 `test/*.test.mjs` と新規 `test/redstone.test.mjs` を実行し、成功件数/失敗件数を下記ログで記録。
- JS/MJS構文検査と成果ZIP CRCを検証。
- TypeScript/Vite build、Cloudflare Worker/Durable Object、ブラウザー、オンラインマルチプレイは未検証。

### 重要な未統合範囲
- この計算基盤はゲームへまだ接続されていない。レッドストーン関連block ID・設置条件・隣接接続構築、Worker上の権威状態、tick/alarmによるスケジューリング、リピーター/コンパレーター/ピストン/コンテナ連携、チャンク境界・保存・差分同期、クライアント描画/UIは未実装。Java Edition 26.3互換の完成機能ではない。
- オンラインdimension分離も未実装。現行roomは単一dimensionのchunk edits / mobs / drops管理であり、この成果物では変更していない。


## 2026-11-21 — レッドストーン最小ランタイム統合（部分実装）

### 今回の変更
- 既存ID 0–69を維持し、新規ID 70–73にレッドストーンブロック（常時出力源）、ダスト、消灯/点灯ランプを追加。既存ブロック登録・描画・設置アイテム経路を使用。
- `shared/redstone-world.js` を追加し、編集位置と隣接する六方向接続のredstone成分だけを探索。既存信号グラフ計算でダストの減衰を評価する。
- Durable Objectの既存ブロック編集後にサーバーが再計算し、ランプ状態を既存チャンク編集保存で永続化、`set`差分としてroomへ配信。最大4096ノード/65536計算ステップで上限超過時は部分状態を適用しない。
- 追加: `shared/redstone-world.js`, `shared/redstone-world.d.ts`, `test/redstone-world.test.mjs`。変更: `shared/blocks.ts`, `src/worker/room.ts`, 本進捗書。

### 制約・未実装
- これは最初の縦切り（常時給電ブロック→隣接ダスト→ランプ）であり、Java Edition完全挙動ではない。六面隣接の簡略接続のみ。トーチ/レバー/ボタン/感圧板/リピーター/コンパレーター/オブザーバー/ピストン等、設置条件・遅延・向き・信号強度の描画は未実装。
- ルーム起動時の全体再計算はなく、更新は編集位置に連結した成分に限定。上限超過回路はログ記録して更新をスキップ。
- TypeScript型検査/Vite build/Cloudflare Worker・Durable Object/browser/多人同期での実動作は未実施。

### 検証
`node --test test/*.test.mjs`: 65 tests / 65 passed / 0 failed。JS/MJS構文検査: 26 files passed。ZIP CRC: 作成後確認。


## 2026-11-21 — レバー入力と回路接続（部分実装）

### 今回追加
- 既存IDを変えず `REDSTONE_LEVER_OFF` / `REDSTONE_LEVER_ON`（ID 74/75）を追加。右クリックで切替でき、オン状態は15段階の電源として回路計算に入力される。
- ソロでは通常のローカル編集・保存経路で信号を再計算。オンラインでは `use` メッセージをサーバーで検証し、ゲームモード、座標/高さ、`SERVER_REACH`、編集保存成功を確認してから状態をbroadcastし回路再計算する。
- レバーは既存の赤色atlas tileを再利用した簡易表示。Java版の形状・向き、設置面判定、完全な配線幾何は未実装。

### 変更ファイル
- 変更: `shared/blocks.ts`, `shared/redstone-world.js/.d.ts`, `shared/protocol.ts`, `src/worker/room.ts`, `src/client/main.ts`, `test/redstone-world.test.mjs`, `test/room-wiring.test.mjs`, 本進捗書。
- ブロックIDはappend-onlyで追加。既存セーブ形式は変更なし。

### 検証
- `node --test`（test/*.test.mjs 全件）: exit 0。ℹ pass 67 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0 ℹ duration_ms 916.230388
- `node --check` on `.js` / `.mjs`: 26 files, all passed.
- TypeScript/Viteビルド、Cloudflare実行、ブラウザー、実マルチプレイは未検証。

### 未完了
- リピーター、コンパレーター、ボタン、感圧板、ピストン、ディスペンサー、ドロッパー、ホッパーなどは未実装。この追加で全機能完成・Java 26.3完全互換とはならない。

## 2026-11-21 — 方向付きレッドストーンリピーター（限定実装）

### 今回追加
- 既存IDを維持し、リピーターの4方位ID 76–79を追加。設置時のyawで方位を選択し、在庫上は代表アイテムID 76に集約。
- ソロ/Worker双方の回路計算に接続。入力は背面のみ、出力は前面のみ。出力時に信号を15へ復帰し、直列リピーターと前面ランプを動作させる。
- ノード/伝播ステップ上限を維持し、上限超過時は部分状態を返さず更新をスキップ。

### 重要な制約
- これは方向付きの即時（組合せ）ダイオード動作で、Minecraftの1–4 redstone tick delay、右クリックによる遅延設定、ロック、正確な当たり判定/形状、光・音、公式モデル/テクスチャは未実装。
- 粉の接続は6面隣接の簡易モデルのままで、Java版の斜め接続・上下面形状等には一致しない。全レッドストーン機器や全Java 26.3アイテム/機能の完成ではない。

### 検証
- Nodeテスト全件、JS/MJS構文検査、ZIP CRCをこの成果ZIPに対して実施。
- TypeScript/Vite build、Cloudflare runtime、実ブラウザ、複数人同期は未検証。


## 2026-11-21 — リピーター遅延イベント基盤（部分実装）

- `shared/repeater-delay.js` / `.d.ts` を追加。1〜4 redstone tickでの立上り・立下り予約、再入力による保留イベントの置換/取消、決定的な期限順処理、未処理イベント上限を実装。
- `test/repeater-delay.test.mjs` を追加。
- **未接続:** このコントローラーは回路評価、クライアント/Workerのworld tick、ブロックの遅延設定値、永続化にまだ接続していない。したがってゲーム内リピーターは引き続き即時動作であり、今回をリピーター遅延機能の完成とは扱わない。


## 2026-11-21 — リピーター遅延のWorker alarm接続（限定実装）

- レッドストーン評価に保存されたリピーター出力状態の読み込みと入力状態の返却を追加。既存呼び出しは互換維持。
- Worker Durable Objectの既存50ms alarmで遅延制御を進め、遷移ごとに再評価。ゲーム内の標準遅延は現在1 tick固定。
- pending遷移と出力状態を`redstone-state`に保存し、DO再起動後に復元。pending中はオンライン人数が0でもalarmを継続。
- snapshot/restore、遅延中の非点灯、遷移後のランプ点灯、Worker接続の回帰テストを追加。
- 制約: ゲーム内遅延設定UI、ロック、Java版の厳密な回路更新順/形状、ソロ遅延、全アイテム/全機能は未実装。TypeScript/Vite build、Cloudflare runtime、ブラウザー/実マルチプレイは未検証。


## 2026-11-21 — リピーター遅延の設定切替（部分実装）

- 既存ID 76–79を維持し、ID 80–91を追加。1〜4 tick × 北/東/南/西をブロックIDで表し、全variantのインベントリアイテムIDは従来のリピーター（76）に統一。
- 右クリックで1→2→3→4→1 tickを切替。オンラインでは既存の距離検証済み`use`処理でサーバー保存・同期し、再計算は選択済み遅延値をWorker schedulerへ渡す。設定変更時は同座標の保留遷移を取消してから再予約。ソロでは設定variantをローカル編集として保存する。
- 検証: Node MJSテスト全件成功、JavaScript/MJS構文検査 28ファイル成功。
- 制約: ソロ回路の遅延tick実行、レッドストーンのJava版形状/ロック/更新順、他の未実装アイテム・機能は対象外。TypeScript/Vite build、Cloudflare runtime、ブラウザー/実マルチプレイは未確認。これは完全版ではない。


## 2026-11-21 — ソロモードのリピーター遅延

### 今回追加
- ソロのブロック変更時に回路を再評価し、リピーター入力を遅延キューに登録する共有ランタイムを追加。
- 50ms単位のtickで遷移を適用し、出力変化後に回路を再評価してランプなどへ伝播。
- リピーター撤去時は座標の予約遷移・出力状態を削除。ソロのロード開始時に古いキューをクリア。
- ランタイムにsnapshot/restore APIと4件のNode回帰テストを追加。
- 既存テストのWorker import検査が実際の名前付きimport形式と一致しない不具合を修正（検査対象をnamed importの存在確認に変更）。

### 未完了・未検証
- snapshot/restoreはランタイムAPIのみで、ブラウザーのソロセーブ形式への保存・復元統合は未実装。
- レッドストーンは簡易6方向接続モデルであり、Java版の全仕様互換ではない。全アイテム・全機能も未完成。
- TypeScript型検査/Viteビルド、Cloudflare実行、ブラウザー実動作、実マルチプレイは未確認。


## 継続作業 — ソロ回路状態のセーブ／ロード接続（2026-11-21）

### 今回の変更
- ソロ自動保存にリピーターの遅延キュー、出力状態、tick内の経過時間スナップショットを含める。
- 手動ロードではワールド編集データ復元後に回路スナップショットを復元する。旧セーブ（スナップショットなし）は回路状態をクリアし、不正な回路スナップショットがあってもワールド自体のロードを止めない。
- SoloSave型に任意の回路スナップショットを追加し、JSONシリアライズ後の再開テストと保存／読込配線テストを追加。

### 検証と制約
- Nodeの全`.mjs`テスト、JavaScript/MJS構文検査、ZIP整合性を実行し結果を本成果で記録。
- TypeScript型検査／Viteビルド、ブラウザー、Cloudflare実行、実マルチプレイは未確認。これはソロリピーター状態保存の限定修正であり、Koruva全機能やMinecraft Java Edition 26.3完全互換の完成を意味しない。


## 2026-11-21 — Workerのディメンション別チャンク差分ストア基盤

- Workerにディメンション別の編集チャンクMap/永続化writerを追加。既存の `c:cx,cz` はオーバーワールドとして維持し、ネザー/エンドは別namespaceで保存・復元する。
- Workerの地形参照と編集一覧APIにディメンション引数を追加し、非オーバーワールドでは既存の次元別チャンク生成器を使う。
- キー解析/旧キー移行のNodeテストを追加。
- これはストレージ/ワールド参照の基盤であり、接続後の次元移動、プレイヤー別の次元状態、Mob/ドロップ/レッドストーンの次元別同期はまだ未実装。TypeScript/Vite/Cloudflare/ブラウザー実行は未検証。


## 2026-11-21 — Online dimension travel (partial milestone)

- Added server-authoritative per-player dimension state for room sessions and a creative-host-only `/dimension overworld|nether|end` command.
- Added dimension-filtered player movement, join/leave and block-edit broadcasts; the server sends each destination's persisted block edits in batches.
- Added client handling for dimension snapshots, local world reset, safe-spawn search, same-dimension player/entity snapshots, and position updates.
- Mob/drop events and redstone set events remain Overworld-only; lever/repeater interactions and Mob attacks are disabled outside the Overworld. Full cross-dimension Mob, drops, redstone simulation, portals, survival travel, and room-dimension persistence are not implemented.
- Verification performed on this archive: Node MJS tests and ZIP integrity. TypeScript typecheck, browser/multiplayer runtime, and deployment are only reported if separately run below.


## 2026-11-21 — 初回ルームスナップショットのディメンション分離

- オンライン参加時の初期プレイヤー一覧が全ディメンションの参加者を含み得たため、参加者の `dimensionId` が新規参加者と一致する場合だけ初期スナップショットへ含めるよう修正。
- 既存のレガシー状態は `player()` でオーバーワールドへ正規化されるため、旧接続状態との互換性を維持。
- 回帰テストでWorker初期化処理の同一ディメンション条件を確認。
- Node MJSテスト・JavaScript/MJS構文検査・ZIP CRC検査を実行。
- 全ディメンションのMob/ドロップ/レッドストーンの実装、オンライン再接続時の次元位置保存、ポータル、全アイテム、完全互換などは引き続き未完了または未検証。


## 2026-11-21 — オンライン再接続時のディメンション・位置復元（部分対応）

- ルーム内のブラウザー識別子（既存 `cid`）ごとに、バージョン付きのディメンションID・位置・視点を `loc:<cid>` に保存。既存の `p:`（Vitals）/`i:`（Inventory）キーとは分離。
- 接続時に保存データを検証してから復元し、有効なサーバー保存位置があればクライアント送信の初期座標より優先。無効/未保存なら従来のクライアント初期座標とオーバーワールド既定値を使用。
- 正常切断・WebSocketエラー・ホストによるキック/ BANの処理、およびディメンション移動時に位置を保存。ストレージ書込失敗はログに記録し、入室処理自体は継続。
- バリデーターの単体テストとWorker接続経路の回帰テストを追加。
- `cid` はクライアント生成・提示のブラウザーIDであり、認証済みアカウントIDではない。端末/ブラウザーのデータ消去や別ブラウザーでは復元されない場合があり、認証・安全なアカウント移行は未実装。
- 本変更はオンライン再接続の部分対応。全アイテム、ポータル、サバイバル移動、各次元のMob/ドロップ/レッドストーン統合などは未完了または未検証。TypeScript/Vite/Cloudflare/ブラウザー実行は、実際に実行した場合を除き未検証。


## 2026-11-21 — オンラインのディメンション別ドロップ（部分対応）

- サーバーのドロップ記録に dimensionId を追加し、旧セーブの dimensionId 欠落はオーバーワールドとして移行。
- 入室・ディメンション移動スナップショット、生成・期限切れ・回収通知を同一次元の参加者に限定。回収要求もプレイヤーの現在次元と一致するドロップのみ受理。
- 永続化形式の後方互換を維持し、次元別ドロップの混線を防ぐ回帰テストを追加。
- 検証: Node MJSテスト全件、JavaScript/MJS構文検査、ZIP整合性検査。TypeScript/Vite、Cloudflare、ブラウザーでの動作は未検証。
- 制約: Mob・レッドストーンの全ディメンション対応、ポータル、全アイテム/全機能は未完了。


## 2026-11-21 — オンラインMobのディメンション分離（部分対応）

- Mob記録へ任意の dimensionId を追加。旧セーブの未指定Mobはオーバーワールドとして読み込み、不正・重複・上限超過レコードを除外。
- 入室/移動スナップショット、召喚・討伐・更新通知、攻撃対象の検証、Mob AIと衝突判定を同じディメンションに限定。ネザー/エンドでは対応する次元地形をAI衝突判定に使用。
- Mobの次元別保存は既存の単一Mob配列内の dimensionId で保持。NodeのMJS回帰テストとWorker配線テストを追加。
- 制約: 自然スポーン、Mob種類・ドロップ/装備/繁殖/ボスなどは別途未実装または未検証。TypeScript型検査、Vite/Cloudflare/ブラウザー/実マルチプレイは未検証。依頼全体の「全て」には至っていない。


## 2026-11-21 — 26.3ブロック識別子カタログ（基盤追加）

### 今回追加
- 添付 `client.zip` の `assets/minecraft/blockstates/*.json` のパスから、重複を除いた1288件の `minecraft:` ブロック識別子を `shared/minecraft-block-catalog.js` に追加。データ版は26.3 / 121.0。
- 既存の1658件アイテム識別子カタログと合わせ、後続のブロック/アイテム機能統合で利用できる参照カタログを整備。テクスチャやJSON資産・クラスファイルは複製していない。

### 検証
- 新規カタログの件数、重複、並び順、ID形式、lookup関数をテスト。
- プロジェクトのNodeテスト一式の実行結果は成果物作成後に記録。

### 未実装・重要な制約
- このカタログは識別子だけで、ゲーム内の設置/破壊、状態・モデル・テクスチャ、ドロップ、レシピ、インベントリ統合を実装しない。全ブロック・アイテム挙動やJava Edition完全互換を意味しない。


## Minecraft catalog runtime integration (incremental)
- Added append-only runtime IDs for the 1,288 Minecraft 26.3 block identifiers while preserving Koruva block IDs 0..91; air variants resolve to ID 0.
- Added basic block definitions for every catalog ID, four orientations for stair entries, simplified slab geometry, material-name-based existing atlas texture fallbacks, and `/give` lookup for `minecraft:` block IDs.
- Validation: covered by `test/minecraft-block-catalog.test.mjs`; this does **not** implement official models, block states, textures, recipes, non-block item behavior, or complete Java Edition parity.


## 2026-11-21 — Minecraft 26.3 resource expansion (asset-backed visuals)
- Added the referenced client 26.3 blockstate/model/item-definition and texture resources under `src/client/public/assets/minecraft/`.
- Built representative per-face texture maps for the 1,288 project block identifiers; `blocks.ts` now uses those paths and the runtime canvas atlas loads them with the procedural atlas as fallback.
- Added item texture lookup for all 1,658 item identifiers and a spawn-egg-derived mob roster.
- Verification is limited to Node tests and asset/path coverage. This is not Java Edition parity: full block models/states, item behaviors/recipes, portal activation, all mob models/AI/natural spawning, and browser/Cloudflare execution remain unverified or incomplete.


## 2026-11-21 — 26.3 spawn-egg全Mobの汎用AI/召喚/描画fallback

- `client.zip`由来の26.3 spawn-eggカタログ88種を、サーバー許可リストとMobプロフィールに反映。`/summon <mobId>`で登録種を生成でき、既存の次元別保存・同期処理を利用。
- 既存6種は従来のモデル/基本ステータスを維持。残りはpassive/melee/ranged/fuseの汎用AI archetypeに分類し、MobModelsに既存6モデルへの描画fallbackとタイプ別色調を追加。
- 全88種のプロフィール/作成/AI 1ステップ、主要4 archetype、登録数一致を検査する回帰テストを追加。
- これはMinecraftの種別固有AI・モデル・攻撃/ドロップ/繁殖/装備等の実装ではなく、全mob完全互換を意味しない。自然スポーン、バイオーム・昼夜条件、固有ボス戦も未実装。
- TypeScript型検査、Vite build、Cloudflare/ブラウザー実行はこの環境で依存パッケージが無く未確認。


## 第6回 — ポータル接触によるディメンション移動（2026-11-21、簡易実装）

- 最新版には既にソロの `/dimension` と、オンラインのホスト/クリエイティブ限定 `/dimension` 移動があることを確認。以前の作業メモにあった「オンライン移動未実装」は不正確なので訂正する。
- Nether/EndのポータルブロックIDを共有判定で扱い、プレイヤーが接触すると、ソロでは安全な到着地点へ移動、オンラインではサーバーが実際のブロック接触と移動先を検証して遷移する処理を追加。オンライン移動はポータル接触時に限りホスト/ゲームモード制限を迂回し、3.5秒のサーバークールダウンを適用。
- ポータルブロックを非衝突のcutout表示に変更。
- これは簡易接触ゲートであり、黒曜石フレームの形状検証、着火、ポータルリンク座標、ネザー座標倍率に応じたポータル生成/探索、ロード画面等は未実装。全Minecraft 26.3機能完成を意味しない。


## 2026-11-21 — ホスト用インベントリクリアコマンド（限定追加）

### 今回実装した内容
- ホスト専用サーバーコマンド `/clear [player|@r|@a|@s|@p|:name]` を実装（`/claer`も入力互換エイリアス）。対象省略時は実行者本人。対象の所持品全体を消去し、単品フィルタ引数は受け付けない。
- `@a`はルーム内参加者全員、`@s`は実行者、`@p`は実行者から最も近い参加者、`@r`はランダムな参加者、`:name`と素の名前は名前指定。未解決対象は変更せずエラー。
- 実装上の所持品データ（ブロック`counts`、食料`vitals.foodCounts`）を0にし、ホットバー割当もクライアント側で空にする。既存の保存・同期経路を使用し、copy-on-writeで入力状態を破壊しない。
- 現行プロジェクトに防具・オフハンド等の独立スロットは見当たらず、これらのMinecraft機能を追加したものではない。
- コマンド候補リストに `clear` を追加し、対象/アイテム候補の回帰テストを更新。

### 検証と未完了
- `node --test test/*.test.mjs`: 新規4件を含む132件成功、失敗0。Nodeの型消去構文チェック: 変更したTypeScript 3ファイル成功。`test/commands-stage.test.ts`もNode型消去+ローカルimport resolverで実行成功。TypeScript型検査 (`tsc`)、Vite build、Cloudflare実環境はsandboxにnpm/依存パッケージがないため未実施。
- `/tp`、完全なJava 26.3のアイテム/レシピ挙動、全Mob/AI/ディメンション/構造物、ブラウザー・Cloudflare実環境は未実装または未検証。今回を全要素完成とは扱わない。


## Teleport command stage (2026-11-21)

- Host-only `/tp` supports self-to-player, target-to-player, self-to-coordinates, and target-to-coordinates; coordinates accept `~` offsets and are range-checked. Player target resolution reuses room selectors.
- Position is persisted and broadcast to the room; clients reset movement/dig state on teleport. Cross-dimension teleportation and full Java command syntax/rotation-coordinate options are not implemented.


## 2026-11-21 — オーバーワールド基本自然Mobスポーン（限定実装）

- 空のオンラインルームでもMob tickを回し、15秒間隔・同時18体上限で自然スポーンを試行する仕組みを追加。生成Mobは既存の永続化・次元別配信を利用。
- スポーン候補はサバイバル/アドベンチャー参加者から水平16〜32ブロック離れた地表。2ブロックの頭上空間を確認し、水・溶岩内や既存Mobの近傍を避ける。
- 現行のワールド作成時刻を共有昼夜サイクルとして使い、昼は牛/豚/羊/鶏/兎、夜はゾンビ/スケルトン/クモ/クリーパーから選ぶ。
- 検証: `node --test test/natural-spawning.test.mjs` と `node --check shared/natural-spawning.js` を実行し成功。
- 制約: オーバーワールド限定の基本実装。バイオーム、光量、構造物、群れ、繁殖、自然Mob固有AI/ドロップ、Nether/Endの自然スポーンは未実装。Java Edition完全互換を意味しない。


## 第7回 — ディメンション・バイオーム別自然Mobスポーン（2026-11-21）

### 今回追加
- 自然スポーン試行をオーバーワールドだけでなく、NetherとEndにも接続。プレイヤーがいる各ディメンションで、既存のグローバル上限・ディメンション別上限・近接重複防止を適用。
- Overworldは昼夜と現在の5バイオーム区分、Netherは既存5バイオーム、EndはEnd諸島に対応する限定Mob候補を選択。
- Mobが天井に埋まらないよう、自然スポーン地点に3ブロックの空間を要求。
- `natural-spawning` の型定義と回帰テストを更新。

### 検証
- Node test summary: completed successfully; summary line not parsed.
- `node --check shared/natural-spawning.js` 成功。
- TypeScript型検査、Viteビルド、Cloudflare上の実動作はこの検証では実施していない。

### まだ未実装・未検証
- Java 26.3の正確な光量・難易度・月相・個別バイオーム/構造物条件によるスポーン判定、スポーンウェイト/グループ生成、全種Mobの固有AI・移動方式は未実装。Nether/Endの自然スポーンもこのプロジェクトの簡略地形に合わせた試作で、Java版との完全互換ではない。
- それ以前の進捗に記載した完全なブロック/アイテム/レシピ/液体/光/構造物/戦闘等の未実装項目も残る。


## 第8回 — 自然Mobの小規模グループスポーン（2026-11-21）

### 今回追加
- 牛・豚・羊・鶏・兎は2〜4体の小規模グループ、その他の自然スポーン候補は単体で出現する試作ルールを追加。
- 同じグループ内の各Mobについて、個別に床・3ブロックの空間・近接重複を検証。地形条件を満たさない場合は成立した分だけ出現。
- グローバルおよびディメンション別Mob上限の残数をグループ生成数に反映。

### 検証
- この段階で実行したテスト・構文検査結果は配布ZIP作成時の回答に記録。
- これは簡略化した独自ゲーム内の試作であり、Java版の正確なスポーンウェイト、群れサイズ、光量・難易度・個別条件との一致を意味しない。


## 第9回 — 自然Mobの距離ベースdespawn（2026-11-21）

### 今回追加
- 自然スポーン個体に `spawnReason: "natural"` を記録し、既存セーブ正規化でも保持。召喚Mobおよび古い保存データ（理由なし）は削除対象にしない。
- 自然Mobは同じディメンションの生存中プレイヤー全員から3D距離で128ブロックを超えた場合に削除し、同ディメンションへ `mobgone` を配信して既存保存処理に反映。該当ディメンションにプレイヤーがいないときは保持する。
- 境界距離、複数プレイヤー、別ディメンション、死亡プレイヤー、召喚/旧式Mob、保存正規化をテスト。

### 検証
- この段階の検証結果はZIP作成時の実行結果に基づき、回答に記載。
- Java Editionの厳密な距離/確率/永続化条件との一致を意味せず、全Mob機能完成ではない。


## 第10回 — Mob AIの遮蔽物チェック（2026-11-21）

### 今回追加
- Mob視点から対象プレイヤーへボクセルをサンプリングし、固体ブロックによる簡易視線判定を追加。
- 近接・遠距離Mobは遮蔽時に攻撃せず追跡し、クリーパーは遮蔽時にfuseを解除。
- 爆発時も対象プレイヤーごとに遮蔽を確認し、壁越しの爆風ダメージを防ぐ試作ルールを追加。

### 注意
- 簡易ボクセルray判定であり、Minecraft Java Editionの正確なレイキャスト・爆風遮蔽計算や完全な経路探索ではない。


## 第2回 — プレイヤー対Mob攻撃の遮蔽判定 (2026-11-21)
- Workerで攻撃者の目線からMob胴体までをサーバー側ワールドブロックでレイ判定し、固体ブロックに遮られた攻撃はダメージ処理前に拒否する。対象ディメンションの編集済みブロックと決定的地形生成の双方を `blockAt` 経由で参照する。
- Mob AIが使うサンプリング式の可視判定を `hasClearLine` として共有化。異常座標・判定関数なしは失敗側に倒す。
- 回帰テスト: 遮蔽物あり/なし、線外のブロック、異常入力、Worker側のワールド判定接続。
- 範囲外: これはサンプリング近似で、公式Minecraftの完全なレイキャスト/武器reach・攻撃物理の互換実装ではない。全機能実装も未完了。


## 2026-11-21 — Passive Mob flee response

- サーバーがパッシブMobへの有効な攻撃を受けたとき、攻撃者から離れる向きと4秒の期限を記録。
- パッシブMob AIは期限内にその向きへ一時的に逃げ、期限後は通常の待機・徘徊へ戻る。敵対MobのAIには影響しない。
- 保存データ読込時に逃走方向・期限を検証するテストを追加。
- 検証結果: Node `.mjs` テスト160件すべて成功、JavaScript構文検査とZIP整合性検査も成功。TypeScript型検査・ビルド・ゲーム内動作確認は未実施。Java版との全要素互換が完了した意味ではない。


## 2026-11-21 — Mob food loot (limited vertical slice)

- 既存のサーバー権威Mob死亡処理に、サバイバル/アドベンチャーの撃破者へ食料在庫を加算する処理を接続。Mob死亡を永続化してから報酬を適用し、既存のvitals保存・stats同期を使用。
- 生肉の食料定義（牛・豚・羊・兎）を追加。鶏、牛/ムーシュルーム、豚/ホグリン、羊、兎、ゾンビ系の限定ドロップ表を追加。食料在庫の上限は999。
- これは地面に落ちるアイテム实体ではなく、撃破者の食料在庫へ直接付与する限定実装。非食料ドロップ（骨/矢/革/羊毛等）、焼肉判定、経験値、全MobのLoot Table、Java 26.3完全互換は未実装。
- Nodeテスト: 163件成功。JS/MJS構文検査: 62ファイル成功。TypeScript型検査・Viteビルド・Cloudflare/ブラウザ実行は未検証。
