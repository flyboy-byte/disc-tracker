import { Tabs } from 'expo-router';
import TabBarIcon from '../../src/components/TabBarIcon';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Each screen renders its own large title with top padding (see index/flight-shaper/
        // disc-suggest), so the native header would be a redundant second title — hide it.
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Bag', tabBarIcon: ({ color }) => <TabBarIcon name="bag" color={color} /> }}
      />
      <Tabs.Screen
        name="flight-shaper"
        options={{ title: 'Flight Shaper', tabBarIcon: ({ color }) => <TabBarIcon name="flight" color={color} /> }}
      />
      <Tabs.Screen
        name="disc-suggest"
        options={{ title: 'Disc Suggest', tabBarIcon: ({ color }) => <TabBarIcon name="suggest" color={color} /> }}
      />
    </Tabs>
  );
}
