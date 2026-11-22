export declare function nextRepeaterDelayBlockId(blockId:number,repeaterIds:readonly number[]):number|undefined;
export interface RedstoneWorldIds { source:number; wire:number; lampOff:number; lampOn:number; leverOn?:number; /** IDs ordered by delay group (1-4 ticks), then north/east/south/west. Four IDs mean 1 tick only. */ repeaters?:readonly number[] }
export interface RedstoneSignalCell { x:number; y:number; z:number; signal:number }
export interface RedstoneLampChange { x:number; y:number; z:number; from:number; to:number; signal:number }
export interface RedstoneRepeaterInput { x:number; y:number; z:number; powered:boolean; delayTicks:number }
export declare function evaluateRedstoneWorld(input:{x:number;y:number;z:number;blockAt:(x:number,y:number,z:number)=>number;ids:RedstoneWorldIds;maxNodes?:number;maxSteps?:number;repeaterOutputAt?:(x:number,y:number,z:number)=>boolean}):{bounded:true;nodeCount:number;signals:RedstoneSignalCell[];lampChanges:RedstoneLampChange[];repeaterInputs:RedstoneRepeaterInput[]}|{bounded:false;reason:"node-limit"|"work-limit";nodeCount:number};
