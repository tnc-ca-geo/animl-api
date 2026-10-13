import { DateTime } from 'luxon';
import { LabelSchema, ObjectSchema } from '../api/db/schemas/shared/index.js';

const DATE_TIME_TAG = '__DateTime__';

function tagDates(value: any): any {
  if (DateTime.isDateTime(value)) return { [DATE_TIME_TAG]: value.toISO() };
  if (value instanceof Date) return { [DATE_TIME_TAG]: value.toISOString() };
  if (Array.isArray(value)) return value.map(tagDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tagDates(v)]));
  }
  return value;
}

function reviveDates(value: any): any {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === 'object') {
    if (typeof value[DATE_TIME_TAG] === 'string') return DateTime.fromISO(value[DATE_TIME_TAG]);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveDates(v)]));
  }
  return value;
}

// Dates are tagged on the way out so parseConfig() can revive exactly these values. Sniffing for
// ISO-looking strings instead would convert any numeric config value (camera serial numbers, for
// one) into a date, since Luxon accepts partial ISO strings like "24" and "1234".
// https://github.com/tnc-ca-geo/animl-api/issues/166
// https://github.com/tnc-ca-geo/animl-api/issues/459
export const serializeConfig = <T>(config: T): T => tagDates(config ?? null);

export const parseConfig = <T>(config: T): T => reviveDates(config);

function findFirstValidLabel(obj: ObjectSchema): LabelSchema | null {
  // label has validation and is validated true
  return obj.labels.find((label) => label.validation && label.validation.validated) || null;
}

function findFirstNonInvalidatedLabel(obj: ObjectSchema): LabelSchema | null {
  // label either has no validation or is validated true
  return obj.labels.find((label) => !label.validation || label.validation.validated) || null;
}

export function findRepresentativeLabel(obj: ObjectSchema): LabelSchema | null {
  if (obj.locked) {
    // return locked object's first label that is validated
    return findFirstValidLabel(obj);
  } else {
    // return first label (most recent label added) in list that hasn't been invalidated
    return findFirstNonInvalidatedLabel(obj) || null;
  }
}
