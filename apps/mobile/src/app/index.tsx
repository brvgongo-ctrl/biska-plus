import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORIES, colors, pt } from '@biska/shared';
import { CategoryIcon } from '@/components/category-icon';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-session';

export default function Home() {
  const session = useSession();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setFirstName(data?.full_name?.split(' ')[0] ?? null));
  }, [session]);

  if (session === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }
  if (!session) return <Redirect href="/entrar" />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={{ gap: 14 }}>
          <View style={styles.row}>
            <Text style={styles.logo}>
              Biska<Text style={{ color: colors.amber }}>+</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => supabase?.auth.signOut()}
              style={styles.signOut}
            >
              <Text style={styles.signOutText}>{pt.auth.signOut}</Text>
            </Pressable>
          </View>
          <Text style={styles.hello}>
            {pt.home.hello}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={styles.title}>{pt.home.whoDoYouNeed}</Text>
          <View style={styles.search}>
            <Text style={styles.searchText}>{pt.home.searchPlaceholder}</Text>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>{pt.home.categories}</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => (
            <View key={c.slug} style={styles.tile}>
              <CategoryIcon slug={c.slug} color={colors.navy} />
              <Text style={styles.tileText}>{c.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.proCard]}>
        <Text style={[styles.h2, { color: '#fff' }]}>{pt.home.becomePro}</Text>
        <Text style={{ color: colors.onNavyMuted, lineHeight: 21 }}>{pt.home.becomeProText}</Text>
        <Link href="/profissional" style={styles.proCta}>
          {pt.home.becomeProCta}
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  logo: { color: '#fff', fontSize: 24, fontWeight: '800' },
  signOut: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navy2,
  },
  signOutText: { color: '#fff', fontWeight: '600' },
  hello: { color: colors.onNavyMuted, fontSize: 15 },
  title: { color: '#fff', fontSize: 25, fontWeight: '700' },
  search: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 56, justifyContent: 'center' },
  searchText: { color: colors.muted, fontSize: 15 },
  section: { marginHorizontal: 20, marginTop: 24, gap: 14 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  tileText: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  proCard: { backgroundColor: colors.navy, borderRadius: 20, padding: 18, gap: 10 },
  proCta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amber,
    color: colors.navy,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
