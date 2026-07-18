/** A single geocoded place, from either the offline AZ gazetteer or Nominatim. */
export interface PlaceResult {
  id: string;
  name: string;
  region: string | null;
  lat: number;
  lng: number;
  source: 'az-local' | 'nominatim';
}

/** A raw Nominatim search hit, pre-cache-storage. */
export interface NominatimResult {
  id: string;
  name: string;
  region: string | null;
  lat: number;
  lng: number;
}
