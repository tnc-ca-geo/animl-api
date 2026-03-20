import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const ProjectMetricsSchema = new Schema({
  projectId: { type: String, required: true, ref: 'Project' },
  projectName: { type: String, required: true },
  imageCount: { type: Number, required: true, default: 0 },
  imagesReviewed: { type: Number, required: true, default: 0 },
  imagesNotReviewed: { type: Number, required: true, default: 0 },
  cameraCount: { type: Number, required: true, default: 0 },
  wirelessCameraCount: { type: Number, required: true, default: 0 },
  userCount: { type: Number, required: true, default: 0 },
  imagesAddedSinceLastSnapshot: { type: Number, required: true, default: 0 },
});

const PlatformMetricsSchema = new Schema({
  totalProjects: { type: Number, required: true, default: 0 },
  totalImages: { type: Number, required: true, default: 0 },
  totalImagesReviewed: { type: Number, required: true, default: 0 },
  totalImagesNotReviewed: { type: Number, required: true, default: 0 },
  totalUsers: { type: Number, required: true, default: 0 },
  totalCameras: { type: Number, required: true, default: 0 },
  totalWirelessCameras: { type: Number, required: true, default: 0 },
});

const PlatformStatsSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  snapshotDate: { type: Date, required: true },
  platform: { type: PlatformMetricsSchema, required: true },
  projects: { type: [ProjectMetricsSchema], required: true },
});

// Index for efficient queries by date range
PlatformStatsSchema.index({ snapshotDate: -1 });

export default mongoose.model('PlatformStats', PlatformStatsSchema);

export type PlatformStatsSchemaType = mongoose.InferSchemaType<typeof PlatformStatsSchema>;
export type ProjectMetricsSchemaType = mongoose.InferSchemaType<typeof ProjectMetricsSchema>;
export type PlatformMetricsSchemaType = mongoose.InferSchemaType<typeof PlatformMetricsSchema>;
