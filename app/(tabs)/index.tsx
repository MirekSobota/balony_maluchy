import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView, View, StyleSheet, Pressable, Image, Text, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BALLOONS, type Balloon } from "../../constants/balloons";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";
const GRID_SIZE = 6;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

function Tile({
  item,
  isHint,
  disabled,
  onPress,
}: {
  item: Balloon;
  isHint: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isHint) {
      shake.stopAnimation();
      shake.setValue(0);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: -3, duration: 70, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: 3, duration: 70, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: -2, duration: 70, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: 2, duration: 70, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: 0, duration: 90, easing: Easing.linear, useNativeDriver: false }),
        Animated.delay(350),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [isHint, shake]);

  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && !disabled ? styles.tilePressed : null]}>
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Image source={item.img} style={styles.asset} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}

export default function Index() {
  const insets = useSafeAreaInsets();

  const bagRef = useRef<Balloon[]>(shuffle(BALLOONS));
  const bagIndexRef = useRef(0);

  const [target, setTarget] = useState<Balloon>(() => bagRef.current[0]);
  const [grid, setGrid] = useState<Balloon[]>([]);
  const [hintId, setHintId] = useState<string | null>(null);
  const [lock, setLock] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

  const [soundCorrect, setSoundCorrect] = useState<Audio.Sound | null>(null);
  const [soundWrong, setSoundWrong] = useState<Audio.Sound | null>(null);

  const totalCount = BALLOONS.length;

  const buildGrid = (t: Balloon) => {
    const others = BALLOONS.filter((x) => x.id !== t.id);
    const pick = shuffle(others).slice(0, Math.max(0, GRID_SIZE - 1));
    setGrid(shuffle([t, ...pick]));
  };

  useEffect(() => buildGrid(target), [target]);

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
    setHintId(null);
    const t = setTimeout(() => setHintId(target.id), 2500);
    return () => clearTimeout(t);
  }, [target.id]);

  const play = async (s: Audio.Sound | null) => {
    if (!s) return;
    try {
      await s.replayAsync();
    } catch {}
  };

  const nextTarget = () => {
    let idx = bagIndexRef.current + 1;
    if (idx >= bagRef.current.length) {
      bagRef.current = shuffle(BALLOONS);
      idx = 0;
    }
    bagIndexRef.current = idx;
    setTarget(bagRef.current[idx]);
  };

  const onPick = async (item: Balloon) => {
    if (lock) return;

    if (item.id === target.id) {
      setLock(true);
      setHintId(null);

      await play(soundCorrect);
      const newCount = await addCollected(item.id);
      setCollectedCount(newCount);

      setTimeout(() => {
        setLock(false);
        nextTarget();
      }, 450);
    } else {
      await play(soundWrong);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.targetBig}>
            <Image source={target.img} style={styles.targetBigImg} resizeMode="contain" />
          </View>
          <Text style={styles.progress}>🎈 {collectedCount}/{totalCount}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {grid.map((it) => (
          <Tile key={it.id} item={it} isHint={hintId === it.id} disabled={lock} onPress={() => onPick(it)} />
        ))}
      </View>
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
  asset: { width: 130, height: 130 },
});
