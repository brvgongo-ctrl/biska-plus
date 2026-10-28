import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { CategorySlug } from '@biska/shared';

const shapes: Record<CategorySlug, React.ReactNode> = {
  pintor: (
    <>
      <Rect x="3" y="3" width="15" height="6" rx="1.5" />
      <Path d="M18 6h3v5h-9v3" />
      <Rect x="10" y="14" width="4" height="7" rx="1" />
    </>
  ),
  canalizador: (
    <Path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
  ),
  electricista: <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  'empregada-domestica': (
    <>
      <Path d="M3 11l9-7 9 7" />
      <Path d="M5 10v10h14V10" />
      <Path d="M10 20v-5h4v5" />
    </>
  ),
  baba: <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  explicador: (
    <>
      <Path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" />
      <Path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" />
    </>
  ),
  motorista: (
    <>
      <Path d="M3 13l2-6h14l2 6v5H3z" />
      <Circle cx="7.5" cy="15.5" r="1.2" />
      <Circle cx="16.5" cy="15.5" r="1.2" />
    </>
  ),
};

export function CategoryIcon({ slug, color }: { slug: CategorySlug; color: string }) {
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[slug]}
    </Svg>
  );
}
