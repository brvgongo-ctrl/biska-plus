import Link from "next/link";
import { formatKz, formatRating, getCategory, pt, type PublicProfessional } from "@biska/shared";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/verified-badge";

/** Cartão de um profissional na lista de resultados. */
export function ProCard({ pro }: { pro: PublicProfessional }) {
  const rating = formatRating(pro.rating_avg, pro.rating_count);
  return (
    <Link
      href={`/profissionais/${pro.id}`}
      className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-4 hover:border-navy"
    >
      <div className="flex items-center gap-3">
        <Avatar name={pro.display_name} url={pro.avatar_url} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{pro.display_name}</span>
          <span className="text-sm text-muted">{getCategory(pro.category_slug)?.name}</span>
        </div>
      </div>
      <VerifiedBadge />
      <p className="text-sm text-muted">
        {rating ? (
          <>
            <span className="font-bold text-ink">★ {rating}</span> · {pt.search.reviews(pro.rating_count)}
          </>
        ) : (
          pt.search.new
        )}
        {pro.years_experience ? ` · ${pt.search.yearsExperience(pro.years_experience)}` : ""}
      </p>
      {pro.zone_names.length > 0 && <p className="text-sm text-muted">{pro.zone_names.join(", ")}</p>}
      {pro.daily_rate_kz && (
        <p className="mt-auto text-sm">
          {pt.search.from} <span className="font-bold">{formatKz(pro.daily_rate_kz)}</span>
          {pt.search.perDay}
        </p>
      )}
    </Link>
  );
}
