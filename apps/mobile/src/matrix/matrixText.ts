import type { ChakraName, DestinyMatrix } from '@astrocalc/calc-engine';
import type { Locale } from '../i18n/translations';

/**
 * Turns a computed {@link DestinyMatrix} into localized, human-readable rows for
 * the written breakdown beneath the octagram — the core square, the ancestral
 * square, the purposes, the money/relationship line and the chakra map.
 *
 * Like `chart/chartText.ts` and `numerology/numerologyText.ts`, this uses
 * **names**, never symbols: arcana are plain ASCII numbers rendered in the
 * system font, so nothing here depends on the bundled glyph font. Pure and
 * locale-driven, so it unit-tests without React.
 *
 * The breakdown exists so the Matrix is readable *before* the visualization is
 * understood. An octagram is not self-explanatory — a first-time reader has no
 * idea which point is which — so every value on the figure also appears here
 * with a name attached, and the positions that have no agreed place on the
 * figure at all (the purposes, the line, the chakras) appear here only.
 */

interface LabelSet {
  day: string;
  month: string;
  year: string;
  sum: string;
  centre: string;
  paternalSpiritual: string;
  paternalMaterial: string;
  maternalSpiritual: string;
  maternalMaterial: string;
  ancestralCentre: string;
  paternalLine: string;
  maternalLine: string;
  sky: string;
  earth: string;
  personal: string;
  social: string;
  spiritual: string;
  planetary: string;
  entry: string;
  toEntry: string;
  lineCore: string;
  toPartner: string;
  partner: string;
}

/** Row labels for every named position, per locale. */
const POSITION_LABELS: Record<Locale, LabelSet> = {
  en: {
    day: 'Day — your portrait',
    month: 'Month — your talents',
    year: 'Year — ancestral programmes',
    sum: 'Karmic tail',
    centre: 'Comfort zone',
    paternalSpiritual: "Father's line — spiritual",
    paternalMaterial: "Father's line — material",
    maternalSpiritual: "Mother's line — spiritual",
    maternalMaterial: "Mother's line — material",
    ancestralCentre: 'Ancestral centre',
    paternalLine: "Father's line",
    maternalLine: "Mother's line",
    sky: 'Sky',
    earth: 'Earth',
    personal: 'Personal purpose',
    social: 'Social purpose',
    spiritual: 'Spiritual purpose',
    planetary: 'Planetary purpose',
    entry: 'Entry point',
    toEntry: 'Toward the entry',
    lineCore: 'Central energy',
    toPartner: 'Toward the partner',
    partner: 'Partner point',
  },
  az: {
    day: 'Gün — portretiniz',
    month: 'Ay — istedadlarınız',
    year: 'İl — nəsil proqramları',
    sum: 'Karmik quyruq',
    centre: 'Rahatlıq zonası',
    paternalSpiritual: 'Ata xətti — mənəvi',
    paternalMaterial: 'Ata xətti — maddi',
    maternalSpiritual: 'Ana xətti — mənəvi',
    maternalMaterial: 'Ana xətti — maddi',
    ancestralCentre: 'Nəsil mərkəzi',
    paternalLine: 'Ata xətti',
    maternalLine: 'Ana xətti',
    sky: 'Göy',
    earth: 'Yer',
    personal: 'Şəxsi təyinat',
    social: 'Sosial təyinat',
    spiritual: 'Mənəvi təyinat',
    planetary: 'Planetar təyinat',
    entry: 'Giriş nöqtəsi',
    toEntry: 'Girişə doğru',
    lineCore: 'Mərkəzi enerji',
    toPartner: 'Partnyora doğru',
    partner: 'Partnyor nöqtəsi',
  },
};

/** Chakra names, per locale. Transliterated rather than translated — they are proper nouns. */
const CHAKRA_LABELS: Record<Locale, Record<ChakraName, string>> = {
  en: {
    sahasrara: 'Sahasrara',
    ajna: 'Ajna',
    vishuddha: 'Vishuddha',
    anahata: 'Anahata',
    manipura: 'Manipura',
    svadhisthana: 'Svadhisthana',
    muladhara: 'Muladhara',
  },
  az: {
    sahasrara: 'Sahasrara',
    ajna: 'Acna',
    vishuddha: 'Vişuddha',
    anahata: 'Anahata',
    manipura: 'Manipura',
    svadhisthana: 'Svadhistana',
    muladhara: 'Muladhara',
  },
};

/** One labelled arcana. */
export interface MatrixRow {
  key: string;
  label: string;
  /** The arcana, as a string. */
  value: string;
}

/** One chakra row of the health map. */
export interface MatrixChakraRow {
  key: string;
  label: string;
  physical: string;
  energy: string;
  emotional: string;
}

export interface MatrixDetails {
  core: MatrixRow[];
  ancestral: MatrixRow[];
  purposes: MatrixRow[];
  /** The five arcana both the money and the relationship reading are taken from. */
  moneyAndRelationships: MatrixRow[];
  health: MatrixChakraRow[];
}

/** Build the localized detail rows for a Matrix. */
export function formatMatrixDetails(matrix: DestinyMatrix, locale: Locale): MatrixDetails {
  const names = POSITION_LABELS[locale];
  const chakras = CHAKRA_LABELS[locale];

  const row = (key: keyof LabelSet, value: number): MatrixRow => ({
    key,
    label: names[key],
    value: String(value),
  });

  return {
    core: [
      row('day', matrix.core.day),
      row('month', matrix.core.month),
      row('year', matrix.core.year),
      row('sum', matrix.core.sum),
      row('centre', matrix.core.centre),
    ],
    ancestral: [
      row('paternalSpiritual', matrix.ancestral.paternalSpiritual.corner),
      row('paternalMaterial', matrix.ancestral.paternalMaterial.corner),
      row('maternalSpiritual', matrix.ancestral.maternalSpiritual.corner),
      row('maternalMaterial', matrix.ancestral.maternalMaterial.corner),
      row('paternalLine', matrix.ancestral.paternalLine),
      row('maternalLine', matrix.ancestral.maternalLine),
      row('ancestralCentre', matrix.ancestral.centre),
    ],
    purposes: [
      row('sky', matrix.purposes.sky),
      row('earth', matrix.purposes.earth),
      row('personal', matrix.purposes.personal),
      row('social', matrix.purposes.social),
      row('spiritual', matrix.purposes.spiritual),
      row('planetary', matrix.purposes.planetary),
    ],
    // Emitted in line order — entry, toEntry, core, toPartner, partner — so the
    // list reads along the line as it is drawn, rather than in struct order.
    moneyAndRelationships: [
      row('entry', matrix.moneyAndRelationships.entry),
      row('toEntry', matrix.moneyAndRelationships.toEntry),
      row('lineCore', matrix.moneyAndRelationships.core),
      row('toPartner', matrix.moneyAndRelationships.toPartner),
      row('partner', matrix.moneyAndRelationships.partner),
    ],
    health: matrix.health.map((r) => ({
      key: r.chakra,
      label: chakras[r.chakra],
      physical: String(r.physical),
      energy: String(r.energy),
      emotional: String(r.emotional),
    })),
  };
}
