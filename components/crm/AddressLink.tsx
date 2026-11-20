import { googleMapsSearchUrl } from "@/lib/sales/maps-link";

/** The address as it is already written. A blank value stays an em dash, not a link. */
export function AddressLink({ address }: { address: string | null | undefined }) {
  const href = googleMapsSearchUrl(address);
  if (!href) return "—";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit underline decoration-[hsl(var(--tilo))] underline-offset-2"
    >
      {address}
    </a>
  );
}
