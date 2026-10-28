import { Redirect } from 'expo-router';

/** Destino do deep link do login social; a troca do código é feita em entrar.tsx. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
