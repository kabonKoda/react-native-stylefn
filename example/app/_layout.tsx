import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleProvider } from 'react-native-stylefn';

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <StyleProvider config={{ darkMode: 'manual' }} insets={insets}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="auto" />
    </StyleProvider>
  );
}
