// Minimal 3-vector / 3x3-matrix helpers for the shotshaper port. Faithful ports of the specific
// numpy operations projectile.py/transforms.py use — nothing more. A "Vec3" is a plain [x,y,z]
// tuple and a "Mat3" is a row-major [[..],[..],[..]]. No dependency, no allocation cleverness;
// the sim runs a few hundred steps per throw, off the render path.
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export function norm3(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// matmul(M, v) — 3x3 times 3-vector.
export function matVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function transpose3(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}
