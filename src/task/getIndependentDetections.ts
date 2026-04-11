import { DateTime } from 'luxon';

import { ProjectModel } from '../api/db/models/Project.js';
import { buildPipeline, idMatch } from '../api/db/models/utils.js';
import { CameraConfigSchema, DeploymentSchema, FiltersSchema } from '../api/db/schemas/Project.js';

import type { AggregationLevel } from '../@types/graphql.js';
import { TaskInput } from '../api/db/models/Task.js';
import Image, { ImageSchema } from '../api/db/schemas/Image.js';
import { findRepresentativeLabel } from './utils.js';

type Task = TaskInput<{
  filters: FiltersSchema;
  aggregationLevel: AggregationLevel;
  independenceInterval: number;
}>;
export type IndependentDetectionsTask = TaskInput<{
  filters: FiltersSchema;
  aggregationLevel: 'independentDetection';
  independenceInterval: number;
}>;
export interface GetIndependentDetectionsOutput {
  detectionsCount: number;
  detectionsLevelStats: Record<string, number>;
  detectionsLevelStatsByDeployment: Record<string, Record<string, number>>;
}

type DetectionsTracker = {
  [key: string]: {
    lastSeen: DateTime;
    count: number;
  };
};

export default async function getIndependentDetectionStats(
  task: Task,
): Promise<GetIndependentDetectionsOutput> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  const project = await ProjectModel.queryById(context.user['curr_project']);
  const pipeline = buildPipeline(task.config.filters, context.user['curr_project']);
  const MAX_SEQUENCE_DELTA = task.config.independenceInterval * 60;

  const cameraConfigs = project.cameraConfigs;
  const deployments: Array<DeploymentSchema> = cameraConfigs.reduce(
    (deps: Array<DeploymentSchema>, config: CameraConfigSchema) => {
      return [...deps, ...config.deployments];
    },
    [],
  );

  const detectionsLevelStats: Record<string, number> = {};
  const detectionsLevelStatsByDeployment: Record<string, Record<string, number>> = {};

  for (const dep of deployments) {
    const depId = String(dep._id);
    const depPipeline = structuredClone(pipeline);
    depPipeline.push({
      $match: {
        deploymentId: dep._id,
      },
    });
    depPipeline.push({ $sort: { dateTimeOriginal: 1 } });

    const detections: DetectionsTracker = {};

    for await (const img of Image.aggregate<ImageSchema>(depPipeline)) {
      const imgDateCreated = DateTime.fromJSDate(img.dateTimeAdjusted);
      for (const obj of img.objects) {
        const representativeLabel = findRepresentativeLabel(obj);
        if (representativeLabel) {
          const projLabel = project.labels.find((lbl) =>
            idMatch(lbl._id, representativeLabel.labelId),
          );
          const labelName = projLabel?.name || 'ERROR FINDING LABEL';

          if (Object.prototype.hasOwnProperty.call(detections, labelName)) {
            const diff = detections[labelName].lastSeen.diff(imgDateCreated, 'seconds').toObject();
            const delta = Math.abs(diff.seconds || 0);

            if (delta > MAX_SEQUENCE_DELTA) {
              detections[labelName] = {
                lastSeen: imgDateCreated,
                count: detections[labelName].count + 1,
              };
            }
          } else {
            detections[labelName] = {
              lastSeen: imgDateCreated,
              count: 1,
            };
          }
        }
      }
    }

    for (const label of Object.keys(detections)) {
      const { count } = detections[label];

      if (Object.prototype.hasOwnProperty.call(detectionsLevelStats, label)) {
        detectionsLevelStats[label] = count + detectionsLevelStats[label];
      } else {
        detectionsLevelStats[label] = count;
      }

      // bucket by deployment
      if (!detectionsLevelStatsByDeployment[depId]) detectionsLevelStatsByDeployment[depId] = {};
      detectionsLevelStatsByDeployment[depId][label] =
        (detectionsLevelStatsByDeployment[depId][label] || 0) + count;
    }
  }

  const detectionsCount = Object.values(detectionsLevelStats).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    detectionsCount,
    detectionsLevelStats,
    detectionsLevelStatsByDeployment,
  };
}
