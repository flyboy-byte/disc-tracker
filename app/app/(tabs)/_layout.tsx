import { Tabs } from 'expo-router';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bag' }} />
      <Tabs.Screen name="flight-shaper" options={{ title: 'Flight Shaper' }} />
      <Tabs.Screen name="disc-suggest" options={{ title: 'Disc Suggest' }} />
    </Tabs>
  );
}
