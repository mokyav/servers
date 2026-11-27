/**
 * Vanilla-style cuboid rigs for the mobs that previously borrowed an unrelated atlas.
 *
 * Every entry is authored in Java model space (pivot / box origin / size / texOffs, y pointing
 * down, root offset 24) and converted by J() into the renderer's coordinate space:
 *   x = x, y = 24 - y, z = -z      (+z is the mob's front, 1 unit = 1/16 block)
 * Rotations are applied about the part pivot, in Java's Z*Y*X order, so a rotated part keeps the
 * same centre that the vanilla ModelPart would produce.
 */
const round = (v) => Math.round(v * 1000) / 1000;

function rotateZYX([x, y, z], rx, ry, rz) {
  let y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
  y = y1; z = z1;
  const x2 = x * Math.cos(ry) + z * Math.sin(ry), z2 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x2; z = z2;
  const x3 = x * Math.cos(rz) - y * Math.sin(rz), y3 = x * Math.sin(rz) + y * Math.cos(rz);
  return [x3, y3, z];
}

/** Builds one renderer Part from Java model data. */
export function J(pivot, origin, size, uv, o = {}) {
  const rx = o.rx ?? 0, ry = o.ry ?? 0, rz = o.rz ?? 0;
  const centre = [origin[0] + size[0] / 2, origin[1] + size[1] / 2, origin[2] + size[2] / 2];
  const r = rotateZYX(centre, rx, ry, rz);
  const part = {
    size: [...size],
    pos: [round(pivot[0] + r[0]), round(24 - (pivot[1] + r[1])), round(-(pivot[2] + r[2]))],
    uv: [...uv],
  };
  if (rx) part.rotationX = round(rx);
  if (ry) part.rotationY = round(-ry);
  if (rz) part.rotationZ = round(-rz);
  if (o.mirror) part.mirrorX = true;
  if (o.inflate) part.inflate = o.inflate;
  if (o.leg) part.leg = true;
  if (o.layer) part.layer = o.layer;
  return part;
}

const HALF_PI = Math.PI / 2;

function blazeRods() {
  const rods = [];
  const ring = (count, startAngle, radius, y) => {
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * HALF_PI;
      rods.push(J([Math.cos(angle) * radius, y, Math.sin(angle) * radius], [0, 0, 0], [2, 8, 2], [0, 16]));
    }
  };
  ring(4, 0, 9, -2);
  ring(4, Math.PI / 4, 7, 2);
  ring(4, 0.47123889, 5, 11);
  return rods;
}

function spiderLegs() {
  const q = Math.PI / 4, e = Math.PI / 8, m = 0.58119464;
  // [pivot z, yaw, roll] for hind, middle-hind, middle-front and front legs (right side; left mirrors).
  const rows = [[2, q, -q], [1, e, -m], [0, -e, -m], [-1, -q, -q]];
  const legs = [];
  for (const [z, ry, rz] of rows) {
    legs.push(J([-4, 15, z], [-15, -1, -1], [16, 2, 2], [18, 0], { ry, rz }));
    legs.push(J([4, 15, z], [-1, -1, -1], [16, 2, 2], [18, 0], { ry: -ry, rz: -rz }));
  }
  return legs;
}

function illagerBody() {
  return [
    J([0, 0, 0], [-4, -10, -4], [8, 10, 8], [0, 0]),
    J([0, -2, 0], [-1, -1, -6], [2, 4, 2], [24, 0]),
    J([0, 0, 0], [-4, 0, -3], [8, 12, 6], [16, 20]),
    J([0, 0, 0], [-4, 0, -3], [8, 18, 6], [0, 38], { inflate: 0.5 }),
    J([0, 3, -1], [-8, -2, -2], [4, 8, 4], [44, 22], { rx: -0.75 }),
    J([0, 3, -1], [4, -2, -2], [4, 8, 4], [44, 22], { rx: -0.75, mirror: true }),
    J([0, 3, -1], [-4, 2, -2], [8, 4, 4], [40, 38], { rx: -0.75 }),
    J([-2, 12, 0], [-2, 0, -2], [4, 12, 4], [0, 22], { leg: true }),
    J([2, 12, 0], [-2, 0, -2], [4, 12, 4], [0, 22], { leg: true, mirror: true }),
  ];
}

/** Atlas sizes of the extra rigs (width, height). */
export const EXTRA_RIG_TEXTURE_SIZES = Object.freeze({
  sheep: [64, 32], wolf: [64, 32], cat: [64, 32], spider: [64, 32], enderman: [64, 32], slime: [64, 32],
  blaze: [64, 32], iron_golem: [128, 128], snow_golem: [64, 64], illager: [64, 64], witch: [64, 128],
});

/** Native model height in blocks. The renderer scales it to the server hitbox height. */
export const EXTRA_RIG_BASE_HEIGHTS = Object.freeze({
  sheep: 1.3, wolf: 0.85, cat: 0.7, spider: 0.9, enderman: 2.9, slime: 0.52,
  blaze: 1.8, iron_golem: 2.7, snow_golem: 1.75, illager: 1.95, witch: 1.95,
});

export const EXTRA_RIGS = Object.freeze({
  // SheepModel + SheepFurModel (wool is a separate inflated layer on the same atlas layout).
  sheep: [
    J([0, 6, -8], [-3, -4, -6], [6, 6, 8], [0, 0]),
    J([0, 5, 2], [-4, -10, -7], [8, 16, 6], [28, 8], { rx: HALF_PI }),
    J([-3, 12, 7], [-2, 0, -2], [4, 12, 4], [0, 16], { leg: true }),
    J([3, 12, 7], [-2, 0, -2], [4, 12, 4], [0, 16], { leg: true }),
    J([-3, 12, -5], [-2, 0, -2], [4, 12, 4], [0, 16], { leg: true }),
    J([3, 12, -5], [-2, 0, -2], [4, 12, 4], [0, 16], { leg: true }),
    J([0, 6, -8], [-3, -4, -4], [6, 6, 6], [0, 0], { inflate: 0.6, layer: "sheep/sheep_wool" }),
    J([0, 5, 2], [-4, -10, -7], [8, 16, 6], [28, 8], { rx: HALF_PI, inflate: 1.75, layer: "sheep/sheep_wool" }),
    J([-3, 12, 7], [-2, 0, -2], [4, 6, 4], [0, 16], { inflate: 0.5, layer: "sheep/sheep_wool" }),
    J([3, 12, 7], [-2, 0, -2], [4, 6, 4], [0, 16], { inflate: 0.5, layer: "sheep/sheep_wool" }),
    J([-3, 12, -5], [-2, 0, -2], [4, 6, 4], [0, 16], { inflate: 0.5, layer: "sheep/sheep_wool" }),
    J([3, 12, -5], [-2, 0, -2], [4, 6, 4], [0, 16], { inflate: 0.5, layer: "sheep/sheep_wool" }),
  ],
  wolf: [
    J([-1, 13.5, -7], [-2, -3, -2], [6, 6, 4], [0, 0]),
    J([-1, 13.5, -7], [-2, -5, 0], [2, 2, 1], [16, 14]),
    J([-1, 13.5, -7], [2, -5, 0], [2, 2, 1], [16, 14]),
    J([-1, 13.5, -7], [-0.5, 0, -5], [3, 3, 4], [0, 10]),
    J([0, 14, 2], [-3, -2, -3], [6, 9, 6], [18, 14], { rx: HALF_PI }),
    J([-1, 14, -3], [-3, -3, -3], [8, 6, 7], [21, 0], { rx: HALF_PI }),
    J([-2.5, 16, 7], [0, 0, -1], [2, 8, 2], [0, 18], { leg: true }),
    J([0.5, 16, 7], [0, 0, -1], [2, 8, 2], [0, 18], { leg: true }),
    J([-2.5, 16, -4], [0, 0, -1], [2, 8, 2], [0, 18], { leg: true }),
    J([0.5, 16, -4], [0, 0, -1], [2, 8, 2], [0, 18], { leg: true }),
    J([-1, 12, 8], [0, 0, -1], [2, 8, 2], [9, 18], { rx: 0.9 }),
  ],
  // OcelotModel / CatModel.
  cat: [
    J([0, 15, -9], [-2.5, -2, -3], [5, 4, 5], [0, 0]),
    J([0, 15, -9], [-1.5, -0.001, -4], [3, 2, 2], [0, 24]),
    J([0, 15, -9], [-2, -3, 0], [1, 1, 2], [0, 10]),
    J([0, 15, -9], [1, -3, 0], [1, 1, 2], [6, 10]),
    J([0, 12, -10], [-2, 3, -8], [4, 16, 6], [20, 0], { rx: HALF_PI }),
    J([0, 15, 8], [-0.5, 0, 0], [1, 8, 1], [0, 15], { rx: 0.9 }),
    J([0, 20, 14], [-0.5, 0, 0], [1, 8, 1], [4, 15], { rx: 1.1 }),
    J([1.1, 18, 5], [-1, 0, 1], [2, 6, 2], [8, 13], { leg: true }),
    J([-1.1, 18, 5], [-1, 0, 1], [2, 6, 2], [8, 13], { leg: true }),
    J([1.2, 14.1, -5], [-1, 0, 0], [2, 10, 2], [40, 0], { leg: true }),
    J([-1.2, 14.1, -5], [-1, 0, 0], [2, 10, 2], [40, 0], { leg: true }),
  ],
  spider: [
    J([0, 15, -3], [-4, -4, -8], [8, 8, 8], [32, 4]),
    J([0, 15, 0], [-3, -3, -3], [6, 6, 6], [0, 0]),
    J([0, 15, 9], [-5, -4, -6], [10, 8, 12], [0, 12]),
    ...spiderLegs(),
  ],
  // EndermanModel: head/body deformation -0.5, 30-pixel limbs.
  enderman: [
    J([0, -13, 0], [-4, -8, -4], [8, 8, 8], [0, 0], { inflate: -0.5 }),
    J([0, -14, 0], [-4, 0, -2], [8, 12, 4], [32, 16]),
    J([-5, -12, 0], [-1, -2, -1], [2, 30, 2], [56, 0], { leg: true }),
    J([5, -12, 0], [-1, -2, -1], [2, 30, 2], [56, 0], { leg: true }),
    J([-2, -5, 0], [-1, 0, -1], [2, 30, 2], [56, 0], { leg: true }),
    J([2, -5, 0], [-1, 0, -1], [2, 30, 2], [56, 0], { leg: true }),
  ],
  // SlimeModel: opaque core with face on top of the translucent outer cube.
  slime: [
    J([0, 0, 0], [-3, 17, -3], [6, 6, 6], [0, 16]),
    J([0, 0, 0], [-3.25, 18, -3.5], [2, 2, 2], [32, 0]),
    J([0, 0, 0], [1.25, 18, -3.5], [2, 2, 2], [32, 4]),
    J([0, 0, 0], [0, 21, -3.5], [1, 1, 1], [32, 8]),
    J([0, 0, 0], [-4, 16, -4], [8, 8, 8], [0, 0]),
  ],
  blaze: [
    J([0, 0, 0], [-4, -4, -4], [8, 8, 8], [0, 0]),
    ...blazeRods(),
  ],
});

// Iron golem / snow golem / illagers are assigned after the literal so their long definitions stay readable.
const IRON_GOLEM = [
  J([0, -7, -2], [-4, -12, -5.5], [8, 10, 8], [0, 0]),
  J([0, -7, -2], [-1, -5, -7.5], [2, 4, 2], [24, 0]),
  J([0, -7, 0], [-9, -2, -6], [18, 12, 11], [0, 40]),
  J([0, -7, 0], [-4.5, 10, -3], [9, 5, 6], [0, 70], { inflate: 0.5 }),
  J([0, -7, 0], [-13, -2.5, -3], [4, 30, 6], [60, 21], { leg: true }),
  J([0, -7, 0], [9, -2.5, -3], [4, 30, 6], [60, 58], { leg: true }),
  J([-4, 11, 0], [-3.5, -3, -3], [6, 16, 5], [37, 0], { leg: true }),
  J([5, 11, 0], [-3.5, -3, -3], [6, 16, 5], [60, 0], { leg: true, mirror: true }),
];

const SNOW_GOLEM = [
  J([0, 4, 0], [-4, -8, -4], [8, 8, 8], [0, 0], { inflate: -0.5 }),
  J([0, 13, 0], [-5, -10, -5], [10, 10, 10], [0, 16], { inflate: -0.5 }),
  J([0, 24, 0], [-6, -12, -6], [12, 12, 12], [0, 36], { inflate: -0.5 }),
  J([5, 6, 1], [-1, 0, -1], [12, 2, 2], [32, 0], { rz: 1, inflate: -0.5 }),
  J([-5, 6, -1], [-1, 0, -1], [12, 2, 2], [32, 0], { ry: Math.PI, rz: -1, inflate: -0.5 }),
];

const WITCH_HAT = [
  J([0, 0, 0], [-5, -10.03, -5], [10, 2, 10], [0, 64]),
  J([0, 0, 0], [-3.25, -14.03, -3], [7, 4, 7], [0, 76]),
  J([0, 0, 0], [-1.5, -18.03, -1], [4, 4, 4], [0, 87]),
  J([0, 0, 0], [0.25, -20.03, 1], [1, 2, 1], [0, 95], { inflate: 0.25 }),
];

export const MOB_RIG_PARTS = Object.freeze({
  ...EXTRA_RIGS,
  iron_golem: IRON_GOLEM,
  snow_golem: SNOW_GOLEM,
  illager: illagerBody(),
  witch: [...illagerBody(), ...WITCH_HAT],
});
