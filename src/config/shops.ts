import type { LocationId } from "../engine/locations";

export interface ShopListing {
  itemId: string;
  price: number;
}

export const BIOME_SHOPS: Record<Exclude<LocationId, "embark">, ShopListing[]> = {
  open_waste: [
    { itemId: "c_rations_bulk", price: 110 },
    { itemId: "pi_hunting_kit", price: 175 },
    { itemId: "pi_iron_boots", price: 190 },
    { itemId: "pi_lucky_charm", price: 120 },
  ],
  abandoned_city: [
    { itemId: "c_medkit", price: 175 },
    { itemId: "c_parts", price: 130 },
    { itemId: "pi_armour_vest", price: 310 },
    { itemId: "pi_comfort_kit", price: 100 },
    { itemId: "u_geiger", price: 280 },
  ],
  industrial_strip: [
    { itemId: "c_fuel_jerry", price: 120 },
    { itemId: "c_parts", price: 125 },
    { itemId: "pi_hazmat_liner", price: 180 },
    { itemId: "pi_stim_injector", price: 200 },
    { itemId: "u_rad_blanket", price: 250 },
  ],
  dead_highway: [
    { itemId: "c_fuel_jerry", price: 115 },
    { itemId: "c_rations_bulk", price: 105 },
    { itemId: "pi_ration_belt", price: 155 },
    { itemId: "pi_trade_papers", price: 165 },
    { itemId: "u_maps", price: 220 },
  ],
  port_sprawl: [
    { itemId: "c_medkit", price: 165 },
    { itemId: "c_rations_bulk", price: 100 },
    { itemId: "pi_medic_bag", price: 220 },
    { itemId: "pi_armour_vest", price: 300 },
    { itemId: "u_antibiotics", price: 270 },
    { itemId: "u_signal_flare", price: 210 },
  ],
};

export function shopForLocation(loc: LocationId): ShopListing[] {
  if (loc === "embark") return [];
  return BIOME_SHOPS[loc] ?? [];
}
