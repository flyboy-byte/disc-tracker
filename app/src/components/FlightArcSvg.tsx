// Direct port of drawArc() in templates/flightshape.html — same geometry (arcPoints()),
// same ghost-arc-when-not-neutral behavior, rendered with react-native-svg instead of
// innerHTML. Physics-sim mode (server-side shotshaper) is intentionally not ported —
// the mobile app must not depend on the Flask server (CLAUDE.md hard constraint) — so
// this only renders the legacy Bézier arc, which is all PORT_PLAN.md Phase 5 scopes.
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { STAB_META, stab } from '../utils/disc';
import { arcPoints, type AdjustedDisc, type BaseDisc, type SliderValues } from '../utils/legacyPhysics';

const ARC_W = 280;
const ARC_H = 420;

interface Props {
  adjusted: AdjustedDisc;
  baseDisc: BaseDisc | null;
  sliders: SliderValues;
  arcView: 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
}

export default function FlightArcSvg({ adjusted, baseDisc, sliders, arcView }: Props) {
  const color = STAB_META[stab(adjusted)].color;
  const p = arcPoints(adjusted, ARC_W, ARC_H, arcView);
  const f = (v: number) => +v.toFixed(1);
  const aw = 9;
  const pxv = -p.ny * aw;
  const pyv = p.nx * aw;
  const g1y = f(p.ey + (p.sy - p.ey) * 0.33);
  const g2y = f(p.ey + (p.sy - p.ey) * 0.66);

  const isNeutral =
    sliders.hyzer === 0 && sliders.nose === 0 && sliders.wind === 0 && sliders.armSpeed === 100 && sliders.spin === 100;
  const showGhost = !isNeutral && baseDisc;
  const pb = showGhost ? arcPoints(baseDisc!, ARC_W, ARC_H, arcView) : null;
  const gaw = 7;
  const gpx = pb ? -pb.ny * gaw : 0;
  const gpy = pb ? pb.nx * gaw : 0;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
      <Line x1={0} y1={g1y} x2={ARC_W} y2={g1y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      <Line x1={0} y1={g2y} x2={ARC_W} y2={g2y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      <Line
        x1={p.cx}
        y1={f(p.sy + 6)}
        x2={p.cx}
        y2={p.ey}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={1}
        strokeDasharray="6 8"
      />
      <Rect x={f(p.cx - 18)} y={f(p.sy - 5)} width={36} height={10} rx={3} fill="rgba(255,255,255,0.07)" />
      <SvgText x={p.cx} y={f(p.sy + 20)} fill="rgba(255,255,255,0.2)" fontSize={10} textAnchor="middle">
        TEE
      </SvgText>

      {pb && (
        <>
          <Path
            d={`M ${pb.sx},${pb.sy} Q ${pb.q0x},${pb.q0y} ${pb.mx},${pb.my}`}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="7 5"
          />
          <Path
            d={`M ${pb.mx},${pb.my} Q ${pb.q2x},${pb.q2y} ${pb.endX},${pb.ey}`}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="7 5"
          />
          <Circle cx={pb.endX} cy={pb.ey} r={4} fill="rgba(255,255,255,0.1)" />
          <Polyline
            points={`${f(pb.endX - pb.nx * gaw + gpx)},${f(pb.ey - pb.ny * gaw + gpy)} ${pb.endX},${pb.ey} ${f(pb.endX - pb.nx * gaw - gpx)},${f(pb.ey - pb.ny * gaw - gpy)}`}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      <Path
        d={`M ${p.sx},${p.sy} Q ${p.q0x},${p.q0y} ${p.mx},${p.my}`}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Path
        d={`M ${p.mx},${p.my} Q ${p.q2x},${p.q2y} ${p.endX},${p.ey}`}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Circle cx={p.sx} cy={p.sy} r={6} fill="rgba(255,255,255,0.45)" />
      <Circle cx={p.endX} cy={p.ey} r={6} fill={color} />
      <Polyline
        points={`${f(p.endX - p.nx * aw + pxv)},${f(p.ey - p.ny * aw + pyv)} ${p.endX},${p.ey} ${f(p.endX - p.nx * aw - pxv)},${f(p.ey - p.ny * aw - pyv)}`}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
