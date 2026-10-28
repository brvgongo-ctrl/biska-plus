import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Provider } from '@supabase/supabase-js';
import { colors, formatAngolanPhone, normalizeAngolanPhone, pt } from '@biska/shared';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-session';

WebBrowser.maybeCompleteAuthSession();

const socialButtons: { provider: Provider; label: string; bg: string; fg: string }[] = [
  { provider: 'google', label: pt.auth.google, bg: '#FFFFFF', fg: colors.navy },
  { provider: 'apple', label: pt.auth.apple, bg: '#000000', fg: '#FFFFFF' },
  { provider: 'facebook', label: pt.auth.facebook, bg: '#1877F2', fg: '#FFFFFF' },
];

type Step = 'choose' | 'phone' | 'code';

export default function SignIn() {
  const session = useSession();
  const [step, setStep] = useState<Step>('choose');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/" />;

  async function signInWith(provider: Provider) {
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const authCode = new URL(result.url).searchParams.get('code');
        if (!authCode) throw new Error('Sem código');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
        if (exchangeError) throw exchangeError;
      }
    } catch {
      setError(pt.auth.error);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!supabase) return;
    const normalized = normalizeAngolanPhone(phoneInput);
    if (!normalized) {
      setError(pt.auth.phoneInvalid);
      return;
    }
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (error) {
      setError(pt.auth.error);
      return;
    }
    setPhone(normalized);
    setStep('code');
  }

  async function verifyCode() {
    if (!supabase || !phone) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (error) setError(pt.auth.error);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>B+</Text>
          </View>
          <Text style={styles.logo}>
            Biska<Text style={{ color: colors.amber }}>+</Text>
          </Text>
          <Text style={styles.tagline}>{pt.tagline}</Text>
          <Text style={styles.intro}>{pt.intro}</Text>
        </View>

        <View style={{ gap: 10 }}>
          {!isSupabaseConfigured && (
            <Text accessibilityRole="alert" style={styles.notice}>
              O Supabase ainda não está configurado. Copia .env.example para .env.local e preenche as chaves.
            </Text>
          )}

          {isSupabaseConfigured && step === 'choose' && (
            <>
              {socialButtons.map((b) => (
                <Pressable
                  key={b.provider}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => signInWith(b.provider)}
                  style={[styles.button, { backgroundColor: b.bg }]}
                >
                  <Text style={[styles.buttonText, { color: b.fg }]}>{b.label}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setStep('phone')}
                style={[styles.button, styles.outline]}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>{pt.auth.phone}</Text>
              </Pressable>
            </>
          )}

          {isSupabaseConfigured && step === 'phone' && (
            <>
              <Text style={styles.label} nativeID="phoneLabel">
                {pt.auth.phoneLabel}
              </Text>
              <View style={styles.phoneRow}>
                <Text style={styles.prefix}>+244</Text>
                <TextInput
                  accessibilityLabelledBy="phoneLabel"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder={pt.auth.phonePlaceholder}
                  placeholderTextColor={colors.onNavyMuted}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={sendCode} style={[styles.button, styles.primary]}>
                <Text style={[styles.buttonText, { color: colors.navy }]}>{pt.auth.sendCode}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setStep('choose')} style={styles.link}>
                <Text style={styles.linkText}>{pt.auth.back}</Text>
              </Pressable>
            </>
          )}

          {isSupabaseConfigured && step === 'code' && phone && (
            <>
              <Text style={styles.intro}>
                {pt.auth.codeSent} <Text style={{ color: '#fff', fontWeight: '700' }}>{formatAngolanPhone(phone)}</Text>.
              </Text>
              <Text style={styles.label} nativeID="codeLabel">
                {pt.auth.codeLabel}
              </Text>
              <TextInput
                accessibilityLabelledBy="codeLabel"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                style={[styles.input, { letterSpacing: 8 }]}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy || code.trim().length < 6}
                onPress={verifyCode}
                style={[styles.button, styles.primary]}
              >
                <Text style={[styles.buttonText, { color: colors.navy }]}>{pt.auth.verify}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setStep('phone')} style={styles.link}>
                <Text style={styles.linkText}>{pt.auth.back}</Text>
              </Pressable>
            </>
          )}

          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}

          <Text style={styles.legal}>{pt.auth.legal}</Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  inner: { flex: 1, paddingHorizontal: 24, paddingBottom: 16, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: 16 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.navy, fontSize: 32, fontWeight: '800' },
  logo: { color: '#fff', fontSize: 44, fontWeight: '800' },
  tagline: { color: '#fff', fontSize: 20, fontWeight: '600' },
  intro: { color: colors.onNavyMuted, fontSize: 15, lineHeight: 22 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  outline: { borderWidth: 1.5, borderColor: '#4C6A93' },
  primary: { backgroundColor: colors.amber },
  label: { color: '#fff', fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefix: { color: colors.onNavyMuted, fontSize: 16 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navy2,
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
  },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.onNavyMuted, textDecorationLine: 'underline' },
  notice: { backgroundColor: colors.amberSoft, color: colors.amberText, padding: 14, borderRadius: 12 },
  error: { backgroundColor: '#FDECEA', color: colors.danger, padding: 12, borderRadius: 12 },
  legal: { color: colors.onNavyMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
});
