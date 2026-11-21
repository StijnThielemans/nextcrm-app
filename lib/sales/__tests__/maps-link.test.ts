import { googleMapsSearchUrl } from "../maps-link";

describe("google maps address link", () => {
  it("encodes the address that is already shown", () => {
    expect(googleMapsSearchUrl("Kerkstraat 12, 9000 Gent")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Kerkstraat%2012%2C%209000%20Gent",
    );
  });

  it("keeps characters that would break the query inside the encoded value", () => {
    expect(googleMapsSearchUrl("A & B")).toBe(
      "https://www.google.com/maps/search/?api=1&query=A%20%26%20B",
    );
  });

  it("is empty when there is no address", () => {
    expect(googleMapsSearchUrl("")).toBeNull();
    expect(googleMapsSearchUrl("   ")).toBeNull();
    expect(googleMapsSearchUrl(null)).toBeNull();
    expect(googleMapsSearchUrl(undefined)).toBeNull();
  });
});
