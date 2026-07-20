import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme';

// Placeholder — Phase 1 scaffold only. Real Flight Shaper screen lands in Phase 5.
export default function FlightShaperScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Flight Shaper</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 18 },
});
