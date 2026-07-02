import mongoose from 'mongoose';

const Schema = mongoose.Schema;

/*
 * UserPreferencesSchema
 *    container for all user-scoped preferences. Add new preferences as fields
 *    on this schema. The `updatePreferences` model method has a runtime
 *    allow-list that must be kept in sync with the field names below.
 *
 *    deploymentsSortOrder - per-project preference for ordering camera/deployment
 *      filter sections in the UI. Keyed by projectId, value is a sort-order
 *      identifier (e.g. 'dateAdded' | 'alphabetical').
 */

const UserPreferencesSchema = new Schema(
  {
    deploymentsSortOrder: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  { _id: false },
);

/*
 * UserSchema
 *    persists per-user data (preferences, etc.) keyed by the Cognito username
 *    (cognito:username claim) so it ties to the same identifier used by the
 *    existing Cognito-backed UserModel operations.
 */

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  preferences: { type: UserPreferencesSchema, default: () => ({}) },
  updated: { type: Date, required: true, default: Date.now },
});

export default mongoose.model('User', UserSchema);

export type UserSchema = mongoose.InferSchemaType<typeof UserSchema>;
export type UserPreferencesSchema = mongoose.InferSchemaType<typeof UserPreferencesSchema>;
