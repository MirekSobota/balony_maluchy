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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { BALLOONS, type Balloon } from "../../constants/balloons";

const STORAGE_KEY = "COLLECTED_BALLOONS_V1";
const THEME_KEY = "THEME_V1";

const TUTORIAL_DONE_KEY = "TUTORIAL_DONE_V1";
const TUTORIAL_STEP_KEY = "TUTORIAL_STEP_V1";

const GRID_SIZE = 6;

const THEMES = [
  { bg: "#F6FBFF", header: "#FFFFFF", tile: "#ECF6FF", border: "#E3F1FF" },
  { bg: "#FFF7F0", header: "#FFFFFF", tile: "#FFF0D9", border: "#FFE1B8" },
  { bg: "#F3FFF6", header: "#FFFFFF", tile: "#E6FFEF", border: "#CFF6DC" },
  { bg: "#FFF3FB", header: "#FFFFFF", tile: "#FFE6F4", border: "#FFD0EA" },
] as const;

type TutorialStep = 0 | 1 | 2 | 3;

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

async function loadTutorial() {
  const done = (await AsyncStorage.getItem(TUTORIAL_DONE_KEY)) === "1";
  const stepRaw = await AsyncStorage.getItem(TUTORIAL_STEP_KEY);
  const step = stepRaw !== null ? Number(stepRaw) : null;
  return { done, step: step as TutorialStep | null };
}

async function setTutorialStep(step: TutorialStep) {
  await AsyncStorage.setItem(TUTORIAL_STEP_KEY, String(step));
}

async function finishTutorial() {
  await AsyncStorage.setItem(TUTORIAL_DONE_KEY, "1");
  await AsyncStorage.removeItem(TUTORIAL_STEP_KEY);
}

function HandPointer({
  x,
  y,
  emoji = "👆",
}: {
  x: number;
  y: number;
  emoji?: string;
}) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);

  const dy = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.hand,
        { left: x, top: y, transform: [{ translateY: dy }] },
      ]}
    >
      <Text style={styles.handText}>{emoji}</Text>
    </Animated.View>
  );
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
  const { width: W, height: H } = useWindowDimensions();

  // talia celów (bez powtórek celów)
  const bagRef = useRef<Balloon[]>(shuffle(BALLOONS));
  const bagIndexRef = useRef(0);

  const [target, setTarget] = useState<Balloon>(() => bagRef.current[0]);
  const [grid, setGrid] = useState<Balloon[]>([]);
  const [hintId, setHintId] = useState<string | null>(null);
  const [lock, setLock] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

  const [themeIndex, setThemeIndex] = useState(0);
  const theme = THEMES[themeIndex % THEMES.length];

  const [won, setWon] = useState(false);

  // tutorial
  const [tutorialDone, setTutorialDoneState] = useState(true);
  const [tutorialStep, setTutorialStepState] = useState<TutorialStep | null>(null);

  const [headerLayout, setHeaderLayout] = useState<{ y: number; h: number } | null>(null);

  const [soundCorrect, setSoundCorrect] = useState<Audio.Sound | null>(null);
  const [soundWrong, setSoundWrong] = useState<Audio.Sound | null>(null);

  const totalCount = BALLOONS.length;

  const buildGrid = (t: Balloon) => {
    const others = BALLOONS.filter((x) => x.id !== t.id);
    const pick = shuffle(others).slice(0, Math.max(0, GRID_SIZE - 1));
    setGrid(shuffle([t, ...pick])); // brak powtórek na planszy
  };

  useEffect(() => buildGrid(target), [target]);

  useEffect(() => {
    getCollected().then((c) => setCollectedCount(c.length));
    loadThemeIndex().then((n) => setThemeIndex(n % THEMES.length));
  }, []);

  // tutorial state (zawsze aktualny po powrocie na ekran gry)
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const t = await loadTutorial();
        setTutorialDoneState(t.done);
        setTutorialStepState(t.done ? null : (t.step ?? 0));

        if (!t.done && (t.step === null)) {
          await setTutorialStep(0);
        }

        // jeśli jesteśmy po kolekcji (krok 3) i wróciliśmy na grę → koniec tutorialu
        if (!t.done && t.step === 3) {
          await finishTutorial();
          setTutorialDoneState(true);
          setTutorialStepState(null);
        }
      })();
    }, [])
  );

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

  // hint drganie (normalnie), ale jeśli tutorial jest w kroku 1 – pokazujemy hint od razu
  useEffect(() => {
    setHintId(null);

    if (!tutorialDone && tutorialStep === 1) {
      setHintId(target.id);
      return;
    }

    const start = setTimeout(() => setHintId(target.id), 5000);
    const stop = setTimeout(() => setHintId(null), 6000);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [target.id, tutorialDone, tutorialStep]);

  // tutorial krok 0: pokaż header chwilę i przejdź do kroku 1
  useEffect(() => {
    if (tutorialDone) return;
    if (tutorialStep !== 0) return;

    const t = setTimeout(async () => {
      setTutorialStepState(1);
      await setTutorialStep(1);
    }, 900);

    return () => clearTimeout(t);
  }, [tutorialDone, tutorialStep]);

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
    const next = (themeIndex + 1) % THEMES.length;
    setThemeIndex(next);
    await saveThemeIndex(next);

    await clearCollected();
    setCollectedCount(0);

    bagRef.current = shuffle(BALLOONS);
    bagIndexRef.current = 0;
    setTarget(bagRef.current[0]);
  };

  const onPick = async (item: Balloon) => {
    if (lock || won) return;

    // tutorial krok 2: blokujemy planszę, tylko tab bar ma działać
    if (!tutorialDone && tutorialStep === 2) return;

    if (item.id === target.id) {
      setLock(true);
      setHintId(null);

      await play(soundCorrect);

      const newCount = await addCollected(item.id);
      setCollectedCount(newCount);

      // po pierwszym poprawnym trafieniu w tutorialu → pokaż kolekcję (krok 2)
      if (!tutorialDone && tutorialStep === 1) {
        setLock(false);
        setTutorialStepState(2);
        await setTutorialStep(2);
        return;
      }

      // happy game over
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

  // --- wyliczanie pozycji rączki (bez mierzenia, stabilnie) ---
  const P = 12;
  const GAP = 12;
  const tileW = (W - P * 2 - GAP) / 2;
  const tileH = 170;

  const gridTopY = headerLayout ? headerLayout.y + headerLayout.h + 10 : insets.top + 120;
  const targetIndex = grid.findIndex((x) => x.id === target.id);
  const row = targetIndex >= 0 ? Math.floor(targetIndex / 2) : 0;
  const col = targetIndex >= 0 ? targetIndex % 2 : 0;

  // ręka na header
  const handHeaderX = P + 55;
  const handHeaderY = (headerLayout ? headerLayout.y : insets.top + 10) + 35;

  // ręka na poprawny klocek
  const handTileX = P + col * (tileW + GAP) + tileW * 0.20;
  const handTileY = gridTopY + row * (tileH + GAP) + tileH * 0.22;

  // ręka na tab bar (kolekcja – prawa ikonka)
  const tabY = H - (insets.bottom + 48);
  const handCollectionX = W * 0.72;
  const handCollectionY = tabY - 55;

  const showHandHeader = !tutorialDone && tutorialStep === 0;
  const showHandTile = !tutorialDone && tutorialStep === 1;
  const showHandCollection = !tutorialDone && tutorialStep === 2;

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top + 8, backgroundColor: theme.bg }]}>
      <View
        style={[styles.headerCard, { backgroundColor: theme.header, borderColor: theme.border }]}
        onLayout={(e) => setHeaderLayout({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
      >
        <View style={styles.headerRow}>
          <View style={[styles.targetBig, { borderColor: theme.border, backgroundColor: theme.tile }]}>
            <Image source={target.img} style={styles.targetBigImg} resizeMode="contain" />
          </View>
          <Text style={styles.progress}>🎈 {collectedCount}/{totalCount}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {grid.map((it) => (
          <Tile
            key={it.id}
            item={it}
            isHint={hintId === it.id}
            disabled={lock || won || (!tutorialDone && tutorialStep === 2)}
            onPress={() => onPick(it)}
            tileBg={theme.tile}
            borderColor={theme.border}
          />
        ))}
      </View>

      {/* Happy game over */}
      {won && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>🎉🎈😊</Text>
          </View>
        </View>
      )}

      {/* Tutorial hand overlays */}
      {showHandHeader && <HandPointer x={handHeaderX} y={handHeaderY} emoji="👆" />}
      {showHandTile && <HandPointer x={handTileX} y={handTileY} emoji="👉" />}
      {showHandCollection && <HandPointer x={handCollectionX} y={handCollectionY} emoji="👇" />}
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

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

  hand: {
    position: "absolute",
    zIndex: 999,
  },
  handText: { fontSize: 44 },
});
