/**
 * A person's name held as three separate parts — first name, surname and
 * patronymic (ata adı) — as the mobile forms now collect them (#name-split).
 * Stored as the source of truth on both `profiles` and `subjects`; the single
 * combined `fullName`/`name` string every downstream reader (numerology,
 * People list, chart titles) still uses is *composed* from these, so nothing
 * below the form layer had to learn about the split.
 */
export interface NameParts {
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
}

const clean = (value: string | null | undefined): string => (value ?? '').trim();

/**
 * Join first name, surname and patronymic into one display/birth name — the
 * value numerology scores and the People list shows. Empty parts are dropped,
 * so a first-name-only person composes to just that; all-empty composes to
 * `null` ("no name yet"), which is what an absent name means to the numerology
 * service.
 */
export function composeFullName(parts: Partial<NameParts>): string | null {
  const joined = [parts.firstName, parts.lastName, parts.patronymic]
    .map(clean)
    .filter((part) => part !== '')
    .join(' ');
  return joined === '' ? null : joined;
}

/**
 * Best-effort split of a legacy single-string name back into parts, used to
 * prefill the three inputs for records saved before the split existed (their
 * parts columns are null). The first whitespace-delimited token is the first
 * name, the second the surname, and anything remaining the patronymic — a
 * lossless round trip for the common "Ad Soyad Ata-adı" shape, and never worse
 * than dropping the name.
 */
export function splitFullName(full: string | null | undefined): NameParts {
  const tokens = clean(full).split(/\s+/).filter(Boolean);
  const [firstName, lastName, ...rest] = tokens;
  return {
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    patronymic: rest.length > 0 ? rest.join(' ') : null,
  };
}

/** The casual greeting name (`displayName`) derived from the parts: the first name. */
export function displayNameOf(parts: Partial<NameParts>): string | null {
  const first = clean(parts.firstName);
  return first === '' ? null : first;
}
