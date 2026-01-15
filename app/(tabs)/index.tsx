import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  StyleSheet,
  Pressable,
  Image,
  Text,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BALLOONS, type Balloon } from "../../constants/balloons";

import { BlurView } from "expo-blur";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";
const THEME_KEY = "THEME_V1";
const GRID_SIZE = 6;

const THEMES = [
  { bg: "#F6FBFF", header: "#FFFFFF", tile: "#ECF6FF", border: "#E3F1FF" },
  { bg: "#FFF7F0", header: "#FFFFFF", tile: "#FFF0D9", border: "#FFE1B8" },
  { bg: "#F3FFF6", header: "#FFFFFF", tile: "#E6FFEF", border: "#CFF6DC" },
  { bg: "#FFF3FB", header: "#FFFFFF", tile: "#FFE6F4", border: "#FFD0EA" },
] as const;

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

async function clearCollected() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function loadThemeIndex() {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

async function saveThemeIndex(n: number) {
  await AsyncStorage.setItem(THEME_KEY, String(n));
}

function Tile({
  item,
  isHint,
  disabled,
  onPress,
  tileBg,
  borderColor,
}: {
  item: Balloon;
  isHint: boolean;
  disabled: boolean;
  onPress: () => void;
  tileBg: string;
  borderColor: string;
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
        Animated.timing(shake, {
          toValue: -3,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(shake, {
          toValue: 3,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(shake, {
          toValue: -2,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(shake, {
          toValue: 2,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(350),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [isHint, shake]);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tileBg, borderColor },
        pressed && !disabled ? styles.tilePressed : null,
      ]}
    >
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
  const reveal = useRef(new Animated.Value(0)).current;

  const [target, setTarget] = useState<Balloon>(() => bagRef.current[0]);
  const [grid, setGrid] = useState<Balloon[]>([]);
  const [hintId, setHintId] = useState<string | null>(null);
  const [lock, setLock] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

  const [themeIndex, setThemeIndex] = useState(0);
  const theme = THEMES[themeIndex % THEMES.length];

  const [won, setWon] = useState(false);

  const [soundCorrect, setSoundCorrect] = useState<Audio.Sound | null>(null);
  const [soundWrong, setSoundWrong] = useState<Audio.Sound | null>(null);

  const totalCount = BALLOONS.length;

  const buildGrid = (t: Balloon) => {
    const others = BALLOONS.filter((x) => x.id !== t.id);
    const pick = shuffle(others).slice(0, Math.max(0, GRID_SIZE - 1));
    setGrid(shuffle([t, ...pick])); // bez powtórek
  };

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target.id]);

  useEffect(() => buildGrid(target), [target]);

  useEffect(() => {
    getCollected().then((c) => setCollectedCount(c.length));
    loadThemeIndex().then((n) => setThemeIndex(n % THEMES.length));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await Audio.Sound.createAsync(
        require("../../assets/sounds/correct.mp3"),
        { volume: 1 }
      );
      const no = await Audio.Sound.createAsync(
        require("../../assets/sounds/wrong.mp3"),
        { volume: 1 }
      );
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

  // opóźniona podpowiedź (drganie prawidłowego)
  useEffect(() => {
    setHintId(null);
    const start = setTimeout(() => setHintId(target.id), 5000); // <- tu zmieniasz czas
    const stop = setTimeout(() => setHintId(null), 6000); // <- tu długość drgania (1s)
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
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

  const restartWithNewTheme = async () => {
    // nowy motyw
    const next = (themeIndex + 1) % THEMES.length;
    setThemeIndex(next);
    await saveThemeIndex(next);

    // reset kolekcji
    await clearCollected();
    setCollectedCount(0);

    // reset “talii” i start
    bagRef.current = shuffle(BALLOONS);
    bagIndexRef.current = 0;
    setTarget(bagRef.current[0]);
  };

  const onPick = async (item: Balloon) => {
    if (lock || won) return;

    if (item.id === target.id) {
      setLock(true);
      setHintId(null);

      await play(soundCorrect);

      const newCount = await addCollected(item.id);
      setCollectedCount(newCount);

      // HAPPY GAME OVER
      if (newCount >= totalCount) {
        setWon(true);
        setTimeout(async () => {
          await restartWithNewTheme();
          setWon(false);
          setLock(false);
        }, 1600);
        return;
      }

      setTimeout(() => {
        setLock(false);
        nextTarget();
      }, 450);
    } else {
      await play(soundWrong);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { paddingTop: insets.top + 8, backgroundColor: theme.bg },
      ]}
    >
      <View
        style={[
          styles.headerCard,
          { backgroundColor: theme.header, borderColor: theme.border },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.targetBig}>
            {/* obrazek pojawia się */}
            <Animated.Image
              source={target.img}
              resizeMode="contain"
              style={[styles.targetBigImg, { opacity: reveal }]}
            />

            {/* blur znika */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  opacity: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
            >
              <BlurView
                intensity={22}
                tint="light"
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>

          <Text style={styles.progress}>
            🎈 {collectedCount}/{totalCount}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {grid.map((it) => (
          <Tile
            key={it.id}
            item={it}
            isHint={hintId === it.id}
            disabled={lock || won}
            onPress={() => onPick(it)}
            tileBg={theme.tile}
            borderColor={theme.border}
          />
        ))}
      </View>

      {won && (
        <View style={styles.overlay}>
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>🎉🎈😊</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 12 },

  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  targetBig: {
    width: 92,
    height: 92,
    borderRadius: 22,
    borderWidth: 3,
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
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tilePressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },

  asset: { width: 130, height: 130 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  winCard: {
    width: 240,
    height: 180,
    borderRadius: 28,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  winEmoji: { fontSize: 44 },
});
