import { DateTime } from 'luxon';

import { ProjectModel } from '../api/db/models/Project.js';
import { buildPipeline, idMatch } from '../api/db/models/utils.js';
import { CameraConfigSchema, DeploymentSchema, FiltersSchema } from '../api/db/schemas/Project.js';

import { AggregationLevel } from "../@types/graphql.js";
import { TaskInput } from "../api/db/models/Task.js";
import Image, { ImageSchema } from '../api/db/schemas/Image.js';
import { findRepresentativeLabel } from './utils.js';


type Task = TaskInput<{
  filters: FiltersSchema,
  aggregationLevel: AggregationLevel,
  independenceInterval: number,
}>
export type IndependentDetectionsTask = TaskInput<{
  filters: FiltersSchema,
  aggregationLevel: AggregationLevel.IndependentDetection,
  independenceInterval: number
}>;
export interface GetIndependentDetectionsOutput {
  detectionsCount: number;
  detectionsLabelList: Record<string, number>;
}

type DetectionsTracker = {
  [key: string]: {
    lastSeen: DateTime;
    count: number;
  }
}

export default async function getIndependentDetectionStats(task: Task): Promise<GetIndependentDetectionsOutput> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  const project = await ProjectModel.queryById(context.user['curr_project']);
  const pipeline = buildPipeline(task.config.filters, context.user['curr_project']);
  const MAX_SEQUENCE_DELTA = task.config.independenceInterval * 60;

  const cameraConfigs = project.cameraConfigs;
  const deployments: Array<DeploymentSchema> = cameraConfigs.reduce(
    (
      deps: Array<DeploymentSchema>,
      config: CameraConfigSchema
    ) => {
      return [...deps, ...config.deployments];
    },
    []
  );

  const detectionsLabelList: Record<string, number> = {};

  for (const dep of deployments) {
    const depPipeline = structuredClone(pipeline);
    depPipeline.push({
      $match:{
        deploymentId: dep._id,
      }
    });
    depPipeline.push({ $sort: { dateTimeOriginal: 1 } });

    const detections: DetectionsTracker = {};

    for await (const img of Image.aggregate<ImageSchema>(depPipeline)) {
      const imgDateCreated = DateTime.fromJSDate(img.dateTimeAdjusted);
      for (const obj of img.objects) {
        const representativeLabel = findRepresentativeLabel(obj);
        if (representativeLabel) {
          const projLabel = project.labels.find((lbl) => idMatch(lbl._id, representativeLabel.labelId));
          const labelName = projLabel?.name || 'ERROR FINDING LABEL';

          if (Object.prototype.hasOwnProperty.call(detections, labelName)) {
            const diff = detections[labelName].lastSeen.diff(imgDateCreated, 'seconds').toObject();
            const delta = Math.abs(diff.seconds || 0);

            if (delta > MAX_SEQUENCE_DELTA) {
              detections[labelName] = {
                lastSeen: imgDateCreated,
                count: detections[labelName].count + 1
              }
            }
          } else {
            detections[labelName] = {
              lastSeen: imgDateCreated,
              count: 1
            }
          }
        }
      }
    }

    for (const label of Object.keys(detections)) {
      const { count } = detections[label];

      if (Object.prototype.hasOwnProperty.call(detectionsLabelList, label)) {
        detectionsLabelList[label] = count + detectionsLabelList[label];
      } else {
        detectionsLabelList[label] = count;
      }
    }
  }

  const detectionsCount = Object.values(detectionsLabelList).reduce((sum, value) => sum + value, 0);

  return {
    detectionsCount,
    detectionsLabelList
  }
}
