import { DateTime } from 'luxon';
import mongoose from 'mongoose';

// Generic interface to transform properties
export type ReplaceDateWithDateTime<T> = {
  // TODO: We should better separate data coming from the database (which has date as DateTime) and
  // data going to the database (which has date as Date).
  [P in keyof T]: [P] extends Date // If property is a Date...
    ? DateTime | Date // then convert to Date or Datetime.
    : T[P] extends Date | null | undefined // If property is an optional Date...
    ? DateTime | Extract<T[P], null | undefined> // then mark all optional Date properties as optional DateTime
    : T[P] extends mongoose.Types.DocumentArray<infer U> // If property is a relationship...
    ? mongoose.Types.DocumentArray<ReplaceDateWithDateTime<U>> // then recursively transform the relationship
    : T[P]; // otherwise, leave the property as is.
};

// A utility type that applies our custom transformation to the result of mongoose.InferSchemaType
export type InferSchemaTypeWithDateTime<T> = ReplaceDateWithDateTime<mongoose.InferSchemaType<T>>;
