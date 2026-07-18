/**
 * A point on Earth's surface, in decimal degrees (WGS84).
 * Positive latitude is north of the equator; positive longitude is east of
 * Greenwich. Shared across every calc-engine domain that needs a place
 * (natal chart, transits, historical timezone resolution).
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}
