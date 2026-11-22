# TODO — 次の優先順位

## P0: 安全に継続するための検証
- [ ] `npm test`, TypeScript typecheck, Vite/Workers buildを依存が揃った環境で実行。
- [ ] client.zip由来と記録されたassetの配布権・ライセンスを確認。未確認素材を再配布しない手順を決める。
- [~] room auth/invitation/session/host roleと再接続identityをコード・テストで監査 (BAN-before-saveと同時hello名予約を強化。CID所有確認・セッション再接続監査は継続)。
- [~] Player save state now has a versioned transactional snapshot, legacy-key migration, and tests; world-level snapshot/backup/restore remains TODO.

## P1: 要求機能の縦切り
- [~] 10 quality levels now apply render distance, Mob client draw distance, and bounded client chunk generation/meshing budgets; shader capability probing and other renderer features remain.
- [ ] capability detectionとshader fallbackを実装し、端末でのWebGL/browser QA。
- [ ] full inventory slots, equipment, cursor transaction, containersをserver-authoritativeに接続。
- [~] 採掘レベルによるツール採取制限・主要鉱石/砂利ドロップを実装。個体耐久はslot-based inventory移行後。
- [ ] crafting/furnace recipes, inputs/outputs, persistence testsを段階的に追加。
- [ ] survival damage/death/respawnとdrop loopを統合テスト。
- [ ] Mob type別行動、drops, XP, spawn/despawnのdimension/biome/daylight tests拡張。
- [ ] portal/biome/structure worldgenを一つずつ完成させ、seed reproducibilityとchunk-boundary testsを追加。

## P2: 長期プレイ機能
- [ ] redstone/fluid/farming tick simulationをserver-side bounded queueで実装し、負荷上限/loop tests。
- [ ] 取引/進捗/エンチャント/ポーション/音響を共通データ駆動で追加。
- [ ] multi-client reconnect, item duplication, permission, long-running memory tests。

- [ ] モバイル実機で縦横回転、safe-area、仮想スティックと複数アクションの同時入力、長押し解除、タップ可能なホットバーを確認・調整。
- [ ] キー割り当てUIと、モバイル操作レイアウト/感度/ボタン配置のユーザー設定は別途設計・実装。


## Mobile validation follow-up
- Smoke-test multi-touch (move + look + jump/action) on iOS Safari and Android Chrome, including pointercancel, app background/foreground, browser chrome resize, portrait/landscape and safe-area devices.
- Measure touch sensitivity and hit targets on low-width phones/tablets; tune from device feedback.
- Implement crouch only after adding matching client/server gameplay semantics; do not bind it to the current sprint key.
