export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Biska<span className="text-amber">+</span>
    </span>
  );
}
