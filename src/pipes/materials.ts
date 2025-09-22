export type PipeMaterialKey = 'Standard' | 'Glow' | 'Glass' | 'Chrome';

export interface PipeMaterial {
  key: PipeMaterialKey;
  base: number;
  step: number;
  color: [number, number, number];
  emissive: number;
  highlight: number;
}

export const PIPE_MATERIALS: Record<PipeMaterialKey, PipeMaterial> = {
  Standard: {
    key: 'Standard',
    base: 12,
    step: 1,
    color: [196, 80, 60],
    emissive: 0.1,
    highlight: 0.45,
  },
  Glow: {
    key: 'Glow',
    base: 18,
    step: 0.9,
    color: [180, 95, 90],
    emissive: 0.8,
    highlight: 0.95,
  },
  Glass: {
    key: 'Glass',
    base: 20,
    step: 0.8,
    color: [195, 15, 95],
    emissive: 0.25,
    highlight: 1,
  },
  Chrome: {
    key: 'Chrome',
    base: 15,
    step: 1,
    color: [220, 5, 85],
    emissive: 0.45,
    highlight: 0.7,
  },
};

export function getMaterial(key: PipeMaterialKey): PipeMaterial {
  return PIPE_MATERIALS[key];
}

export const MATERIAL_SEQUENCE: PipeMaterialKey[] = ['Standard', 'Glow', 'Glass', 'Chrome'];
