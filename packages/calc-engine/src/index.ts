/**
 * Public entry point of `@astrocalc/calc-engine`.
 *
 * Everything exported here is **React Native safe**: it depends only on
 * pure-JS libraries (`astronomy-engine`, `luxon`) and never on `geo-tz`/Node
 * `fs`, so the mobile app can import it to compute charts fully offline (issue
 * #20) with no extra polyfills. The one `geo-tz`-dependent piece —
 * coordinate → IANA-timezone lookup — is intentionally *not* re-exported here;
 * backend code that needs it imports from the `@astrocalc/calc-engine/node`
 * subpath instead (see `./node`).
 */
export { CalcEngineError } from './errors';
export type { GeoCoordinates } from './types';
export { localTimeToUtc, type LocalDateTime, type UtcConversion } from './timezone';
export {
  computePlanetaryPositions,
  type CelestialBody,
  type ZodiacSign,
  type PlanetPosition,
  type LunarNodeModel,
  type PlanetaryPositionsOptions,
} from './planetary-positions';
export {
  computeHouses,
  findHouseNumber,
  DEFAULT_HOUSE_SYSTEM,
  type HouseSystem,
  type HouseCusp,
  type HousesOptions,
  type HousesResult,
  type EclipticPoint,
} from './houses';
export {
  computeAspects,
  ASPECT_ANGLES,
  DEFAULT_ORBS,
  type AspectType,
  type AspectBody,
  type Aspect,
  type OrbConfig,
  type AspectsOptions,
} from './aspects';
export {
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  INTERPRETED_BODIES,
  planetSignSubjectKey,
  planetHouseSubjectKey,
  houseSubjectKey,
  angleSubjectKey,
  ANGLE_KINDS,
  aspectSubjectKey,
  listInterpretationSubjects,
  numerologySubjectKey,
  listNumerologySubjects,
  matrixSubjectKey,
  listMatrixSubjects,
  type InterpretationLocale,
  type InterpretationCategory,
  type InterpretationSubject,
  type AngleKind,
  type NumerologyNumberKind,
  type MatrixSubjectKind,
} from './interpretations';
export {
  computeNatalChart,
  NATAL_CHART_SCHEMA_VERSION,
  type NatalChartInput,
  type NatalChartOptions,
  type NatalChart,
} from './natal-chart';
export {
  computeNumerologyProfile,
  NUMEROLOGY_SCHEMA_VERSION,
  type NumerologyInput,
  type NumerologyProfile,
  type NumerologyNumber,
  type Pinnacle,
  type Challenge,
  type LifePeriod,
} from './numerology';
export {
  computeDestinyMatrix,
  MATRIX_SCHEMA_VERSION,
  ARCANA_COUNT,
  ARCANA_VALUES,
  CHAKRA_ORDER,
  isArcana,
  type MatrixInput,
  type DestinyMatrix,
  type Arcana,
  type CoreSquare,
  type AncestralCorner,
  type AncestralSquare,
  type Purposes,
  type MoneyAndRelationshipLine,
  type ChakraName,
  type ChakraRow,
  type HealthSummary,
} from './matrix';
