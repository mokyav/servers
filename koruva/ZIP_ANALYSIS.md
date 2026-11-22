# ZIP_ANALYSIS — 入力アーカイブ調査

調査日: 2026-11-21 (JST)

## 対象
- Koruva基準: `koruva-java-26.3-mob-material-loot-stage.zip` (7,690,999 bytes)。この作業版を基準とした。
- 参照資料: `client.zip` (60,421,210 bytes, SHA-256 `ddd32b1bfec2d617…`)。
- `client/version.json` に `id=26.3`, world version 5023, protocol 777, resource 97.1, data 121.0, Java 25 と記録。

## ZIP内構成・棚卸し
`client.zip` は `client/` 以下にクラス、`assets/minecraft/`、`data/minecraft/` を持つ展開済みクライアント資産形式。ZIPにはmacOS由来メタデータも含まれる。ファイル名と件数を棚卸ししたが、全内容の意味解析はしていない。

|領域|ファイル数/観測|備考|
|---|---:|---|
|Java bytecode `.class`|11,383|逆コンパイル/AI挙動の完全解析はしていない|
|Javaソース `.java`|0|ソースコードはこのZIPに見つからなかった|
|JAR|0|このZIP自体は実行JARではなく展開物|
|Recipe|2,042|データファイルの個数。全レシピを検証した意味ではない|
|Loot table|1,447|同上|
|Worldgen data|1,144|同上|
|Structure|1,511|NBT等を含む。全構造物を個別に確認していない|
|Advancement|1,866|同上|
|Enchantment|43|登録データ数|
|Blockstate|1,288|assets側の定義数|
|Models|4,192|ブロック/アイテム等のモデル資産数|
|Texture files|4,186|全画像を目視/ライセンス確認していない|
|Particle definitions|115|定義数|

## Koruva側の構造
`shared/`, `src/client/`, `src/worker/`, `test/` を確認。Three.jsクライアント、TypeScript/Vite、Cloudflare Workers/Durable Objectsを使う構成。`package.json`にはtest/typecheck/build/deploy scripts がある。既存resource manifestは `src/client/public/assets/minecraft/koruva-resource-manifest.json`。

## 制約と権利
`client.zip`の調査は版メタデータ・パス・件数が中心。全ブロック状態、レシピ、AI、音響、GUI、アニメーション等の振る舞いを解析済みとは報告しない。アーカイブ内のMinecraft由来素材のライセンス/再配布権は未確認であり、公開配布前に権利確認が必要。本サイクルでは参照アーカイブの画像・音声・クラスを新規コピーしていない。

## 統合作業 2026-11-21

- サイクル6のモバイル操作・描画設定・自動最適化と Inventory Stage 2 のアイテム／インベントリ処理を統合。A側の性能UI・モバイル操作を残し、B側のインベントリUIとデータ処理を合流。
- サーバーの versioned player save（位置・体力・所持品）を維持し、装備スロットも保存対象に追加。
- Minecraftクライアント由来のシェーダー／リソース素材は成果物へコピーしていない。`client.zip` は構造調査のみで全ファイル解析ではなく、素材の完全ライセンス調査も未了。
- アイテムIDカタログ件数は、各アイテムの完全な挙動・レシピ・テクスチャ実装件数を意味しない。

