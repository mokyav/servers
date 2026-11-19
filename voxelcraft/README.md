# VoxelCraft マルチ

ブラウザで動くオリジナルのボクセルサンドボックス。Three.js + Cloudflare Workers + Durable Objects(WebSocket)。
**ルームコードで最大8人が同じワールドに入り、ブロックの設置・破壊がリアルタイムに同期されます。**

## 起動

```bash
npm install
npm run dev          # クライアントをビルドして wrangler dev (http://localhost:8787)
```
2つのブラウザタブ(または別ブラウザ)を開き、片方で「ルームを作成」→ 表示されたコードをもう片方で「参加」。

クライアントだけ高速に開発したい場合: ターミナル1で `npx wrangler dev`、ターミナル2で `npm run dev:client`(Vite が /api と /ws を 8787 へプロキシ)。

## デプロイ

### A. コマンドライン
```bash
npx wrangler login
npm run deploy       # 型チェック → vite build → wrangler deploy
```
初回デプロイ時に Durable Object のマイグレーション(`new_sqlite_classes`)が自動適用されます。**無料プランでも動作します**(SQLite バックエンドの Durable Object)。

### B. Cloudflare ダッシュボード(Git 連携 / Workers Builds)
Workers & Pages → Create → Import a repository で GitHub リポジトリを選択し:

| 項目 | 値 |
|---|---|
| ルートディレクトリ | このプロジェクトのフォルダ(例 `voxelcraft`) |
| ビルドコマンド | `npm run build` |
| デプロイコマンド | `npx wrangler deploy` |

Worker 名は `wrangler.jsonc` の `name`(`voxelcraft`)と一致させてください。

## 構成

```
shared/            クライアント・サーバー共通(ブロック定義・プロトコル型・入力検証)
src/worker/        Cloudflare Worker (index.ts) と Durable Object (room.ts)
src/client/        Three.js クライアント
  worldgen.ts      シードからの決定的な地形生成(純粋関数)
  world.ts         チャンク管理・編集差分
  mesher.ts        隠れ面カリング + 頂点AO のメッシュ生成(three 非依存)
  chunkview.ts     チャンクのロード/破棄/メッシュ化キュー、描画(フラスタムカリング)
  physics.ts       AABB 衝突・ボクセルレイキャスト
  sky.ts / atlas.ts / remote.ts / net.ts / save.ts / ui.ts / main.ts
test/              ロジックのテスト (npm test)
```

## 仕組み

- **ワールド = シード + 編集差分**。地形はシードから両クライアントで同じように生成され、サーバーは編集差分のみをチャンク単位(`c:<cx>,<cz>` → 16KBの配列)で Durable Object Storage に保存します。入室時に差分が全送信されます。
- **ブロック同期**: クライアントは楽観的に即反映 → サーバーが検証(座標範囲・ブロックID・岩盤保護・到達距離・レート制限)して全員へ `set` を配信。拒否されたら `reject` で巻き戻し。同時編集はサーバー到着順が勝ちます。
- **Hibernation API**: 操作がない間は Durable Object がメモリから退避し、課金が止まります。keep-alive は `ping`/`pong` の自動応答(起こさない)。
- **描画の効率化**: 16×16×64 のチャンク単位メッシュ / 隠れ面カリング / チャンク単位フラスタムカリング / 描画距離外の破棄 / 1フレームあたりの生成・メッシュ化数の上限 / 編集時は該当チャンク(境界なら隣も)のみ再メッシュ。
- **昼夜**: ルームではサーバー作成時刻基準で全員同じ時刻(1日=8分)。ソロは保存対象。
- **セーブ・ロード**: ソロはブラウザの localStorage(ポーズメニューのセーブ/ロード + 15秒ごとに自動保存)。ルームのワールドはサーバーに常時保存、プレイヤー位置とホットバーはブラウザに保存。

## 操作

WASD 移動 / マウス 視点 / 左 破壊 / 右 設置 / 中クリック ブロック取得 / 1–9・ホイール ホットバー / E インベントリ / T・Enter チャット / Tab プレイヤー一覧 / V 三人称(自分のスキン確認) / Space 2回 飛行(Space 上昇、Shift 下降)/ Shift ダッシュ / Esc メニュー

## 既知の制限・今後

- PC(キーボード+マウス)専用。タッチ操作は未対応。
- ルーム入室時に編集差分を全件送信します。大規模ワールドではチャンク単位の遅延配信が必要です。
- 編集は1操作ごとに 16KB のチャンク配列を書き込みます。負荷が増えたらアラームでまとめ書きしてください。
- 古いルームの自動削除、ルーム作成のレート制限、洞窟/バイオーム、アイテム/体力は未実装です。
- スキンは4色指定の手続き生成です(画像アップロード未対応)。
- 外部アセットは一切使っていません。テクスチャ・モデルはすべてコードで生成しています。
