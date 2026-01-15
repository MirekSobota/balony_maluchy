import { Tabs } from "expo-router";
import { Text } from "react-native";

function Icon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarShowLabel: false }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: () => <Icon emoji="🎯" /> }} />
      <Tabs.Screen name="kolekcja" options={{ tabBarIcon: () => <Icon emoji="🎈" /> }} />
    </Tabs>
  );
}
