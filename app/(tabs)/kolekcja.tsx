import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";

const ALL = [
  { id: "deer", img: require("../../assets/baloniki_zwierzeta/zwierzeta/z28.png") },
  { id: "hippo", img: require("../../assets/baloniki_zwierzeta/zwierzeta/z19.png") },
  { id: "lollipop", img: require("../../assets/baloniki_zwierzeta/slodycze/s2.png") },
  { id: "donut", img: require("../../assets/baloniki_zwierzeta/slodycze/s4.png") },
  { id: "cherries", img: require("../../assets/baloniki_zwierzeta/owoce/o2.png") },
  { id: "strawberry", img: require("../../assets/baloniki_zwierzeta/owoce/o4.png") },
] as const;

async function getCollected(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function Kolekcja() {
  const [ids, setIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCollected().then(setIds);
    }, [])
  );

  const collected = ALL.filter((x) => ids.includes(x.id));
  const missing = ALL.filter((x) => !ids.includes(x.id));

  return (
    <View style={styles.safe}>
      <Text style={styles.h}>🎈</Text>

      <View style={styles.row}>
        {collected.map((it) => (
          <View key={it.id} style={styles.tile}>
            <Image source={it.img} style={styles.img} resizeMode="contain" />
          </View>
        ))}

        {missing.map((it) => (
          <View key={it.id} style={[styles.tile, styles.missing]}>
            <Image source={it.img} style={[styles.img, { opacity: 0.25 }]} resizeMode="contain" />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBFF", padding: 12 },
  h: { fontSize: 26, fontWeight: "900", marginBottom: 10 },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },

  tile: {
    width: "48%",
    height: 170,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3F1FF",
  },
  missing: { backgroundColor: "#ECF6FF" },

  img: { width: 130, height: 130 },
});
