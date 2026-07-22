/**
 * A person's name held as three parts — first name, surname and patronymic
 * (Ad / Soyad / Ata adı) — the shape the forms now collect (#name-split). The
 * backend stores these as the source of truth and composes the single combined
 * name it needs from them; on the client these helpers are used to prefill the
 * three inputs when editing a record saved before the split (its parts are
 * null, so the combined name is split back into them).
 */
export interface NameParts {
  firstName: string;
  lastName: string;
  patronymic: string;
}

export const EMPTY_NAME_PARTS: NameParts = { firstName: '', lastName: '', patronymic: '' };

const clean = (value: string | null | undefined): string => (value ?? '').trim();

/** Join the three parts into one name, dropping empties; '' when nothing is set. */
export function composeFullName(parts: Partial<NameParts>): string {
  return [parts.firstName, parts.lastName, parts.patronymic]
    .map(clean)
    .filter((part) => part !== '')
    .join(' ');
}

/**
 * Best-effort split of a legacy combined name into parts, to prefill the three
 * inputs. First token → first name, second → surname, the rest → patronymic.
 */
export function splitFullName(full: string | null | undefined): NameParts {
  const tokens = clean(full).split(/\s+/).filter(Boolean);
  const [firstName, lastName, ...rest] = tokens;
  return {
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    patronymic: rest.join(' '),
  };
}

/**
 * Prefill the three inputs from a stored record. Prefers the record's own parts
 * and only falls back to splitting a legacy combined name (`fullName`/`name`)
 * when no part is stored yet.
 */
export function partsFromRecord(record: {
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  fullName?: string | null;
  name?: string | null;
}): NameParts {
  const hasParts = !!(record.firstName || record.lastName || record.patronymic);
  if (hasParts) {
    return {
      firstName: record.firstName ?? '',
      lastName: record.lastName ?? '',
      patronymic: record.patronymic ?? '',
    };
  }
  return splitFullName(record.fullName ?? record.name ?? '');
}
