import { Bodies, Body } from 'matter-js';
import type { BallSpec } from '../data/balls';

export interface BallEntity {
  id: string;
  body: Body;
  spec: BallSpec;
  spawnedAt: number;
  isShard: boolean;
}

let BALL_COUNTER = 0;

export function createBall(spec: BallSpec, position: { x: number; y: number }): BallEntity {
  const body = Bodies.circle(position.x, position.y, spec.radius, {
    restitution: spec.restitution,
    density: spec.density,
    friction: 0.02,
    frictionAir: 0.01,
    label: 'ball',
  });

  (body as Body & { plugin: Record<string, unknown> }).plugin = {
    ...(body as Body & { plugin: Record<string, unknown> }).plugin,
    ballSpec: spec,
  };

  BALL_COUNTER += 1;

  return {
    id: `ball-${BALL_COUNTER}`,
    body,
    spec,
    spawnedAt: performance.now(),
    isShard: false,
  };
}
