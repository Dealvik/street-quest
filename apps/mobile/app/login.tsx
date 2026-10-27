import { useRouter } from "expo-router";
import { login } from "../src/api";
import { AuthScreen } from "../src/components/AuthScreen";
import { useSession } from "../src/session";
import { useTrail } from "../src/trail";

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useSession((state) => state.signIn);
  const refresh = useTrail((state) => state.refresh);

  return (
    <AuthScreen
      title={"Street\nQuest"}
      lead="Light the streets and parks you have actually walked. The rest of the city stays in fog."
      action="Enter"
      footer="Need an account? Join the ledger"
      onFooter={() => router.push("/register")}
      onSubmit={async ({ email, password }) => {
        const session = await login(email, password);
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
