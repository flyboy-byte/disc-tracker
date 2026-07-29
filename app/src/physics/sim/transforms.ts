// Faithful port of vendor/shotshaper/transforms.py. Axis conventions (verbatim from source):
//   1: Earth   2: Body   3: Zero side slip   4: Wind axes
// Only the six transforms projectile.py imports are ported (T_12, T_23, T_34, T_14, T_41, T_31);
// the transpose helpers (T_21/T_32/T_43) are inlined where used, exactly as the Python does.
import { matVec, transpose3, type Mat3, type Vec3 } from './linalg';

const { cos, sin } = Math;

// Transform from Earth axes to Body axes.
export function T_12(attitude: Vec3): Mat3 {
  const [phi, theta, psi] = attitude;
  return [
    [cos(theta) * cos(psi), sin(phi) * sin(theta) * cos(psi) - cos(phi) * sin(psi), cos(phi) * sin(theta) * cos(psi) + sin(phi) * sin(psi)],
    [cos(theta) * sin(psi), sin(phi) * sin(theta) * sin(psi) + cos(phi) * cos(psi), cos(phi) * sin(theta) * sin(psi) - sin(phi) * cos(psi)],
    [-sin(theta), sin(phi) * cos(theta), cos(phi) * cos(theta)],
  ];
}

// Body → Zero side slip (rotation about z by side-slip angle beta).
export function T_23(beta: number): Mat3 {
  return [
    [cos(beta), -sin(beta), 0],
    [sin(beta), cos(beta), 0],
    [0, 0, 1],
  ];
}

// Zero side slip → Wind axes (rotation about y by angle of attack alpha).
export function T_34(alpha: number): Mat3 {
  return [
    [cos(alpha), 0, -sin(alpha)],
    [0, 1, 0],
    [sin(alpha), 0, cos(alpha)],
  ];
}

export function T_14(vec: Vec3, attitude: Vec3, beta: number, alpha: number): Vec3 {
  return matVec(T_34(alpha), matVec(T_23(beta), matVec(T_12(attitude), vec)));
}

export function T_41(vec: Vec3, attitude: Vec3, beta: number, alpha: number): Vec3 {
  return matVec(transpose3(T_12(attitude)), matVec(transpose3(T_23(beta)), matVec(transpose3(T_34(alpha)), vec)));
}

export function T_31(vec: Vec3, attitude: Vec3, beta: number): Vec3 {
  return matVec(transpose3(T_12(attitude)), matVec(transpose3(T_23(beta)), vec));
}
