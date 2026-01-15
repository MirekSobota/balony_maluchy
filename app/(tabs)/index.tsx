import React, { useEffect, useState } from "react";
import { SafeAreaView, View, StyleSheet, Pressable, Image, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";

const ASSETS = [
  { id: "deer", img: require("../../assets/baloniki_zwierzeta/zwierzeta/z28.png") },
  { id: "hippo", img: require("../../assets/baloniki_zwierzeta/zwierzeta/z19.png") },
  { id: "lollipop", img: require("../../assets/baloniki_zwierzeta/slodycze/s2.png") },
  { id: "donut", img: require("../../assets/baloniki_zwierzeta/slodycze/s4.png") },
  { id: "cherries", img: require("../../assets/baloniki_zwierzeta/owoce/o2.png") },
  { id: "strawberry", img: require("../../assets/baloniki_zwierzeta/owoce/o4.png") },
] as const;

type Item = (typeof ASSETS)[number];

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRound() {
  const grid = shuffle([...ASSETS]);
  const target = grid[Math.floor(Math.random() * grid.length)];
  return { grid, target };
}

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

async function addCollected(id: string) {
  const current = await getCollected();
  if (current.includes(id)) return current.length;
  const next = [...current, id];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next.length;
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const [{ grid, target }, setRound] = useState(() => pickRound());
  const [hintOn, setHintOn] = useState(false);
  const [lock, setLock] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

  const [soundCorrect, setSoundCorrect] = useState<Audio.Sound | null>(null);
  const [soundWrong, setSoundWrong] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    getCollected().then((c) => setCollectedCount(c.length));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await Audio.Sound.createAsync(require("../../assets/sounds/correct.mp3"), { volume: 1 });
      const no = await Audio.Sound.createAsync(require("../../assets/sounds/wrong.mp3"), { volume: 1 });
      if (!mounted) return;
      setSoundCorrect(ok.sound);
      setSoundWrong(no.sound);
    })();

    return () => {
      mounted = false;
      soundCorrect?.unloadAsync();
      soundWrong?.unloadAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHintOn(false);
    const t = setTimeout(() => setHintOn(true), 2500);
    return () => clearTimeout(t);
  }, [target.id]);

  const next = () => setRound(pickRound());

  const play = async (s: Audio.Sound | null) => {
    if (!s) return;
    try {
      await s.replayAsync();
    } catch {}
  };

  const onPick = async (item: Item) => {
    if (lock) return;

    if (item.id === target.id) {
      setLock(true);
      setHintOn(false);

      await play(soundCorrect);

      const newCount = await addCollected(item.id);
      setCollectedCount(newCount);

      setTimeout(() => {
        setLock(false);
        next();
      }, 550);
    } else {
      await play(soundWrong);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top + 8 }]}>
      {/* HEADER: DUŻY CEL + postęp */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.targetBig}>
            <Image source={target.img} style={styles.targetBigImg} resizeMode="contain" />
          </View>

          <Text style={styles.progress}>🎈 {collectedCount}/{ASSETS.length}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {grid.map((it) => (
          <Pressable
            key={it.id}
            disabled={lock}
            onPress={() => onPick(it)}
            style={({ pressed }) => [
              styles.tile,
              pressed && !lock ? styles.tilePressed : null,
              hintOn && it.id === target.id ? styles.tileHint : null,
            ]}
          >
            <Image source={it.img} style={styles.asset} resizeMode="contain" />
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}> </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBFF", paddingHorizontal: 12 },

  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3F1FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // DUŻY CEL
  targetBig: {
    width: 92,
    height: 92,
    borderRadius: 22,
    backgroundColor: "#F3F9FF",
    borderWidth: 3,
    borderColor: "#9BE7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  targetBigImg: { width: 72, height: 72 },

  progress: { fontSize: 20, fontWeight: "900" },

  grid: {
    flex: 1,
    paddingTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  tile: {
    width: "48%",
    height: 170,
    backgroundColor: "#ECF6FF",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3F1FF",
  },
  tilePressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  tileHint: { borderWidth: 3, borderColor: "#9BE7FF" },

  asset: { width: 130, height: 130 },
  footer: { textAlign: "center", paddingBottom: 8, opacity: 0.5 },
});
