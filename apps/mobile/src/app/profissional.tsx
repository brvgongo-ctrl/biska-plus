import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CATEGORIES,
  KYC_DOCUMENT_ORDER,
  canEditKyc,
  colors,
  describeKycError,
  getCategory,
  parseOptionalInt,
  pt,
  requiredDocuments,
  toSaveArgs,
  validateProfessionalInput,
  type KycDocument,
  type KycDocumentType,
  type KycStatus,
  type ProfessionalProfile,
  type Zone,
} from '@biska/shared';
import { pickFile, removeKycDocument, uploadKycDocument, type PickSource } from '@/lib/kyc-upload';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-session';

const OPTIONAL: readonly KycDocumentType[] = ['residence_certificate', 'certificate'];

interface Loaded {
  pro: ProfessionalProfile | null;
  zones: Zone[];
  documents: KycDocument[];
}

async function fetchOnboarding(userId: string) {
  const client = supabase!;
  const [profile, pro, zones, myZones, documents] = await Promise.all([
    client.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    client.from('professional_profiles').select('*').eq('user_id', userId).maybeSingle<ProfessionalProfile>(),
    client.from('zones').select('*').order('name').overrideTypes<Zone[], { merge: false }>(),
    client.from('professional_zones').select('zone_id').eq('user_id', userId),
    client.from('kyc_documents').select('*').eq('user_id', userId).overrideTypes<KycDocument[], { merge: false }>(),
  ]);
  return {
    pro: pro.data,
    zones: zones.data ?? [],
    documents: documents.data ?? [],
    fullName: (profile.data?.full_name as string | null) ?? '',
    myZoneIds: (myZones.data ?? []).map((z) => z.zone_id as number),
  };
}

export default function ProfessionalOnboarding() {
  const session = useSession();
  const userId = session?.user.id;
  const [data, setData] = useState<Loaded | null>(null);

  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState('');
  const [years, setYears] = useState('');
  const [rate, setRate] = useState('');
  const [bio, setBio] = useState('');
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  const [consent, setConsent] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Incrementar para voltar a carregar depois de gravar ou enviar documentos.
  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchOnboarding(userId).then(({ fullName, myZoneIds, ...loaded }) => {
      if (!active) return;
      const p = loaded.pro;
      setData(loaded);
      setFullName(fullName);
      setCategory(p?.category_slug ?? '');
      setYears(p?.years_experience?.toString() ?? '');
      setRate(p?.daily_rate_kz?.toString() ?? '');
      setBio(p?.bio ?? '');
      setZoneIds(myZoneIds);
      setConsent(Boolean(p?.data_consent_at));
    });
    return () => {
      active = false;
    };
  }, [userId, version]);

  if (session === null) return <Redirect href="/entrar" />;
  if (!data || !userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  const status = data.pro?.kyc_status ?? null;
  const editable = canEditKyc(status);
  const formEditable = editable || status === 'approved';
  const required = requiredDocuments(getCategory(data.pro?.category_slug ?? ''));
  const latest = new Map<KycDocumentType, KycDocument>();
  for (const d of [...data.documents].sort((a, b) => a.created_at.localeCompare(b.created_at))) latest.set(d.type, d);
  const missing = required.filter((t) => !data.documents.some((d) => d.type === t && d.status !== 'rejected'));

  async function save() {
    if (!supabase) return;
    const input = {
      fullName,
      categorySlug: category,
      yearsExperience: parseOptionalInt(years),
      dailyRateKz: parseOptionalInt(rate),
      bio,
      zoneIds,
    };
    const invalid = validateProfessionalInput(input);
    if (invalid) return setMessage({ ok: false, text: invalid });
    setBusy('save');
    const { error } = await supabase.rpc('save_professional_profile', toSaveArgs(input));
    setBusy(null);
    if (error) return setMessage({ ok: false, text: error.message || pt.pro.error });
    setMessage({ ok: true, text: pt.pro.saved });
    load();
  }

  async function upload(type: KycDocumentType, source: PickSource) {
    try {
      const file = await pickFile(source, type);
      if (!file) return;
      setBusy(type);
      await uploadKycDocument(userId!, type, file, latest.get(type));
      load();
    } catch (e) {
      Alert.alert(pt.kyc.documents[type].label, e instanceof Error ? e.message : pt.pro.uploadError);
    } finally {
      setBusy(null);
    }
  }

  async function remove(type: KycDocumentType, doc: KycDocument) {
    setBusy(type);
    const ok = await removeKycDocument(doc);
    setBusy(null);
    if (!ok) Alert.alert(pt.pro.error);
    load();
  }

  async function submit() {
    if (!supabase || !data?.pro) return;
    setBusy('submit');
    setMessage(null);
    if (!data.pro.data_consent_at) {
      const { error } = await supabase
        .from('professional_profiles')
        .update({ data_consent_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) {
        setBusy(null);
        return setMessage({ ok: false, text: pt.pro.error });
      }
    }
    const { error } = await supabase.rpc('submit_kyc');
    setBusy(null);
    if (error) return setMessage({ ok: false, text: describeKycError(error.message) });
    load();
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={{ gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹ {pt.auth.back}</Text>
          </Pressable>
          <Text style={styles.title}>{pt.pro.title}</Text>
          <Text style={styles.intro}>{pt.pro.intro}</Text>
        </SafeAreaView>
      </View>

      {status && <StatusBanner status={status} note={data.pro?.kyc_review_note ?? null} />}

      <View style={styles.section}>
        <Text style={styles.h2}>{pt.pro.stepProfile}</Text>

        <Field label={pt.pro.fullName}>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            editable={editable}
            autoComplete="name"
            style={[styles.input, !editable && styles.inputDisabled]}
          />
        </Field>

        <Field label={pt.pro.category}>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.slug}
                label={c.name}
                selected={category === c.slug}
                disabled={!editable}
                onPress={() => setCategory(c.slug)}
              />
            ))}
          </View>
          {!editable && <Text style={styles.hint}>{pt.pro.categoryLocked}</Text>}
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field label={pt.pro.years} style={{ flex: 1 }}>
            <TextInput
              value={years}
              onChangeText={setYears}
              editable={formEditable}
              keyboardType="number-pad"
              style={[styles.input, !formEditable && styles.inputDisabled]}
            />
          </Field>
          <Field label={pt.pro.dailyRate} style={{ flex: 1 }}>
            <TextInput
              value={rate}
              onChangeText={setRate}
              editable={formEditable}
              keyboardType="number-pad"
              style={[styles.input, !formEditable && styles.inputDisabled]}
            />
          </Field>
        </View>

        <Field label={pt.pro.bio}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            editable={formEditable}
            multiline
            maxLength={1200}
            placeholder={pt.pro.bioPlaceholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textarea, !formEditable && styles.inputDisabled]}
          />
        </Field>

        <Field label={pt.pro.zones}>
          <View style={styles.chips}>
            {data.zones.map((z) => (
              <Chip
                key={z.id}
                label={z.name}
                selected={zoneIds.includes(z.id)}
                disabled={!formEditable}
                onPress={() =>
                  setZoneIds((prev) => (prev.includes(z.id) ? prev.filter((id) => id !== z.id) : [...prev, z.id]))
                }
              />
            ))}
          </View>
        </Field>

        {formEditable && (
          <Button label={pt.pro.save} onPress={save} busy={busy === 'save'} variant="navy" />
        )}
        {message && (
          <Text accessibilityRole="alert" style={message.ok ? styles.ok : styles.error}>
            {message.text}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>{pt.pro.stepDocuments}</Text>
        {!data.pro && <Text style={styles.notice}>{pt.pro.saveFirst}</Text>}
        {data.pro &&
          KYC_DOCUMENT_ORDER.filter((t) => required.includes(t) || OPTIONAL.includes(t)).map((type) => {
            const doc = latest.get(type);
            const canChange = editable && doc?.status !== 'accepted';
            return (
              <View key={type} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={styles.cardTitle}>
                    {pt.kyc.documents[type].label}
                    <Text style={styles.hint}> · {required.includes(type) ? pt.pro.required : pt.pro.optional}</Text>
                  </Text>
                  {doc && <Text style={[styles.pill, pillStyle[doc.status]]}>{pt.kyc.documentStatus[doc.status]}</Text>}
                </View>
                <Text style={styles.hint}>{pt.kyc.documents[type].hint}</Text>
                {doc?.status === 'rejected' && doc.reviewer_note && <Text style={styles.error}>{doc.reviewer_note}</Text>}
                {canChange &&
                  (busy === type ? (
                    <ActivityIndicator color={colors.navy} />
                  ) : (
                    <View style={styles.chips}>
                      <SmallButton label="Câmara" onPress={() => upload(type, 'camera')} />
                      <SmallButton label="Galeria" onPress={() => upload(type, 'library')} />
                      {type !== 'selfie' && <SmallButton label="PDF" onPress={() => upload(type, 'pdf')} />}
                      {doc && <SmallButton label={pt.pro.remove} onPress={() => remove(type, doc)} />}
                    </View>
                  ))}
              </View>
            );
          })}
      </View>

      {data.pro && editable && (
        <View style={styles.section}>
          <Text style={styles.h2}>{pt.pro.stepSubmit}</Text>
          {missing.length > 0 && (
            <Text style={styles.notice}>
              {pt.pro.missing}: {missing.map((t) => pt.kyc.documents[t].label).join(', ')}.
            </Text>
          )}
          <View style={styles.consent}>
            <Switch
              value={consent}
              onValueChange={setConsent}
              disabled={Boolean(data.pro.data_consent_at)}
              accessibilityLabel={pt.pro.consent}
            />
            <Text style={{ flex: 1, color: colors.text, lineHeight: 20 }}>{pt.pro.consent}</Text>
          </View>
          <Button
            label={pt.pro.submit}
            onPress={submit}
            busy={busy === 'submit'}
            disabled={!consent || missing.length > 0}
            variant="amber"
          />
        </View>
      )}
    </ScrollView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, disabled && !selected && { opacity: 0.5 }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  busy,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant: 'navy' | 'amber';
}) {
  const bg = variant === 'navy' ? colors.navy : colors.amber;
  const fg = variant === 'navy' ? '#fff' : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor: bg }, (busy || disabled) && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.smallButton}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const bannerColors: Record<KycStatus, { bg: string; fg: string }> = {
  draft: { bg: '#fff', fg: colors.text },
  submitted: { bg: colors.amberSoft, fg: colors.amberText },
  in_review: { bg: colors.amberSoft, fg: colors.amberText },
  needs_fix: { bg: colors.amberSoft, fg: colors.amberText },
  approved: { bg: colors.greenSoft, fg: colors.greenText },
  rejected: { bg: '#FDECEA', fg: colors.danger },
};

function StatusBanner({ status, note }: { status: KycStatus; note: string | null }) {
  const c = bannerColors[status];
  return (
    <View accessibilityRole="summary" style={[styles.banner, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
        {pt.kyc.status[status]}
      </Text>
      <Text style={{ color: c.fg, lineHeight: 20 }}>{pt.pro.banner[status]}</Text>
      {note && <Text style={{ color: c.fg, fontWeight: '700', lineHeight: 20 }}>{note}</Text>}
    </View>
  );
}

const pillStyle = StyleSheet.create({
  pending: { backgroundColor: colors.amberSoft, color: colors.amberText },
  accepted: { backgroundColor: colors.greenSoft, color: colors.greenText },
  rejected: { backgroundColor: '#FDECEA', color: colors.danger },
});

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
  title: { color: '#fff', fontSize: 25, fontWeight: '700' },
  intro: { color: colors.onNavyMuted, fontSize: 15, lineHeight: 22 },
  banner: { marginHorizontal: 20, marginTop: 20, padding: 16, borderRadius: 16, gap: 4 },
  section: { marginHorizontal: 20, marginTop: 24, gap: 14 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  label: { fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, fontWeight: '400' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputDisabled: { backgroundColor: colors.ground, color: colors.muted },
  textarea: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  card: { gap: 8, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  cardTitle: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 15 },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  smallButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallButtonText: { color: colors.navy, fontWeight: '700' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  notice: { backgroundColor: colors.amberSoft, color: colors.amberText, padding: 14, borderRadius: 12, lineHeight: 20 },
  ok: { color: colors.greenText, fontWeight: '600' },
  error: { backgroundColor: '#FDECEA', color: colors.danger, padding: 12, borderRadius: 12 },
});
