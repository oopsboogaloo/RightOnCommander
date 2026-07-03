// Station screen: the docked, slowly-rotating ship against the dock, the system blurb and the
// player's balance, with a tappable menu wired to the pure station intents. Pure render + hit
// rectangles — the shell routes a tap to the matching intent. [tasks T6.2, ROC-STN-1..7]

import type { Renderer2D } from '../renderer2d.js';
import { modelMatrix } from '../project.js';
import { vec3 } from '../../sim/math/vec3.js';
import type { Mesh } from '../../interfaces.js';
import type { World } from '../../sim/world.js';
import { nextShipId, equippedCount, DIRECTIONS, type LaserType } from '../../sim/systems/ships.js';
import type { StationContext } from '../../sim/systems/station.js';

export type StationAction =
  | 'sell'
  | 'buyShip'
  | 'laserType'
  | 'fitFront'
  | 'fitRear'
  | 'fitLeft'
  | 'fitRight'
  | 'ecm'
  | 'bomb'
  | 'pod'
  | 'life'
  | 'missile'
  | 'launch';

export interface StationButton {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  enabled: boolean;
  action: StationAction;
}

const affordable = (world: World, cost: number): boolean => world.econ.wallet >= cost;
const freeIn = (world: World, dir: (typeof DIRECTIONS)[number]): number => world.player.hardpoints[dir] - world.player.lasers[dir].length;

// Lay out the menu (right column) with current labels + enabled flags. `launchArmed` flips the
// Launch row into its confirmation state. [ROC-STN-2..7, ROC-ECO-8]
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const fitAction = { front: 'fitFront', rear: 'fitRear', left: 'fitLeft', right: 'fitRight' } as const;

export function stationButtons(world: World, ctx: StationContext, w: number, h: number, launchArmed: boolean, selected: LaserType): StationButton[] {
  const { prices, ships } = ctx;
  const next = nextShipId(ships, world.player.shipClass);
  const cargoTons = Object.values(world.cargo).reduce((n, t) => n + t, 0);
  const laserPrice = prices.lasers[selected];

  const defs: { label: string; enabled: boolean; action: StationAction }[] = [
    { label: `Sell Cargo (${cargoTons}T)`, enabled: cargoTons > 0, action: 'sell' },
    next
      ? { label: `Buy ${ships.ships[next].name}  ${ships.ships[next].price}cr`, enabled: affordable(world, ships.ships[next].price), action: 'buyShip' }
      : { label: 'Top ship owned', enabled: false, action: 'buyShip' },
    // Pick a laser type, then fit it to any free direction (so side/rear lasers are buyable). [ROC-STN-4]
    { label: `Laser type: ${cap(selected)}  (${laserPrice}cr)`, enabled: true, action: 'laserType' },
    ...DIRECTIONS.map((dir) => {
      const cap_ = world.player.hardpoints[dir];
      const lasers = world.player.lasers[dir];
      const used = lasers.length;
      // A full direction can still take a different laser type by bumping whichever one is
      // already there, refunding its price (e.g. military can replace a beam). [ROC-LAS-5,6]
      const full = freeIn(world, dir) <= 0 && cap_ > 0;
      const replaceIdx = full ? lasers.findIndex((t) => t !== selected) : -1;
      const replace = replaceIdx >= 0 ? (lasers[replaceIdx] as LaserType) : null;
      const price = replace ? laserPrice - prices.lasers[replace] : laserPrice;
      return {
        label: replace
          ? `Fit ${cap(dir)} (${used}/${cap_}) replace ${replace}  ${price}cr`
          : `Fit ${cap(dir)} (${used}/${cap_})  ${price}cr`,
        enabled: (freeIn(world, dir) > 0 || replace !== null) && affordable(world, price),
        action: fitAction[dir] as StationAction,
      };
    }),
    { label: `Buy ECM  ${prices.equipment.ecm}cr`, enabled: affordable(world, prices.equipment.ecm), action: 'ecm' },
    { label: `Buy Energy Bomb  ${prices.equipment.bomb}cr`, enabled: affordable(world, prices.equipment.bomb), action: 'bomb' },
    { label: `Buy Escape Pod  ${prices.equipment.pod}cr`, enabled: !world.player.escapePod && affordable(world, prices.equipment.pod), action: 'pod' },
    { label: `Buy Life  ${prices.equipment.life}cr`, enabled: world.player.lives < 5 && affordable(world, prices.equipment.life), action: 'life' },
    { label: `Missile +1  ${prices.equipment.missile}cr`, enabled: world.player.missileGrade < 4 && affordable(world, prices.equipment.missile), action: 'missile' },
    { label: launchArmed ? 'CONFIRM LAUNCH' : 'Launch', enabled: true, action: 'launch' },
  ];

  const colX = w * 0.5;
  const colW = w * 0.46;
  const rowH = Math.min(34, (h - 90) / defs.length);
  const y0 = 80;
  return defs.map((d, i) => ({ x: colX, y: y0 + i * rowH, w: colW, h: rowH - 4, ...d }));
}

export function buttonAt(buttons: StationButton[], px: number, py: number): StationButton | undefined {
  return buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
}

const strokeRect = (r: Renderer2D, b: StationButton, color: string): void => {
  const p = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
  for (let i = 0; i < 4; i++) r.drawLine(p[i], p[(i + 1) % 4], { stroke: color, lineWidth: 1 });
};

export function drawStation(
  renderer: Renderer2D,
  world: World,
  ctx: StationContext,
  meshes: Record<string, Mesh>,
  buttons: StationButton[],
  dims: { w: number; h: number; time: number },
): void {
  const { w, h, time } = dims;

  // Docked ship, slowly rotating, upper-left of the panel.
  const mesh = meshes[world.entities.get(1)?.meshId ?? 'sidewinder'];
  if (mesh) renderer.drawMesh(mesh, modelMatrix(vec3(-0.45, 0, 0.5), time * 0.6, 0, 0.6));

  renderer.drawText('DOCKED — CORIOLIS STATION', { x: w / 2, y: 32 }, { fill: '#8ad', font: '18px monospace', align: 'center' });
  renderer.drawText('Lave, a safe agricultural world.', { x: w / 2, y: 52 }, { fill: '#567', font: '12px monospace', align: 'center' });

  // Status column (left).
  const lasers = world.player.lasers;
  const fitted = DIRECTIONS.filter((d) => lasers[d].length).map((d) => `${cap(d)}:${lasers[d].join('/')}`).join('  ') || 'none';
  const totalHp = DIRECTIONS.reduce((n, d) => n + world.player.hardpoints[d], 0);
  const lines = [
    `Credits: ${world.econ.wallet}cr`,
    `Ship: ${ctx.ships.ships[world.player.shipClass]?.name ?? world.player.shipClass}`,
    `Lasers (${equippedCount(lasers)}/${totalHp} hp): ${fitted}`,
    `Lives: ${world.player.lives}   Pod: ${world.player.escapePod ? 'yes' : 'no'}`,
    `ECM: ${world.player.ecm}  Bombs: ${world.player.energyBombs}  Missile: L${world.player.missileGrade}`,
  ];
  lines.forEach((t, i) => renderer.drawText(t, { x: 20, y: h - 130 + i * 20 }, { fill: '#9ab', font: '13px monospace', align: 'left' }));

  // Menu (right).
  for (const b of buttons) {
    const color = b.enabled ? '#6cf' : '#345';
    strokeRect(renderer, b, color);
    renderer.drawText(b.label, { x: b.x + 10, y: b.y + b.h / 2 + 4 }, { fill: color, font: '13px monospace', align: 'left' });
  }
}
