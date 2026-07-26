// Field view — ported from renderFieldView() in templates/index.html. Overlays every (filtered)
// bag disc's flight arc on one top-down field, each colored by the disc's own color or its
// stability, with a name label near each landing point. Tapping an arc opens the arc-detail
// sheet (the app reuses P1-2's ArcDetailModal instead of the website's hover balloon).
import { Fragment } from 'react';
import { Svg, Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';
import { stab, STAB_META, type Disc } from '../utils/disc';
import { applyModifiers, arcPoints, type SliderValues } from '../utils/legacyPhysics';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
const NEUTRAL: SliderValues = { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 };
const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const W = 400;
const H = 380;
const f = (v: number) => +v.toFixed(1);

interface Props {
  discs: Disc[];
  arcView: ArcView;
  onSelectDisc: (d: Disc) => void;
}

export default function FieldView({ discs, arcView, onSelectDisc }: Props) {
  if (discs.length === 0) return null;
  const pts = discs.map((d) => ({
    d,
    p: arcPoints(applyModifiers(d, NEUTRAL), W, H, arcView),
    color: d.color && HEX6.test(d.color) ? d.color : STAB_META[stab(d)].color,
  }));
  const { sy: sy0, ey: ey0, cx: cx0 } = pts[0].p;
  const g1y = f(ey0 + (sy0 - ey0) * 0.33);
  const g2y = f(ey0 + (sy0 - ey0) * 0.66);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={0} y1={g1y} x2={W} y2={g1y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        <Line x1={0} y1={g2y} x2={W} y2={g2y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        <Line x1={f(cx0)} y1={f(sy0 - 6)} x2={f(cx0)} y2={ey0} stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="6 7" />
        <Rect x={f(cx0 - 18)} y={f(sy0 - 5)} width={36} height={10} rx={3} fill="rgba(255,255,255,0.07)" />
        <SvgText x={f(cx0)} y={f(sy0 + 18)} fill="rgba(255,255,255,0.22)" fontSize={9} textAnchor="middle">
          TEE
        </SvgText>

        {pts.map(({ d, p, color }, i) => {
          const aw = 6;
          const px = -p.ny * aw;
          const py = p.nx * aw;
          const ly = f(p.ey + (i % 2 === 0 ? 13 : 24));
          return (
            <Fragment key={d.id ?? i}>
              <Path d={`M ${p.sx},${p.sy} Q ${p.q0x},${p.q0y} ${p.mx},${p.my}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2} strokeLinecap="round" />
              <Path d={`M ${p.mx},${p.my} Q ${p.q2x},${p.q2y} ${p.endX},${p.ey}`} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              <Circle cx={p.endX} cy={p.ey} r={3.5} fill={color} />
              <Polyline
                points={`${f(p.endX - p.nx * aw + px)},${f(p.ey - p.ny * aw + py)} ${p.endX},${p.ey} ${f(p.endX - p.nx * aw - px)},${f(p.ey - p.ny * aw - py)}`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <SvgText x={p.endX} y={ly} fill={color} fontSize={10} fontWeight="600" textAnchor="middle" opacity={0.9}>
                {d.mold}
              </SvgText>
              {/* Wide transparent hit target over the whole curve, matching the website's data-fidx path. */}
              <Path
                d={`M ${p.sx},${p.sy} Q ${p.q0x},${p.q0y} ${p.mx},${p.my} Q ${p.q2x},${p.q2y} ${p.endX},${p.ey}`}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                onPress={() => onSelectDisc(d)}
              />
            </Fragment>
          );
        })}

        <Circle cx={f(cx0)} cy={f(sy0)} r={5} fill="rgba(255,255,255,0.5)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: W / H,
    alignSelf: 'center',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1,
    borderColor: '#252b45',
    overflow: 'hidden',
    marginTop: 4,
  },
});
