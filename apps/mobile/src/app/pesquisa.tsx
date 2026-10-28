import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CATEGORIES,
  colors,
  getCategory,
  parseSearchQuery,
  pt,
  type CategorySlug,
  type PublicProfessional,
  type Zone,
} from '@biska/shared';
import { ProCard } from '@/components/pro-card';
import { supabase } from '@/lib/supabase';

export default function Search() {
  const params = useLocalSearchParams<{ q?: string; categoria?: string; zona?: string }>();
  const [input, setInput] = useState(params.q ?? '');
  const [zones, setZones] = useState<Zone[]>([]);
  const [category, setCategory] = useState<CategorySlug | undefined>(getCategory(params.categoria ?? '')?.slug);
  const [zoneName, setZoneName] = useState<string | undefined>(params.zona);
  const [pros, setPros] = useState<PublicProfessional[] | null>(null);

  useEffect(() => {
    supabase
      ?.from('zones')
      .select('*')
      .order('name')
      .overrideTypes<Zone[], { merge: false }>()
      .then(({ data }) => {
        const list = data ?? [];
        setZones(list);
        // A frase vinda da página inicial pode trazer categoria e zona.
        if (params.q) {
          const parsed = parseSearchQuery(params.q, list.map((z) => z.name));
          if (!params.categoria && parsed.category) setCategory(parsed.category);
          if (!params.zona && parsed.zone) setZoneName(parsed.zone);
        }
      });
  }, [params.q, params.categoria, params.zona]);

  const zone = zones.find((z) => z.name === zoneName);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let query = supabase.from('public_professionals').select('*');
    if (category) query = query.eq('category_slug', category);
    if (zone) query = query.contains('zone_ids', [zone.id]);
    query
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .order('rating_count', { ascending: false })
      .order('verified_at', { ascending: false })
      .limit(60)
      .overrideTypes<PublicProfessional[], { merge: false }>()
      .then(({ data }) => active && setPros(data ?? []));
    return () => {
      active = false;
    };
  }, [category, zone]);

  function applyText() {
    const parsed = parseSearchQuery(input, zones.map((z) => z.name));
    if (parsed.category) setCategory(parsed.category);
    if (parsed.zone) setZoneName(parsed.zone);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={{ gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹ {pt.auth.back}</Text>
          </Pressable>
          <Text style={styles.title}>{pt.search.title}</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={applyText}
            returnKeyType="search"
            placeholder={pt.search.placeholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={pt.search.title}
            style={styles.search}
          />
        </SafeAreaView>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={pt.search.allCategories} selected={!category} onPress={() => setCategory(undefined)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
        <Chip label={pt.search.allZones} selected={!zoneName} onPress={() => setZoneName(undefined)} />
        {zones.map((z) => (
          <Chip key={z.id} label={z.name} selected={zoneName === z.name} onPress={() => setZoneName(z.name)} />
        ))}
      </ScrollView>

      {pros === null ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={pros}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          ListHeaderComponent={<Text style={styles.count}>{pt.search.results(pros.length)}</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontWeight: '700', color: colors.text, textAlign: 'center' }}>{pt.search.empty}</Text>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>{pt.search.emptyHint}</Text>
            </View>
          }
          renderItem={({ item }) => <ProCard pro={item} />}
        />
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: colors.onNavyMuted, fontSize: 15 },
  title: { color: '#fff', fontSize: 25, fontWeight: '700' },
  search: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 16, color: colors.text },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.text, fontWeight: '600' },
  count: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  empty: { gap: 4, padding: 24, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
});
