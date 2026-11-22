export interface DropItemTextureDefinition {
  key: string;
  itemOnly?: boolean;
  iconTexture?: string;
}
export function itemDropTexturePath(def: DropItemTextureDefinition | null | undefined): string | null;
