export type License = { owner?: string; orderId?: string };
export type Built = { zip: Uint8Array; fileName: string };
export type Kit = { parse(design: unknown): { name: string }; build(design: never, preview: Uint8Array | null, lic: License): Promise<Built> };
