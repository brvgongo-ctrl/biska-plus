import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, formatKz, formatRating, getCategory, pt, type PublicProfessional } from '@biska/shared';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/pro-card';
import { supabase } from '@/lib/supabase';

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined: a carregar; null: não existe ou já não está aprovado.
  const [pro, setPro] = useState<PublicProfessional | null | undefined>(undefined);

  useEffect(() => {
    supabase
      ?.from('public_professionals')
      .select('*')
      .eq('id', id)
      .maybeSingle<PublicProfessional>()
      .then(({ data }) => setPro(data ?? null));
  }, [id]);

  if (pro === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  const category = pro ? getCategory(pro.category_slug) : undefined;
  const rating = pro ? formatRating(pro.rating_avg, pro.rating_count) : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={{ gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹ {pt.profile.back}</Text>
          </Pressable>
          {pro ? (
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Avatar name={pro.display_name} url={pro.avatar_url} size={80} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title}>{pro.display_name}</Text>
                <Text style={styles.onNavy}>
                  {category?.name}
                  {pro.years_experience ? ` · ${pt.search.yearsExperience(pro.years_experience)}` : ''}
                </Text>
                <Text style={styles.onNavy}>
                  {rating ? `★ ${rating} · ${pt.search.reviews(pro.rating_count)}` : pt.search.new}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.title}>{pt.search.empty}</Text>
          )}
        </SafeAreaView>
      </View>

      {pro && (
        <View style={styles.body}>
          <VerifiedBadge />

          <View style={styles.card}>
            <Text style={styles.label}>{pt.profile.price}</Text>
            <Text style={styles.price}>
              {pro.daily_rate_kz ? `${pt.search.from} ${formatKz(pro.daily_rate_kz)}${pt.search.perDay}` : '—'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{pt.profile.zones}</Text>
            <View style={styles.zones}>
              {pro.zone_names.map((z) => (
                <Text key={z} style={styles.zone}>
                  {z}
                </Text>
              ))}
            </View>
          </View>

          {pro.bio && (
            <View style={styles.card}>
              <Text style={styles.h2}>{pt.profile.about}</Text>
              <Text style={{ color: colors.muted, lineHeight: 21 }}>{pro.bio}</Text>
            </View>
          )}

          <View style={[styles.button, { opacity: 0.6 }]} accessibilityState={{ disabled: true }}>
            <Text style={styles.buttonText}>{pt.profile.request}</Text>
          </View>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>{pt.profile.requestSoon}</Text>

          <Link
            href={{ pathname: '/pesquisa', params: { categoria: pro.category_slug } }}
            style={{ color: colors.navy, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' }}
          >
            {pt.profile.more}: {category?.name}
          </Link>
        </View>
      )}
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
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: colors.onNavyMuted, fontSize: 15 },
  title: { color: '#fff', fontSize: 23, fontWeight: '700' },
  onNavy: { color: colors.onNavyMuted, fontSize: 14 },
  body: { marginHorizontal: 20, marginTop: 20, gap: 14 },
  card: { gap: 6, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  label: { color: colors.muted, fontSize: 13 },
  price: { color: colors.text, fontSize: 18, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700' },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zone: {
    backgroundColor: colors.ground,
    color: colors.text,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.amber },
  buttonText: { color: colors.navy, fontWeight: '700', fontSize: 15 },
});
