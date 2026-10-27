import { Tabs } from "expo-router";
import { theme, fonts } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.ink,
          borderTopColor: theme.line,
          height: 64,
        },
        tabBarActiveTintColor: theme.phosphor,
        tabBarInactiveTintColor: theme.moss,
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: 0.6,
          marginBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="ledger" options={{ title: "Ledger" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
