/** Where the party is on the map — drives event eligibility. */
export type LocationId =
  | "open_waste"
  | "abandoned_city"
  | "industrial_strip"
  | "dead_highway"
  | "port_sprawl"
  | "embark";

export const LOCATION_LABEL: Record<LocationId, string> = {
  open_waste: "Open wastes",
  abandoned_city: "Abandoned city",
  industrial_strip: "Industrial ruins",
  dead_highway: "Dead highway",
  port_sprawl: "Port sprawl",
  embark: "Embarkation complex",
};

/** Band thresholds on km remaining (high → low as you approach the port). */
export function locationFromKm(kmRemaining: number): LocationId {
  if (kmRemaining <= 0) return "embark";
  if (kmRemaining < 420) return "port_sprawl";
  if (kmRemaining < 1100) return "dead_highway";
  if (kmRemaining < 2300) return "industrial_strip";
  if (kmRemaining < 3500) return "abandoned_city";
  return "open_waste";
}
