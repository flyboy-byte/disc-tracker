// Direct port of the static hyzer/anhyzer "X" reference SVG in templates/flightshape.html —
// hand-authored coordinates, never touched by JS on the website either, so this is a pure
// 1:1 markup port with no dynamic logic.
import { View } from 'react-native';
import Svg, { Ellipse, Line, Text as SvgText } from 'react-native-svg';

export default function HyzerReferenceDiagram() {
  return (
    <View style={{ width: '100%', maxWidth: 340, aspectRatio: 340 / 94, alignSelf: 'center' }}>
    <Svg width="100%" height="100%" viewBox="0 0 340 94">
      <Line x1={110} y1={18} x2={230} y2={76} stroke="rgba(255,255,255,0.05)" strokeWidth={10} strokeLinecap="round" />
      <Line x1={230} y1={18} x2={110} y2={76} stroke="rgba(255,255,255,0.05)" strokeWidth={10} strokeLinecap="round" />

      <Ellipse cx={110} cy={20} rx={28} ry={6} rotation={-24} origin="110,20" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth={1.5} />
      <Ellipse cx={230} cy={20} rx={28} ry={6} rotation={24} origin="230,20" fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth={1.5} />
      <Ellipse cx={170} cy={47} rx={28} ry={6} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} />
      <Ellipse cx={110} cy={74} rx={28} ry={6} rotation={24} origin="110,74" fill="rgba(145,94,255,0.1)" stroke="#915EFF" strokeWidth={1.5} />
      <Ellipse cx={230} cy={74} rx={28} ry={6} rotation={-24} origin="230,74" fill="rgba(145,94,255,0.1)" stroke="#915EFF" strokeWidth={1.5} />

      <SvgText x={170} y={9} fill="#fbbf24" fontSize={8.5} textAnchor="middle" fontWeight="600" opacity={0.75}>
        Anhyzer
      </SvgText>
      <SvgText x={170} y={61} fill="rgba(255,255,255,0.3)" fontSize={8.5} textAnchor="middle" fontWeight="600">
        Flat
      </SvgText>
      <SvgText x={170} y={91} fill="#915EFF" fontSize={8.5} textAnchor="middle" fontWeight="600" opacity={0.75}>
        Hyzer
      </SvgText>

      <SvgText x={42} y={43} fill="rgba(255,255,255,0.55)" fontSize={8} textAnchor="middle" fontWeight="600">
        Right Hand
      </SvgText>
      <SvgText x={42} y={54} fill="rgba(255,255,255,0.55)" fontSize={8} textAnchor="middle" fontWeight="600">
        Forehand
      </SvgText>
      <SvgText x={298} y={43} fill="rgba(255,255,255,0.55)" fontSize={8} textAnchor="middle" fontWeight="600">
        Right Hand
      </SvgText>
      <SvgText x={298} y={54} fill="rgba(255,255,255,0.55)" fontSize={8} textAnchor="middle" fontWeight="600">
        Backhand
      </SvgText>
    </Svg>
    </View>
  );
}
