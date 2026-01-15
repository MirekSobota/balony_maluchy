import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Image, FlatList, Pressable, Text, Alert, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BALLOONS, type Balloon } from "../../constants/balloons";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";

const TUTORIAL_DONE_KEY = "TUTORIAL_DONE_V1";
const TUTORIAL_STEP_KEY = "TUTORIAL_STEP_V1";
type TutorialStep = 0 | 1 | 2 | 3;

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

async function clearCollected() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function loadTutorial() {
  const done = (await AsyncStorage.getItem(TUTORIAL_DONE_KEY)) === "1";
  const stepRaw = await AsyncStorage.getItem(TUTORIAL_STEP_KEY);
  const step = stepRaw !== null ? Number(stepRaw) : null;
  return { done, step: step as TutorialStep | null };
}

async function setTutorialStep(step: TutorialStep) {
  await AsyncStorage.setItem(TUTORIAL_STEP_KEY, String(step));
}

function HandPointer({ x, y }: { x: number; y: number }) {
  return (
    <View pointerEvents="none" style={[styles.hand, { left: x, top: y }]}>
      <Text style={styles.handText}>👇</Text>
    </View>
  );
}

export default function Kolekcja() {
  const [ids, setIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [showTutorialBack, setShowTutorialBack] = useState(false);

  const refresh = useCallback(() => {
    getCollected().then(setIds);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();

      (async () => {
        const t = await loadTutorial();
        // jeśli byliśmy na grze w kroku 2 i weszliśmy w kolekcję → pokaż rękę na 🎯
        if (!t.done && t.step === 2) {
          await setTutorialStep(3);
          setShowTutorialBack(true);
        } else if (!t.done && t.step === 3) {
          setShowTutorialBack(true);
        } else {
          setShowTutorialBack(false);
        }
      })();
    }, [refresh])
  );

  const ownedSet = useMemo(() => new Set(ids), [ids]);
  const ownedCount = ids.length;
  const totalCount = BALLOONS.length;

  const onDevReset = () => {
    Alert.alert(
      "Reset collection",
      "Remove all collected balloons?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await clearCollected();
            refresh();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderItem = ({ item }: { item: Balloon }) => {
    const owned = ownedSet.has(item.id);
    return (
      <View style={[styles.tile, !owned ? styles.missing : null]}>
        <Image source={item.img} style={[styles.img, !owned ? { opacity: 0.25 } : null]} resizeMode="contain" />
      </View>
    );
  };

  // pozycja ręki na lewy tab (🎯)
  const tabY = H - (insets.bottom + 48);
  const handGameX = W * 0.18;
  const handGameY = tabY - 60;

  return (
    <View style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>🎈 {ownedCount}/{totalCount}</Text>

        <Pressable onLongPress={onDevReset} delayLongPress={600} style={({ pressed }) => [styles.devBtn, pressed ? { opacity: 0.8 } : null]}>
          <Text style={styles.devBtnText}>RESET</Text>
        </Pressable>
      </View>

      <FlatList
        data={BALLOONS}
        keyExtractor={(it) => it.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />

      {showTutorialBack && <HandPointer x={handGameX} y={handGameY} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBFF", padding: 12 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  counter: { fontSize: 20, fontWeight: "900" },

  devBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFE8E8",
    borderWidth: 1,
    borderColor: "#FFBABA",
  },
  devBtnText: { fontWeight: "900" },

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

  hand: { position: "absolute", zIndex: 999 },
  handText: { fontSize: 44 },
});
