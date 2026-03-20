import { ForbiddenError, InternalServerError } from '../../errors.js';
import PlatformStats, { PlatformStatsSchemaType } from '../schemas/PlatformStats.js';
import Project from '../schemas/Project.js';
import { BaseAuthedModel, MethodParams } from './utils.js';
import { Context } from '../../handler.js';
import type * as gql from '../../../@types/graphql.js';

interface ProjectMetadata {
  type?: string | null;
  stage?: string | null;
}

/**
 * Fetch a lightweight map of projectId -> { type, stage } from the live Project collection.
 */
async function getProjectMetadataMap(): Promise<Map<string, ProjectMetadata>> {
  const projects = await Project.find({}, { _id: 1, type: 1, stage: 1 }).lean();
  return new Map(projects.map((p) => [p._id, { type: p.type, stage: p.stage }]));
}

/**
 * Apply type/stage filters to a snapshot's project list and recompute platform totals.
 * Returns a new object (does not mutate the original).
 */
function applyFilters(
  snapshot: PlatformStatsSchemaType,
  projectMeta: Map<string, ProjectMetadata>,
  filter?: gql.PlatformStatsFilterInput | null,
) {
  // If either filter is an explicitly provided empty array, return empty results
  if (
    (filter?.types && filter.types.length === 0) ||
    (filter?.stages && filter.stages.length === 0)
  ) {
    return {
      _id: snapshot._id,
      snapshotDate: snapshot.snapshotDate,
      platform: {
        totalProjects: 0,
        totalImages: 0,
        totalImagesReviewed: 0,
        totalImagesNotReviewed: 0,
        totalUsers: 0,
        totalCameras: 0,
        totalWirelessCameras: 0,
      },
      projects: [],
    };
  }

  // Augment projects with current type/stage from live Project docs
  const augmentedProjects = snapshot.projects.map((p) => ({
    ...('toObject' in p ? (p as any).toObject() : p),
    type: projectMeta.get(p.projectId)?.type ?? null,
    stage: projectMeta.get(p.projectId)?.stage ?? null,
  }));

  // Apply filters if provided
  let filteredProjects = augmentedProjects;
  if (filter?.types?.length) {
    filteredProjects = filteredProjects.filter(
      (p) => p.type && filter.types!.includes(p.type as gql.ProjectType),
    );
  }
  if (filter?.stages?.length) {
    filteredProjects = filteredProjects.filter(
      (p) => p.stage && filter.stages!.includes(p.stage as gql.ProjectStage),
    );
  }

  // Recompute platform totals from filtered project subset
  const platform = {
    totalProjects: filteredProjects.length,
    totalImages: filteredProjects.reduce((sum, p) => sum + p.imageCount, 0),
    totalImagesReviewed: filteredProjects.reduce((sum, p) => sum + p.imagesReviewed, 0),
    totalImagesNotReviewed: filteredProjects.reduce((sum, p) => sum + p.imagesNotReviewed, 0),
    totalUsers: filteredProjects.reduce((sum, p) => sum + p.userCount, 0),
    totalCameras: filteredProjects.reduce((sum, p) => sum + p.cameraCount, 0),
    totalWirelessCameras: filteredProjects.reduce((sum, p) => sum + p.wirelessCameraCount, 0),
  };

  return {
    _id: snapshot._id,
    snapshotDate: snapshot.snapshotDate,
    platform,
    projects: filteredProjects,
  };
}

/**
 * PlatformStats stores weekly snapshots of platform-wide and per-project metrics.
 * Only superusers can access these stats.
 * @class
 */
export class PlatformStatsModel {
  /**
   * Get the most recent platform stats snapshot, optionally filtered by project type/stage.
   */
  static async getLatest(
    input: Maybe<gql.PlatformStatsInput> | undefined,
    context: Pick<Context, 'user'>,
  ) {
    if (!context.user['is_superuser']) {
      throw new ForbiddenError('Only superusers can access platform stats');
    }

    try {
      const snapshot = await PlatformStats.findOne().sort({ snapshotDate: -1 }).lean();
      if (!snapshot) return null;

      const projectMeta = await getProjectMetadataMap();
      return applyFilters(snapshot, projectMeta, input?.filter);
    } catch (err) {
      throw new InternalServerError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Get platform stats snapshots within a date range, optionally filtered by project type/stage.
   */
  static async getHistory(input: gql.PlatformStatsHistoryInput, context: Pick<Context, 'user'>) {
    if (!context.user['is_superuser']) {
      throw new ForbiddenError('Only superusers can access platform stats');
    }

    try {
      const snapshots = await PlatformStats.find({
        snapshotDate: {
          $gte: input.start,
          $lte: input.end,
        },
      })
        .sort({ snapshotDate: 1 })
        .lean();

      const projectMeta = await getProjectMetadataMap();
      return snapshots.map((s) => applyFilters(s, projectMeta, input.filter));
    } catch (err) {
      throw new InternalServerError(err instanceof Error ? err.message : String(err));
    }
  }
}

export default class AuthedPlatformStatsModel extends BaseAuthedModel {
  // No role check needed — superuser check is done inside the static methods
  // because platform stats are not project-scoped
  getLatest(...args: MethodParams<typeof PlatformStatsModel.getLatest>) {
    return PlatformStatsModel.getLatest(...args);
  }

  getHistory(...args: MethodParams<typeof PlatformStatsModel.getHistory>) {
    return PlatformStatsModel.getHistory(...args);
  }
}
