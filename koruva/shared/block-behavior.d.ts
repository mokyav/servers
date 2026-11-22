export function blockToken(id:number, blocks: readonly unknown[]): string;
export function isReplaceableBlock(id: number, blocks: readonly unknown[]): boolean;
export function isFallingBlock(id: number, blocks: readonly unknown[]): boolean;
export function neighborCells(x: number, y: number, z: number): Array<{x:number;y:number;z:number}>;
export function blockSupportPosition(id: number, x: number, y: number, z: number, blocks: readonly unknown[]): {x:number;y:number;z:number} | null;
export function requiresBlockSupport(id: number, blocks: readonly unknown[]): boolean;
export function pairedBlockPosition(id:number,x:number,y:number,z:number,blocks: readonly unknown[]): {x:number;y:number;z:number} | null;
export function canBlockStay(get: (x:number,y:number,z:number)=>number, id:number, x:number,y:number,z:number, blocks: readonly unknown[]): boolean;
export function canPlaceBlockAt(get: (x:number,y:number,z:number)=>number, id:number, x:number,y:number,z:number, blocks: readonly unknown[]): boolean;
