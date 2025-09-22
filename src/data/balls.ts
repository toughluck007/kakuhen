export type BallKey = 'Standard' | 'Heavy' | 'Bouncy' | 'Cluster';

export interface BallSpec {
  key: BallKey;
  radius: number;
  restitution: number;
  density: number;
  splitHits?: number;
  shards?: number;
  shardRadius?: number;
}

export const BALL_LIBRARY: Record<BallKey, BallSpec> = {
  Standard: { key: 'Standard', radius: 8, restitution: 0.5, density: 1 },
  Heavy: { key: 'Heavy', radius: 10, restitution: 0.2, density: 1.2 },
  Bouncy: { key: 'Bouncy', radius: 7, restitution: 0.85, density: 0.9 },
  Cluster: {
    key: 'Cluster',
    radius: 6,
    restitution: 0.6,
    density: 0.95,
    splitHits: 6,
    shards: 4,
    shardRadius: 4,
  },
};

export const DEFAULT_BALL: BallSpec = BALL_LIBRARY.Standard;
