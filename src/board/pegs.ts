import { Bodies, Body } from 'matter-js';
import type { PegDefinition } from '../data/pegs';

export interface PegEntity {
  id: string;
  body: Body;
  definition: PegDefinition;
}

export function createPegBody(definition: PegDefinition): PegEntity {
  const body = Bodies.circle(definition.position.x, definition.position.y, definition.radius, {
    isStatic: true,
    label: 'peg',
    restitution: 0.6,
    friction: 0,
  });

  (body as Body & { plugin: Record<string, unknown> }).plugin = {
    ...(body as Body & { plugin: Record<string, unknown> }).plugin,
    pegDefinition: definition,
  };

  return {
    id: definition.id,
    body,
    definition,
  };
}
