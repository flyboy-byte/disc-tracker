// A large, on-brand graphic for empty states — reuses the app's own tab-bar SVG icon inside a
// soft purple-tinted circle, so the "nothing here yet" screens feel designed rather than blank.
// No new dependency (TabBarIcon is react-native-svg, already bundled).
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import TabBarIcon from './TabBarIcon';

export default function EmptyStateIcon({ name }: { name: 'bag' | 'flight' | 'suggest' | 'settings' | 'score' }) {
  return (
    <View style={styles.badge}>
      <TabBarIcon name={name} color={colors.accent} size={34} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(145,94,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(145,94,255,0.22)',
    marginBottom: 6,
  },
});
