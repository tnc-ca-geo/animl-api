import _ from 'lodash';
import { DateTime } from 'luxon';


const flattenObj = (ob) => {
  const result = {};
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

const isValidISOString = (str) => {
  const date = DateTime.fromISO(str);
  return date.isValid;
};

// Parse SQS message and replace ISO date strings with DateTime objects
// This is necessary because dates are serialized as ISO strings in SQS messages
// and must be converted to DateTime objects before being used in the app
// https://github.com/tnc-ca-geo/animl-api/issues/166
const parseMessage = (msg) => {
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
      pointer[lastKey] = DateTime.fromISO(value);
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
          pointer[lastKey][i] = DateTime.fromISO(item);
        }
      });
    }

  });
  return msgCopy;
};

export {
  parseMessage
};
