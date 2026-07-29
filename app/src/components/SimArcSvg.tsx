// Renders a shotshaper physics-sim trajectory — direct port of renderSimPath() in
// templates/flightshape.html, but drawing the on-device sim output (src/physics/sim) instead of
// the server's. Same geometry: downrange (world x) maps tee→landing bottom-to-top, lateral (world
// y) maps left↔right at a fixed metres-per-pixel scale. Cyan, distinct from the legacy Bézier arc.
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const ARC_W = 280;
const ARC_H = 420;
const SIM_COLOR = '#38bdf8'; // --sim token, matches the website

interface Props {
  points: [number, number][];
}

export default function SimArcSvg({ points }: Props) {
  if (!points || points.length < 2) {
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
        <SvgText x={ARC_W / 2} y={ARC_H / 2} fill="rgba(255,255,255,0.25)" fontSize={11} textAnchor="middle">
          No trajectory returned
        </SvgText>
      </Svg>
    );
  }

  const W = ARC_W;
  const H = ARC_H;
  const pad = W * 0.1;
  const sy = H * 0.925;
  const ey = H * 0.075;
  const cx = W / 2;
  const pxPerM = 5.5;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const maxDist = Math.max(...points.map((p) => p[0]));

  const svgPts = points.map(([x, y]) => [
    clamp(cx + y * pxPerM, pad, W - pad),
    sy - (maxDist > 0 ? x / maxDist : 0) * (sy - ey),
  ]);
  const d = 'M ' + svgPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  const [sx0, sy0] = svgPts[0];
  const [ex, eyp] = svgPts[svgPts.length - 1];

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
      <Line x1={cx} y1={+(sy + 6).toFixed(1)} x2={cx} y2={ey} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="6 8" />
      <SvgText x={cx} y={+(sy + 20).toFixed(1)} fill="rgba(255,255,255,0.2)" fontSize={10} textAnchor="middle">
        TEE
      </SvgText>
      <Path d={d} fill="none" stroke={SIM_COLOR} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={+sx0.toFixed(1)} cy={+sy0.toFixed(1)} r={6} fill="rgba(255,255,255,0.45)" />
      <Circle cx={+ex.toFixed(1)} cy={+eyp.toFixed(1)} r={6} fill={SIM_COLOR} />
      <SvgText x={cx} y={12} fill="rgba(56,189,248,0.7)" fontSize={9} textAnchor="middle">
        shotshaper sim — {maxDist.toFixed(0)}m
      </SvgText>
    </Svg>
  );
}
