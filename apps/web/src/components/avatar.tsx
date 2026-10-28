import { initials } from "@biska/shared";

/** Fotografia do profissional ou, sem ela, as iniciais. */
export function Avatar({ name, url, size = 56 }: { name: string | null; url: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (url) {
    // Fotografias de contas Google/Facebook: endereços externos variados.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.36 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-amber"
    >
      {initials(name)}
    </span>
  );
}
