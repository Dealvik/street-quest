import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "../theme";

type Props = {
  following: boolean;
  onPress: () => void;
};

export function LocateButton({ following, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel="Center on me"
      onPress={onPress}
      style={[styles.button, following ? styles.following : null]}
    >
      <View style={styles.ring} />
      <View style={styles.dot} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 14,
    bottom: 14,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.ink,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  following: { borderColor: theme.phosphor },
  ring: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.phosphor,
  },
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.phosphor,
  },
});