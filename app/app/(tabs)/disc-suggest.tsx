import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme';

// Placeholder — Phase 1 scaffold only. Real Disc Suggest screen lands in Phase 6.
export default function DiscSuggestScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Disc Suggest</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 18 },
});
