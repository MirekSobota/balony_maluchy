import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Image, FlatList } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { BALLOONS, type Balloon } from "../../constants/balloons";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";

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

  const set = useMemo(() => new Set(ids), [ids]);

  const renderItem = ({ item }: { item: Balloon }) => {
    const owned = set.has(item.id);
    return (
      <View style={[styles.tile, !owned ? styles.missing : null]}>
        <Image source={item.img} style={[styles.img, !owned ? { opacity: 0.25 } : null]} resizeMode="contain" />
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <FlatList
        data={BALLOONS}
        keyExtractor={(it) => it.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingBottom: 16, gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBFF", padding: 12 },

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
