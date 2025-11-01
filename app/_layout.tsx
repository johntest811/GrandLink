import { Stack } from "expo-router";
import { AppProvider } from "../context/AppContext";
import BottomNavBar from "./../components/BottomNav";
export default function RootLayout() {
  return (
    <AppProvider>
      
        <Stack screenOptions={{ headerShown: false }} />
        <BottomNavBar />
      
    </AppProvider>
  );
}
