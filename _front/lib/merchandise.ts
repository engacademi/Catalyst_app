import type { Partner } from "./api";

export const OVA_SHOP =
  "https://ovashop.ca/ontario_volleyball_association/shop/home";
export const FALL_CLASSIC_SHOP =
  "https://canuckstuff.com/fallclassic26/shop/home";

export function defaultMerchandise(event: string): Partner {
  const fall = event
    .toLowerCase()
    .replaceAll("-", " ")
    .includes("fall classic");
  return {
    id: "official-merchandise",
    kind: "merchandise",
    active: true,
    sort: 1,
    revision: 1,
    name: fall ? "Fall Classic merchandise" : "OVA merchandise",
    body: "Browse event gear and current ordering options at the official retailer.",
    link_url: fall ? FALL_CLASSIC_SHOP : OVA_SHOP,
    logo_url: fall ? "/events/fall-classic-merch.webp" : null,
    booth_location: null,
    seller_note:
      "Sold by Canuck Stuff. Check the shop for availability, pickup and shipping options.",
  };
}
