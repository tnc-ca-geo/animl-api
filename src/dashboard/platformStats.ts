import mongoose from 'mongoose';
import Cognito from '@aws-sdk/client-cognito-identity-provider';
import retry from 'async-retry';
import { getConfig, Config } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import Image from '../api/db/schemas/Image.js';
import Project from '../api/db/schemas/Project.js';
import WirelessCamera from '../api/db/schemas/WirelessCamera.js';
import PlatformStats from '../api/db/schemas/PlatformStats.js';

interface ProjectImageStats {
  _id: string; // projectId
  imageCount: number;
  imagesReviewed: number;
  imagesNotReviewed: number;
}

// Max number of projects to query Cognito for concurrently
const COGNITO_PROJECT_CONCURRENCY = 5;

/**
 * Helper to check if an error is a Cognito throttling error.
 */
function isThrottlingError(err: any): boolean {
  return (
    err.name === 'TooManyRequestsException' ||
    err.name === 'ThrottlingException' ||
    err.$metadata?.httpStatusCode === 429
  );
}

/**
 * Wrapper around cognito.send() with retry + exponential backoff for throttling.
 */
async function cognitoSendWithRetry(
  cognito: Cognito.CognitoIdentityProviderClient,
  command: any,
): Promise<any> {
  return retry(
    async (bail) => {
      try {
        return await cognito.send(command);
      } catch (err: any) {
        // Retry on throttling, bail on everything else
        if (isThrottlingError(err)) {
          throw err; // async-retry will retry
        }
        bail(err); // non-retryable error
        return undefined as never; // unreachable, but satisfies TS
      }
    },
    {
      retries: 5,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
    },
  );
}

/**
 * Small delay utility for pacing between batches.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Collect unique usernames for a single project across all Cognito role groups.
 */
async function getUsernamesForProject(
  cognito: Cognito.CognitoIdentityProviderClient,
  projectId: string,
  userPoolId: string,
): Promise<string[]> {
  const uniqueUsers = new Set<string>();

  for (const role of ['manager', 'observer', 'member']) {
    const groupName = `animl/${projectId}/project_${role}`;
    try {
      let nextToken: string | undefined;
      do {
        const res: Cognito.ListUsersInGroupCommandOutput = await cognitoSendWithRetry(
          cognito,
          new Cognito.ListUsersInGroupCommand({
            Limit: 60,
            UserPoolId: userPoolId,
            GroupName: groupName,
            NextToken: nextToken,
          }),
        );
        for (const user of res.Users || []) {
          if (user.Username) uniqueUsers.add(user.Username);
        }
        nextToken = res.NextToken;
      } while (nextToken);
    } catch (err: any) {
      // Group may not exist (e.g. for legacy projects), skip gracefully
      if (err.name === 'ResourceNotFoundException') {
        console.log(`Group ${groupName} not found, skipping`);
        continue;
      }
      throw err;
    }
  }

  return [...uniqueUsers];
}

/**
 * Collect unique usernames across all Cognito groups for each project.
 * Processes projects in small concurrent batches to avoid Cognito rate limits.
 * Returns a map of projectId -> array of unique usernames.
 */
async function getUsernamesByProject(
  projectIds: string[],
  config: Config,
): Promise<Map<string, string[]>> {
  const cognito = new Cognito.CognitoIdentityProviderClient({
    region: process.env.REGION,
  });
  const userPoolId = config['/APPLICATION/COGNITO/USERPOOLID'];
  const usernamesMap = new Map<string, string[]>();

  // Process projects in batches to avoid Cognito rate limits (~25 RPS)
  for (let i = 0; i < projectIds.length; i += COGNITO_PROJECT_CONCURRENCY) {
    const batch = projectIds.slice(i, i + COGNITO_PROJECT_CONCURRENCY);
    const results = await Promise.all(
      batch.map((projectId) => getUsernamesForProject(cognito, projectId, userPoolId)),
    );

    for (let j = 0; j < batch.length; j++) {
      usernamesMap.set(batch[j], results[j]);
    }

    // Small delay between batches to avoid sustained pressure on Cognito
    if (i + COGNITO_PROJECT_CONCURRENCY < projectIds.length) {
      await delay(500);
    }
  }

  return usernamesMap;
}

/**
 * Scheduled Lambda handler that computes platform-wide and per-project metrics
 * and stores a snapshot in the PlatformStats collection.
 *
 * Triggered weekly by EventBridge cron rule.
 */
export async function computeStats(): Promise<void> {
  console.log('computeStats: starting platform stats computation');
  const startTime = Date.now();

  try {
    const config = await getConfig();
    await connectToDatabase(config);

    // 1. Get all projects
    const projects = await Project.find({}).lean();
    const projectIds = projects.map((p) => p._id);
    console.log(`computeStats: found ${projects.length} projects`);

    // 2. Run independent queries in parallel:
    //    - image stats aggregation
    //    - wireless camera counts aggregation
    //    - per-project usernames (Cognito)
    //    - previous snapshot (for computing deltas)
    const [imageStatsByProject, wirelessCameraAgg, usernamesByProject, lastSnapshot] =
      await Promise.all([
        Image.aggregate<ProjectImageStats>([
          {
            $group: {
              _id: '$projectId',
              imageCount: { $sum: 1 },
              imagesReviewed: {
                $sum: { $cond: [{ $eq: ['$reviewed', true] }, 1, 0] },
              },
              imagesNotReviewed: {
                $sum: { $cond: [{ $ne: ['$reviewed', true] }, 1, 0] },
              },
            },
          },
        ]),
        WirelessCamera.aggregate<{ _id: string; count: number }>([
          { $unwind: '$projRegistrations' },
          { $match: { 'projRegistrations.active': true } },
          { $group: { _id: '$projRegistrations.projectId', count: { $sum: 1 } } },
        ]),
        getUsernamesByProject(projectIds, config),
        PlatformStats.findOne().sort({ snapshotDate: -1 }).lean(),
      ]);

    console.log(`computeStats: aggregated image stats for ${imageStatsByProject.length} projects`);

    const imageStatsMap = new Map(imageStatsByProject.map((s) => [s._id, s]));
    const wirelessCameraCountByProject = new Map(wirelessCameraAgg.map((r) => [r._id, r.count]));

    // 3. Build map of previous image counts for delta computation
    const lastProjectImageCounts = new Map<string, number>();
    if (lastSnapshot) {
      for (const proj of lastSnapshot.projects) {
        lastProjectImageCounts.set(proj.projectId, proj.imageCount);
      }
    }

    // 4. Build per-project metrics
    const projectMetrics = projects.map((project) => {
      const imgStats = imageStatsMap.get(project._id) || {
        imageCount: 0,
        imagesReviewed: 0,
        imagesNotReviewed: 0,
      };
      const cameraCount = project.cameraConfigs?.length || 0;
      const wirelessCameraCount = wirelessCameraCountByProject.get(project._id) || 0;
      const usernames = usernamesByProject.get(project._id) || [];
      const previousImageCount = lastProjectImageCounts.get(project._id) || 0;
      const imagesAddedSinceLastSnapshot = Math.max(0, imgStats.imageCount - previousImageCount);

      return {
        projectId: project._id,
        projectName: project.name,
        imageCount: imgStats.imageCount,
        imagesReviewed: imgStats.imagesReviewed,
        imagesNotReviewed: imgStats.imagesNotReviewed,
        cameraCount,
        wirelessCameraCount,
        userCount: usernames.length,
        usernames,
        imagesAddedSinceLastSnapshot,
      };
    });

    // 5. Build platform-level totals
    const totalImages = projectMetrics.reduce((sum, p) => sum + p.imageCount, 0);
    const totalImagesReviewed = projectMetrics.reduce((sum, p) => sum + p.imagesReviewed, 0);
    const totalImagesNotReviewed = projectMetrics.reduce((sum, p) => sum + p.imagesNotReviewed, 0);
    const totalCameras = projectMetrics.reduce((sum, p) => sum + p.cameraCount, 0);
    const totalWirelessCameras = projectMetrics.reduce((sum, p) => sum + p.wirelessCameraCount, 0);

    // Deduplicate users across all projects for the platform-level total
    const allUsers = new Set<string>();
    for (const usernames of usernamesByProject.values()) {
      for (const u of usernames) {
        allUsers.add(u);
      }
    }
    const totalUsers = allUsers.size;

    // 6. Insert the snapshot
    const snapshot = new PlatformStats({
      _id: new mongoose.Types.ObjectId(),
      snapshotDate: new Date(),
      platform: {
        totalProjects: projects.length,
        totalImages,
        totalImagesReviewed,
        totalImagesNotReviewed,
        totalUsers,
        totalCameras,
        totalWirelessCameras,
      },
      projects: projectMetrics,
    });

    await snapshot.save();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `computeStats: saved snapshot ${snapshot._id} at ${snapshot.snapshotDate} (took ${duration}s)`,
    );
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`computeStats: failed after ${duration}s`, err);
    throw err;
  }
}
