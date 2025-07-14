import _ from 'lodash';
import { DateTime } from 'luxon';

import { ProjectModel } from '../api/db/models/Project.js';
import { buildPipeline, idMatch } from '../api/db/models/utils.js';
import { findRepresentativeLabel } from './utils.js';
import { TaskInput } from '../api/db/models/Task.js';
import { CameraConfigSchema, DeploymentSchema, FiltersSchema } from '../api/db/schemas/Project.js';
import { AggregationLevel } from '../@types/graphql.js';
import Image, { ImageSchema } from '../api/db/schemas/Image.js';


const MAX_SEQUENCE_DELTA = 2;

type Task = TaskInput<{ filters: FiltersSchema, aggregationLevel: AggregationLevel }>
export type BurstsTask = TaskInput<{ filters: FiltersSchema, aggregationLevel: AggregationLevel.Burst }>;
export interface GetBurstOutput {
  burstCount: number;
  burstLabelList: Record<string, number>;
}

export default async function getBurstStats(task: Task): Promise<GetBurstOutput> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  const project = await ProjectModel.queryById(context.user['curr_project']);
  const pipeline = buildPipeline(task.config.filters, context.user['curr_project']);

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

  let burstCount = 0;
  const burstLabelList: Record<string, number> = {};

  const processBurst = (sequence: ImageSchema[]) => {
    burstCount++;

    const sequenceLabels: string[] = [];

    for (const img of sequence) {
      for (const obj of img.objects) {
        const representativeLabel = findRepresentativeLabel(obj);
        if (representativeLabel) {
          const projLabel = project.labels.find((lbl) => idMatch(lbl._id, representativeLabel.labelId));
          const labelName = projLabel?.name || 'ERROR FINDING LABEL';
          if (!sequenceLabels.includes(labelName)) {
            sequenceLabels.push(labelName);
          }
        }
      }
    }

    for (const label of sequenceLabels) {
      burstLabelList[label] = Object.prototype.hasOwnProperty.call(burstLabelList, label)
        ? burstLabelList[label] + 1
        : 1;
    }
  };

  for (const dep of deployments) {
    const depPipeline = structuredClone(pipeline);
    depPipeline.push({
      $match:{
        deploymentId: dep._id,
      }
    });

    let sequence: ImageSchema[] = [];

    for await (const img of Image.aggregate(depPipeline)) {
      if (sequence.length === 0) {
        sequence.push(img);
        continue;
      }

      const lastImg = sequence[sequence.length - 1];
      const imgDateAdded = DateTime.fromJSDate(img.dateTimeOriginal);
      const lastImgDateAdded = DateTime.fromJSDate(lastImg.dateTimeOriginal);
      const diff = lastImgDateAdded.diff(imgDateAdded, 'seconds').toObject();
      const delta = Math.abs(diff.seconds || 0);

      // if the delta between the last image and the current image is less than the max sequence delta,
      if (delta <= MAX_SEQUENCE_DELTA) {
        // image belongs to current sequence
        sequence.push(img);
      } else {
        // found a gap,
        processBurst(sequence);
        sequence = [img];
      }
    }
    if (sequence.length > 0) {
      processBurst(sequence);
    }
  }

  return {
    burstCount,
    burstLabelList
  };
}
