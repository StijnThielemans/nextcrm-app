import { FOLLOW_UP_CHANNEL_LABELS, FOLLOW_UP_CHANNELS, followUpChannelLabel } from "../labels";

describe("dossier opvolging methods", () => {
  it("offers Telefonisch, email, showroom and plaatsbezoek in that order", () => {
    expect(FOLLOW_UP_CHANNELS.map((channel) => FOLLOW_UP_CHANNEL_LABELS[channel])).toEqual([
      "Telefonisch",
      "email",
      "showroom",
      "plaatsbezoek",
    ]);
  });

  it("shows both stored email channels as email", () => {
    expect(followUpChannelLabel("PHONE")).toBe("Telefonisch");
    expect(followUpChannelLabel("EMAIL_SELLER")).toBe("email");
    expect(followUpChannelLabel("EMAIL_OFFERTE")).toBe("email");
    expect(followUpChannelLabel("SHOWROOM")).toBe("showroom");
    expect(followUpChannelLabel("SITE_VISIT")).toBe("plaatsbezoek");
  });
});
