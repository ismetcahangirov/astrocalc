import { CalcEngineError } from '../errors';

/**
 * Letters to numbers, for every alphabet AstroCalc supports.
 *
 * The Pythagorean system is defined over the 26-letter Latin alphabet, so
 * Azerbaijani, Turkish and Russian names are romanized first and then valued
 * with the same table — rather than each language getting its own table. That
 * keeps one letter-value system across all four locales, so the same person's
 * Expression number does not change with the app's display language.
 *
 * Azerbaijani and Turkish already use Latin script, so romanization there is
 * diacritic folding. Russian uses an ISO-9-style Cyrillic transliteration,
 * where a single Cyrillic letter may expand to several Latin ones (Щ → SHCH);
 * that expansion is intentional and is what the letter values are computed
 * over.
 */

/**
 * Latin letters with diacritics, folded to their base letter.
 *
 * Note there is no entry for Turkish dotless `ı`: JavaScript's `toUpperCase()`
 * already maps it to plain `I` before this table is consulted. Dotted `İ`
 * (U+0130) does need an entry, because it uppercases to itself.
 */
const DIACRITIC_FOLDING: Record<string, string> = {
  Ç: 'C',
  Ə: 'E',
  Ğ: 'G',
  İ: 'I',
  Ö: 'O',
  Ş: 'S',
  Ü: 'U',
  Â: 'A',
  Î: 'I',
  Û: 'U',
};

/** Cyrillic to Latin, ISO-9 flavoured but spelled out so values stay intuitive. */
const CYRILLIC_TRANSLITERATION: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'E',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SHCH',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
};

/** The Pythagorean letter-number table: A/J/S=1 … I/R=9. */
const LETTER_VALUES: Record<string, number> = {
  A: 1,
  J: 1,
  S: 1,
  B: 2,
  K: 2,
  T: 2,
  C: 3,
  L: 3,
  U: 3,
  D: 4,
  M: 4,
  V: 4,
  E: 5,
  N: 5,
  W: 5,
  F: 6,
  O: 6,
  X: 6,
  G: 7,
  P: 7,
  Y: 7,
  H: 8,
  Q: 8,
  Z: 8,
  I: 9,
  R: 9,
};

const HARD_VOWELS: readonly string[] = ['A', 'E', 'I', 'O', 'U'];

/**
 * Uppercase a name and map every non-ASCII letter to its Latin equivalent.
 * Separators (spaces, hyphens, apostrophes) survive here and are stripped by
 * {@link nameLetters}, so callers that want to inspect word boundaries can.
 */
export function romanize(name: string): string {
  if (typeof name !== 'string') {
    throw new CalcEngineError('invalid_input', `name must be a string, got: ${typeof name}`);
  }

  let out = '';
  for (const char of name.toUpperCase()) {
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TRANSLITERATION, char)) {
      out += CYRILLIC_TRANSLITERATION[char];
    } else if (Object.prototype.hasOwnProperty.call(DIACRITIC_FOLDING, char)) {
      out += DIACRITIC_FOLDING[char];
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * The scoreable letters of a name: romanized, uppercased, with everything that
 * is not A–Z removed. Spaces, hyphens, apostrophes and digits carry no value in
 * the Pythagorean system, so they are dropped rather than scored as zero.
 */
export function nameLetters(name: string): string[] {
  const letters = romanize(name)
    .split('')
    .filter((c) => c >= 'A' && c <= 'Z');

  if (letters.length === 0) {
    throw new CalcEngineError('invalid_input', `name contains no usable letters: ${name}`);
  }
  return letters;
}

/** The Pythagorean value of a single romanized letter. */
export function letterValue(letter: string): number {
  const value = LETTER_VALUES[letter];
  if (value === undefined) {
    throw new CalcEngineError('invalid_input', `not a Latin letter A-Z: ${letter}`);
  }
  return value;
}

export interface VowelSplit {
  vowels: string[];
  consonants: string[];
}

/**
 * Partition a name's letters into vowels (Soul Urge) and consonants
 * (Personality).
 *
 * A, E, I, O and U are always vowels. **Y is a vowel only when neither
 * neighbour is a hard vowel** — so it is the vowel sound in KYLIE, but the
 * consonant glide in AYLA and YUSIF. Sources disagree on Y, and the
 * syllable-based rule cannot be applied without a pronunciation dictionary;
 * this adjacency rule is deterministic, language-independent, and testable,
 * which matters more here than matching any one school.
 */
export function splitVowelsAndConsonants(letters: string[]): VowelSplit {
  const vowels: string[] = [];
  const consonants: string[] = [];

  letters.forEach((letter, i) => {
    if (HARD_VOWELS.includes(letter)) {
      vowels.push(letter);
      return;
    }
    if (letter === 'Y') {
      const prev = letters[i - 1];
      const next = letters[i + 1];
      const touchesVowel =
        (prev !== undefined && HARD_VOWELS.includes(prev)) ||
        (next !== undefined && HARD_VOWELS.includes(next));
      (touchesVowel ? consonants : vowels).push(letter);
      return;
    }
    consonants.push(letter);
  });

  return { vowels, consonants };
}
