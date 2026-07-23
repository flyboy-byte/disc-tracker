// Port of updateAngleRef() in templates/flightshape.html — back-view (hyzer/anhyzer tilt)
// and side-view (nose up/down tilt) reference diagrams, plus the dynamic direction-hint
// note. Colors mirror the website's inline COLORS object (mirrors :root, since SVG strings
// can't reference CSS custom properties).
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';

const NOTES: Record<ArcView, string> = {
  RHBH: 'RHBH — hyzer fades left at finish, anhyzer turns right first',
  RHFH: 'RHFH — hyzer fades right at finish, anhyzer turns left first',
  LHBH: 'LHBH — hyzer fades right at finish, anhyzer turns left first',
  LHFH: 'LHFH — hyzer fades left at finish, anhyzer turns right first',
};

interface Props {
  hyzer: number;
  nose: number;
  arcView: ArcView;
}

export default function AngleRefDiagrams({ hyzer, nose, arcView }: Props) {
  const isFH = arcView === 'RHFH' || arcView === 'LHBH';
  const hyzerDir = isFH ? '→ R' : '→ L';
  const anhyzerDir = isFH ? '→ L' : '→ R';

  const hTilt = isFH ? -hyzer : hyzer;
  const hColor = hyzer === 0 ? 'rgba(255,255,255,0.25)' : hyzer > 0 ? colors.os : colors.us;
  const dirLabel = hyzer === 0 ? '' : hyzer > 0 ? ` ${hyzerDir}` : ` ${anhyzerDir}`;
  const hLabel = hyzer === 0 ? 'flat' : `${Math.abs(hyzer)}° ${hyzer > 0 ? 'hyzer' : 'anhyzer'}${dirLabel}`;

  const nTilt = -nose;
  const nColor = nose === 0 ? 'rgba(255,255,255,0.25)' : nose > 0 ? colors.st : colors.danger;
  const nLabel = nose === 0 ? 'flat' : `${Math.abs(nose)}° nose ${nose > 0 ? 'up' : 'down'}`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.diagram}>
          <Svg width={120} height={72} viewBox="0 0 120 72">
            <Line x1={8} y1={36} x2={112} y2={36} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
            <Ellipse
              cx={60}
              cy={36}
              rx={44}
              ry={8}
              rotation={hTilt}
              origin="60,36"
              fill="rgba(145,94,255,0.07)"
              stroke={hColor}
              strokeWidth={1.5}
            />
            <Circle cx={60} cy={36} r={2} fill={hColor} opacity={0.6} rotation={hTilt} origin="60,36" />
            <SvgText x={60} y={64} fill={hColor} fontSize={9} textAnchor="middle" fontWeight="600" opacity={0.85}>
              {hLabel}
            </SvgText>
          </Svg>
          <Text style={styles.caption}>Back view</Text>
        </View>
        <View style={styles.diagram}>
          <Svg width={120} height={72} viewBox="0 0 120 72">
            <Line x1={8} y1={36} x2={112} y2={36} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
            <Ellipse
              cx={60}
              cy={36}
              rx={38}
              ry={7}
              rotation={nTilt}
              origin="60,36"
              fill="rgba(74,222,128,0.06)"
              stroke={nColor}
              strokeWidth={1.5}
            />
            <SvgText x={60} y={64} fill={nColor} fontSize={9} textAnchor="middle" fontWeight="600" opacity={0.85}>
              {nLabel}
            </SvgText>
            <SvgText x={98} y={39} fill={nColor} fontSize={11} textAnchor="middle" opacity={0.5}>
              {'→'}
            </SvgText>
          </Svg>
          <Text style={styles.caption}>Side view</Text>
        </View>
      </View>
      <Text style={styles.note}>{NOTES[arcView]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  diagram: { alignItems: 'center' },
  caption: { fontSize: 9, color: colors.muted, marginTop: 3, opacity: 0.7, letterSpacing: 0.5, textTransform: 'uppercase' },
  note: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 16, opacity: 0.75 },
});
