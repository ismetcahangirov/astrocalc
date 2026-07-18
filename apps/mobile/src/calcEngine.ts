/**
 * Confirms `@astrocalc/calc-engine` resolves as a workspace package under
 * Metro/TypeScript in the mobile app (see metro.config.js for the monorepo
 * resolver config this relies on). Calculation domains land in later
 * calc-engine sub-issues and will be consumed from here.
 */
import { CalcEngineError } from '@astrocalc/calc-engine';

export { CalcEngineError };
