import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { Newsreader_500Medium, Newsreader_600SemiBold } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSession } from "../src/session";
import { theme } from "../src/theme";
import { useTrail } from "../src/trail";
import "../src/tracking/tasks";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const ready = useSession((state) => state.ready);
  const token = useSession((state) => state.token);
  const hydrate = useSession((state) => state.hydrate);
  const refresh = useTrail((state) => state.refresh);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void hydrate().then(() => refresh());
  }, [hydrate, refresh]);

  useEffect(() => {
    if (!ready) return;
    const inTabs = segments[0] === "(tabs)";
    if (!token && inTabs) router.replace("/login");
    if (token && (segments[0] === "login" || segments[0] === "register")) {
      router.replace("/map");
    }
  }, [ready, token, segments, router]);

  if ((!fontsLoaded && !fontError) || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.ink, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.phosphor} />
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.phone}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.ink },
            animation: "fade",
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, width: "100%", backgroundColor: "#070a07", alignItems: "center" },
  phone: { flex: 1, width: "100%", maxWidth: 440, backgroundColor: theme.ink },
});
