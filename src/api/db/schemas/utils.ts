import { DateTime } from "luxon";
import mongoose from "mongoose";

// Generic interface to transform properties
type ReplaceDateWithDateTime<T> = {
  [P in keyof T]: T[P] extends Date
    ? DateTime
    : T[P] extends Date | null | undefined
    ? DateTime | Extract<T[P], null | undefined>
    : T[P];
};

// A utility type that applies our custom transformation to the result of mongoose.InferSchemaType
export type InferSchemaTypeWithDateTime<T> = ReplaceDateWithDateTime<
  mongoose.InferSchemaType<T>
>;
