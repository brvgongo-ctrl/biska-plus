import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { colors, initials } from '@biska/shared';

/** Fotografia do profissional ou, sem ela, as iniciais. */
export function Avatar({ name, url, size = 56 }: { name: string | null; url: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={box} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <View style={[box, { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.amber, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}
