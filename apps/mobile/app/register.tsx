import { useRouter } from "expo-router";
import { register } from "../src/api";
import { AuthScreen } from "../src/components/AuthScreen";
import { useSession } from "../src/session";
import { useTrail } from "../src/trail";

export default function RegisterScreen() {
  const router = useRouter();
  const signIn = useSession((state) => state.signIn);
  const refresh = useTrail((state) => state.refresh);

  return (
    <AuthScreen
      title={"Open a\nledger"}
      lead="One account keeps the trail. A second device can pick up the same lit streets."
      action="Create account"
      showName
      footer="Already walking? Sign in"
      onFooter={() => router.push("/login")}
      onSubmit={async ({ email, password, displayName }) => {
        const session = await register(email, password, displayName);
        await signIn({
          token: session.token,
          userId: session.user.id,
          email: session.user.email,
          displayName: session.user.displayName,
        });
        await refresh();
        router.replace("/map");
      }}
    />
  );
}
