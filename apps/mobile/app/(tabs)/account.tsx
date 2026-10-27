import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, theme } from "../../src/theme";
import { syncPending } from "../../src/tracking/pipeline";
import { useSession } from "../../src/session";
import { useTrail } from "../../src/trail";

export default function AccountScreen() {
  const email = useSession((state) => state.email);
  const displayName = useSession((state) => state.displayName);
  const signOut = useSession((state) => state.signOut);
  const pending = useTrail((state) => state.pending);
  const setStatus = useTrail((state) => state.setStatus);
  const router = useRouter();
  const [message, setMessage] = useState("");

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>ACCOUNT</Text>
      <Text style={styles.title}>{displayName || "Walker"}</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.copy}>
        Fixes land on this device first: SQLite on a phone, local storage in the browser. Every
        fifteen minutes, or when you are on Wi-Fi or charging, they upload and the server rebuilds
        your H3 cells in PostGIS. The map asks only for the viewport you are looking at.
      </Text>
      <Text style={styles.copy}>
        While you move, GPS samples about every 12 meters. While you are still, it heartbeats once
        a minute so a park bench still counts, without a constant lock. Jumps faster than a train
        and fixes worse than 20 meters are thrown out.
      </Text>
      <Text style={styles.pending}>{pending} fixes still on this device</Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          void syncPending()
            .then((result) => {
              const next = result.deferred
                ? "Holding the upload for Wi-Fi or power."
                : `Uploaded ${result.uploaded} fixes.`;
              setMessage(next);
              setStatus(next);
            })
            .catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "Sync failed.");
            });
        }}
      >
        <Text style={styles.buttonText}>Sync now</Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
      >
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ink, paddingHorizontal: 24, paddingTop: 28, gap: 12 },
  kicker: { color: theme.phosphor, fontFamily: fonts.monoMedium, letterSpacing: 3, fontSize: 12 },
  title: { color: theme.paper, fontFamily: fonts.display, fontSize: 48, lineHeight: 50 },
  email: { color: theme.moss, fontFamily: fonts.mono, fontSize: 13 },
  copy: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  pending: { color: theme.paper, fontFamily: fonts.mono, fontSize: 13, marginTop: 8 },
  button: {
    backgroundColor: theme.phosphor,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: theme.ink, fontFamily: fonts.monoMedium, fontSize: 14 },
  message: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 16 },
  signOut: { color: theme.danger, fontFamily: fonts.body, fontSize: 16, marginTop: 12 },
});
