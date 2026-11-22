export const PORTAL_BLOCK_IDS: Readonly<{
  air: number;
  water: number;
  leaves: number;
  netherrack: number;
  obsidian: number;
  netherPortal: number;
}>;

export type PortalEdit = [number, number, number, number];
export type PortalGetter = (x: number, y: number, z: number) => number;

export function findPortalInterior(
  get: PortalGetter, x: number, y: number, z: number,
  ids?: typeof PORTAL_BLOCK_IDS
): [number, number, number][] | null;

export function tryLightPortal(
  get: PortalGetter,
  hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number },
  ids?: typeof PORTAL_BLOCK_IDS
): PortalEdit[] | null;

export function portalCollapseEdits(
  get: PortalGetter, x: number, y: number, z: number,
  ids?: typeof PORTAL_BLOCK_IDS
): PortalEdit[];

export function buildPortalEdits(
  x: number, y: number, z: number,
  ids?: typeof PORTAL_BLOCK_IDS
): { edits: PortalEdit[]; spawn: [number, number, number] };

export function scaleToDimension(from: number, x: number, z: number): [number, number];

export function findNearestPortal(
  get: PortalGetter, cx: number, cz: number, radius: number,
  yMin?: number, yMax?: number, ids?: typeof PORTAL_BLOCK_IDS
): [number, number, number] | null;

export function pickPortalY(
  get: PortalGetter, x: number, z: number, dimension: number,
  ids?: typeof PORTAL_BLOCK_IDS
): number;

export function findPortalBuildSite(
  get: PortalGetter, cx: number, cz: number,
  options?: { radius?: number; yMin?: number; yMax?: number; ids?: typeof PORTAL_BLOCK_IDS }
): { x: number; y: number; z: number } | null;

export const PORTAL_DELAY_SURVIVAL_MS: number;
export const PORTAL_DELAY_CREATIVE_MS: number;
