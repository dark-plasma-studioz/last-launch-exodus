import type { LocationId } from "../engine/locations";

export interface ShopListing {
  itemId: string;
  /** Price in caps. */
  price: number;
}

/** Roadside traders and stalls that appear when entering a new biome. */
export const BIOME_SHOPS: Record<Exclude<LocationId, "embark">, ShopListing[]> = {
  open_waste: [
    { itemId: "c_water_drums", price: 95 },
    { itemId: "c_rations_bulk", price: 110 },
    { itemId: "pi_scavengers_pack", price: 165 },
    { itemId: "pi_field_knife", price: 140 },
    { itemId: "u_dog_tags", price: 75 },
  ],
  abandoned_city: [
    { itemId: "c_medkit", price: 175 },
    { itemId: "c_parts", price: 130 },
    { itemId: "pi_field_manual", price: 155 },
    { itemId: "pi_lucky_charm", price: 120 },
    { itemId: "pi_goggles", price: 145 },
    { itemId: "u_geiger", price: 280 },
  ],
  industrial_strip: [
    { itemId: "c_fuel_jerry", price: 120 },
    { itemId: "c_parts", price: 125 },
    { itemId: "pi_tool_belt", price: 170 },
    { itemId: "pi_hazmat_liner", price: 200 },
    { itemId: "pi_rad_patches", price: 185 },
    { itemId: "u_rad_blanket", price: 250 },
  ],
  dead_highway: [
    { itemId: "c_fuel_jerry", price: 115 },
    { itemId: "c_water_drums", price: 100 },
    { itemId: "pi_comfort_kit", price: 95 },
    { itemId: "pi_stim_injector", price: 175 },
    { itemId: "u_maps", price: 220 },
  ],
  port_sprawl: [
    { itemId: "c_medkit", price: 165 },
    { itemId: "c_rations_bulk", price: 105 },
    { itemId: "pi_pharmacist_satchel", price: 190 },
    { itemId: "pi_armour_vest", price: 300 },
    { itemId: "pi_negotiator_pin", price: 130 },
    { itemId: "u_antibiotics", price: 270 },
    { itemId: "u_signal_flare", price: 210 },
  ],
};

export function shopForLocation(loc: LocationId): ShopListing[] {
  if (loc === "embark") return [];
  return BIOME_SHOPS[loc] ?? [];
}
