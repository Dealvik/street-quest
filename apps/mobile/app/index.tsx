import { Redirect } from "expo-router";
import { useSession } from "../src/session";

export default function Index() {
  const token = useSession((state) => state.token);
  return <Redirect href={token ? "/map" : "/login"} />;
}
