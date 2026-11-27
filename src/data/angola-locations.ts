export type { Municipality, Province } from "./country-locations";
export { countryLocations } from "./country-locations";
import { getProvincesForCountry } from "./country-locations";

// Compatibilidade: as telas antigas continuam a importar este ficheiro,
// mas passam a usar a mesma fonte oficial de localização de Angola.
export const angolaProvinces = getProvincesForCountry("AO");
