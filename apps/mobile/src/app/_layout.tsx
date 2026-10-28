import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@biska/shared';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </>
  );
}
