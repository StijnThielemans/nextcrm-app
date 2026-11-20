/** Google Maps search for an address already shown on screen. No API key. */
export function googleMapsSearchUrl(address: string | null | undefined): string | null {
  const query = address?.trim() ?? "";
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
