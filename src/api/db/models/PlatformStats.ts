import { ForbiddenError, InternalServerError } from '../../errors.js';
import PlatformStats, { PlatformStatsSchemaType } from '../schemas/PlatformStats.js';
import { BaseAuthedModel, MethodParams } from './utils.js';
import { Context } from '../../handler.js';
import { HydratedDocument } from 'mongoose';

/**
 * PlatformStats stores weekly snapshots of platform-wide and per-project metrics.
 * Only superusers can access these stats.
 * @class
 */
export class PlatformStatsModel {
  /**
   * Get the most recent platform stats snapshot
   */
  static async getLatest(
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<PlatformStatsSchemaType> | null> {
    if (!context.user['is_superuser']) {
      throw new ForbiddenError('Only superusers can access platform stats');
    }

    try {
      return await PlatformStats.findOne().sort({ snapshotDate: -1 }).exec();
    } catch (err) {
      throw new InternalServerError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Get platform stats snapshots within a date range (for time-series charts)
   */
  static async getHistory(
    input: { start: Date; end: Date },
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<PlatformStatsSchemaType>[]> {
    if (!context.user['is_superuser']) {
      throw new ForbiddenError('Only superusers can access platform stats');
    }

    try {
      return await PlatformStats.find({
        snapshotDate: {
          $gte: input.start,
          $lte: input.end,
        },
      })
        .sort({ snapshotDate: 1 })
        .exec();
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
