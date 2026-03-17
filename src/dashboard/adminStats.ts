import mongoose from 'mongoose';
import Cognito from '@aws-sdk/client-cognito-identity-provider';
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

/**
 * Count unique users across all Cognito groups for each project.
 * Returns a map of projectId -> unique user count.
 */
async function getUserCountsByProject(
  projectIds: string[],
  config: Config,
): Promise<Map<string, number>> {
  const cognito = new Cognito.CognitoIdentityProviderClient({
    region: process.env.REGION,
  });
  const userPoolId = config['/APPLICATION/COGNITO/USERPOOLID'];
  const counts = new Map<string, number>();

  for (const projectId of projectIds) {
    const uniqueUsers = new Set<string>();

    for (const role of ['manager', 'observer', 'member']) {
      const groupName = `animl/${projectId}/project_${role}`;
      try {
        let nextToken: string | undefined;
        do {
          const res = await cognito.send(
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

    counts.set(projectId, uniqueUsers.size);
  }

  return counts;
}

/**
 * Count the total number of unique users across ALL projects.
 */
async function getTotalUserCount(config: Config): Promise<number> {
  const cognito = new Cognito.CognitoIdentityProviderClient({
    region: process.env.REGION,
  });
  const userPoolId = config['/APPLICATION/COGNITO/USERPOOLID'];
  const uniqueUsers = new Set<string>();

  let paginationToken: string | undefined;
  do {
    const res = await cognito.send(
      new Cognito.ListUsersCommand({
        Limit: 60,
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
      }),
    );
    for (const user of res.Users || []) {
      if (user.Username) uniqueUsers.add(user.Username);
    }
    paginationToken = res.PaginationToken;
  } while (paginationToken);

  return uniqueUsers.size;
}

/**
 * Scheduled Lambda handler that computes platform-wide and per-project metrics
 * and stores a snapshot in the PlatformStats collection.
 *
 * Triggered weekly by EventBridge cron rule.
 */
export async function computeStats(): Promise<void> {
  console.log('computeStats: starting platform stats computation');
  const config = await getConfig();
  await connectToDatabase(config);

  // 1. Get all projects
  const projects = await Project.find({}).lean();
  const projectIds = projects.map((p) => p._id);
  console.log(`computeStats: found ${projects.length} projects`);

  // 2. Aggregate image stats per project
  const imageStatsByProject: ProjectImageStats[] = await Image.aggregate([
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
  ]);
  console.log(`computeStats: aggregated image stats for ${imageStatsByProject.length} projects`);

  const imageStatsMap = new Map(imageStatsByProject.map((s) => [s._id, s]));

  // 3. Count total wireless cameras
  const totalCameras = await WirelessCamera.countDocuments();
  console.log(`computeStats: total wireless cameras: ${totalCameras}`);

  // 4. Get user counts (total and per-project)
  const totalUsers = await getTotalUserCount(config);
  const userCountsByProject = await getUserCountsByProject(projectIds, config);
  console.log(`computeStats: total users: ${totalUsers}`);

  // 5. Get the previous snapshot to compute imagesAddedSinceLastSnapshot
  const lastSnapshot = await PlatformStats.findOne().sort({ snapshotDate: -1 }).lean();
  const lastProjectImageCounts = new Map<string, number>();
  if (lastSnapshot) {
    for (const proj of lastSnapshot.projects) {
      lastProjectImageCounts.set(proj.projectId, proj.imageCount);
    }
  }

  // 6. Build per-project metrics
  const projectMetrics = projects.map((project) => {
    const imgStats = imageStatsMap.get(project._id) || {
      imageCount: 0,
      imagesReviewed: 0,
      imagesNotReviewed: 0,
    };
    const cameraCount = project.cameraConfigs?.length || 0;
    const userCount = userCountsByProject.get(project._id) || 0;
    const previousImageCount = lastProjectImageCounts.get(project._id) || 0;
    const imagesAddedSinceLastSnapshot = Math.max(0, imgStats.imageCount - previousImageCount);

    return {
      projectId: project._id,
      projectName: project.name,
      imageCount: imgStats.imageCount,
      imagesReviewed: imgStats.imagesReviewed,
      imagesNotReviewed: imgStats.imagesNotReviewed,
      cameraCount,
      userCount,
      imagesAddedSinceLastSnapshot,
    };
  });

  // 7. Build platform-level totals
  const totalImages = projectMetrics.reduce((sum, p) => sum + p.imageCount, 0);
  const totalImagesReviewed = projectMetrics.reduce((sum, p) => sum + p.imagesReviewed, 0);
  const totalImagesNotReviewed = projectMetrics.reduce((sum, p) => sum + p.imagesNotReviewed, 0);

  // 8. Insert the snapshot
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
    },
    projects: projectMetrics,
  });

  await snapshot.save();
  console.log(`computeStats: saved snapshot ${snapshot._id} at ${snapshot.snapshotDate}`);
}
