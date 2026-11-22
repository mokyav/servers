export interface SoloRedstoneIds { source: number; wire: number; lampOff: number; lampOn: number; leverOn?: number; repeaters: number[] }
export interface SoloRedstoneTransition { id: string; powered: boolean; dueTick: number }
export interface SoloRedstoneSnapshot { version: 1; accumulator: number; queue: unknown }
export interface SoloRedstoneRuntime {
  evaluateAt(x: number, y: number, z: number): { bounded: boolean; [key: string]: unknown };
  onBlockChanged(x: number, y: number, z: number): { bounded: boolean; [key: string]: unknown };
  advance(deltaSeconds: number): SoloRedstoneTransition[];
  snapshot(): SoloRedstoneSnapshot; restore(state: SoloRedstoneSnapshot): void; clear(): void;
  readonly tick: number; readonly pending: number;
}
export declare function createSoloRedstoneRuntime(options: { blockAt(x:number,y:number,z:number):number; setBlock(x:number,y:number,z:number,blockId:number):void; ids:SoloRedstoneIds; tickSeconds?:number; maxNodes?:number; maxSteps?:number; maxPending?:number }): SoloRedstoneRuntime;
