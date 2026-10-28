import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, formatKz, formatRating, getCategory, pt, type PublicProfessional } from '@biska/shared';
import { Avatar } from './avatar';

export function VerifiedBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>✓ {pt.profile.verified}</Text>
    </View>
  );
}

/** Cartão de um profissional na lista de resultados. */
export function ProCard({ pro }: { pro: PublicProfessional }) {
  const rating = formatRating(pro.rating_avg, pro.rating_count);
  return (
    <Link href={{ pathname: '/profissionais/[id]', params: { id: pro.id } }} asChild>
      <Pressable accessibilityRole="link" style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={pro.display_name} url={pro.avatar_url} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{pro.display_name}</Text>
            <Text style={styles.muted}>{getCategory(pro.category_slug)?.name}</Text>
          </View>
        </View>
        <VerifiedBadge />
        <Text style={styles.muted}>
          {rating ? `★ ${rating} · ${pt.search.reviews(pro.rating_count)}` : pt.search.new}
          {pro.years_experience ? ` · ${pt.search.yearsExperience(pro.years_experience)}` : ''}
        </Text>
        {pro.zone_names.length > 0 && <Text style={styles.muted}>{pro.zone_names.join(', ')}</Text>}
        {pro.daily_rate_kz ? (
          <Text style={{ color: colors.text }}>
            {pt.search.from} <Text style={{ fontWeight: '700' }}>{formatKz(pro.daily_rate_kz)}</Text>
            {pt.search.perDay}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.greenText, fontSize: 12, fontWeight: '700' },
});
