import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleProvider } from 'react-native-stylefn';

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  // config is auto-loaded from rn-stylefn.config.js
  // cssVars are auto-loaded from global.css via withStyleFn() in metro.config.js
  return (
    <StyleProvider insets={insets}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="auto" />
    </StyleProvider>
  );
}
