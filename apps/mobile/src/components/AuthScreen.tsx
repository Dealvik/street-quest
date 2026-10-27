import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fonts, theme } from "../theme";

type Props = {
  title: string;
  lead: string;
  action: string;
  showName?: boolean;
  footer: string;
  onFooter: () => void;
  onSubmit: (values: { email: string; password: string; displayName: string }) => Promise<void>;
};

export function AuthScreen({ title, lead, action, showName, footer, onFooter, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSubmit({ email: email.trim(), password, displayName: displayName.trim() });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.copy}>
        <Text style={styles.kicker}>FIELD NOTES</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lead}>{lead}</Text>
      </View>
      <View style={styles.form}>
        {showName ? (
          <Field label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={theme.ink} />
          ) : (
            <Text style={styles.buttonText}>{action}</Text>
          )}
        </Pressable>
        <Pressable onPress={onFooter}>
          <Text style={styles.footer}>{footer}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words";
  keyboardType?: "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "none"}
        keyboardType={props.keyboardType}
        autoCorrect={false}
        placeholderTextColor={theme.moss}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.ink,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  copy: { gap: 14 },
  kicker: {
    color: theme.phosphor,
    fontFamily: fonts.monoMedium,
    letterSpacing: 3,
    fontSize: 12,
  },
  title: {
    color: theme.paper,
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 62,
  },
  lead: {
    color: theme.paperDim,
    fontFamily: fonts.body,
    fontSize: 20,
    lineHeight: 28,
    maxWidth: 420,
  },
  form: { gap: 16 },
  field: { gap: 6 },
  label: {
    color: theme.moss,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
  input: {
    color: theme.paper,
    fontFamily: fonts.body,
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingVertical: 8,
  },
  button: {
    marginTop: 8,
    backgroundColor: theme.phosphor,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: theme.ink,
    fontFamily: fonts.monoMedium,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  footer: {
    color: theme.paperDim,
    fontFamily: fonts.body,
    fontSize: 16,
    textAlign: "center",
    paddingVertical: 8,
  },
  error: {
    color: theme.danger,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
