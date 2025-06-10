import _ from 'lodash';
import { DateTime } from 'luxon';
import { LabelSchema, ObjectSchema } from '../api/db/schemas/shared/index.js';

const flattenObj = (ob: Record<any, any>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const i in ob) {
    if (typeof ob[i] === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObj(ob[i]);
      for (const j in temp) {
        result[i + '.' + j] = temp[j];
      }
    } else {
      result[i] = ob[i];
    }
  }
  return result;
};

const isValidISOString = (str: string): boolean => {
  const date = DateTime.fromISO(str);
  return date.isValid;
};

// Parse SQS message and replace ISO date strings with DateTime objects
// This is necessary because dates are serialized as ISO strings in SQS messages
// and must be converted to DateTime objects before being used in the app
// https://github.com/tnc-ca-geo/animl-api/issues/166
export const parseMessage = <T extends Record<string, any>>(msg: T): T => {
  const msgCopy = _.cloneDeep(msg);
  const flatMsg = flattenObj(msg);

  Object.entries(flatMsg).forEach(([key, value]) => {
    if (value !== null && typeof value == 'string' && isValidISOString(value)) {
      let pointer = msgCopy;
      const keys = key.split('.');
      const lastKey = keys.pop();
      for (const k of keys) {
        pointer = pointer[k];
      }
      (pointer[lastKey!] as any) = DateTime.fromISO(value);
    }

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (isValidISOString(item)) {
          let pointer = msgCopy;
          const keys = key.split('.');
          const lastKey = keys.pop();
          for (const k of keys) {
            pointer = pointer[k];
          }
          pointer[lastKey!][i] = DateTime.fromISO(item);
        }
      });
    }
  });
  return msgCopy;
};

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
