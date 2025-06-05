import { ProjectModel } from '../api/db/models/Project.js';
import { buildPipeline, idMatch } from '../api/db/models/utils.js';
import Image, { type ImageSchema } from '../api/db/schemas/Image.js';
import _ from 'lodash';
import { type TaskInput } from '../api/db/models/Task.js';
import { type FiltersSchema } from '../api/db/schemas/Project.js';
import { findRepresentativeLabel } from './utils.js';

export default async function (
  task: TaskInput<{ filters: FiltersSchema }>,
): Promise<GetStatsOutput> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  let imageCount = 0;
  let imagesReviewed = 0;
  let imagesNotReviewed = 0;
  let objectCount = 0;
  let objectsReviewed = 0;
  let objectsNotReviewed = 0;
  const imageReviewerList: Array<Reviewer> = [];
  const objectReviewerList: Array<Reviewer> = [];
  const objectLabelList: Record<string, number> = {};
  const imageLabelList: Record<string, number> = {};
  // NOTE: just curious how many images get touched
  // by more than one reviewer. can remove later
  let multiReviewerCount = 0;

  const project = await ProjectModel.queryById(context.user['curr_project']);
  const pipeline = buildPipeline(task.config.filters, context.user['curr_project']);
  console.log('GetStats pipeline:', pipeline);
  // stream in images from MongoDB
  for await (const img of Image.aggregate<ImageSchema>(pipeline)) {
    // increment imageCount
    imageCount++;

    // increment reviewedCount
    img.reviewed ? imagesReviewed++ : imagesNotReviewed++;

    // build reviwer list
    let imageReviewers = [];
    for (const obj of img.objects) {
      let objectReviewers = [];
      for (const lbl of obj.labels) {
        if (lbl.validation) {
          objectReviewers.push(lbl.validation.userId)
          imageReviewers.push(lbl.validation.userId)
        };
      }
      objectReviewers = _.uniq(objectReviewers);
      for (const userId of objectReviewers) {
        const usr = objectReviewerList.find((reviewer) => idMatch(reviewer.userId, userId!));
        !usr ? objectReviewerList.push({ userId: userId!, reviewedCount: 1 }) : usr.reviewedCount++;
      }
    }
    imageReviewers = _.uniq(imageReviewers);
    if (imageReviewers.length > 1) multiReviewerCount++;

    for (const userId of imageReviewers) {
      const usr = imageReviewerList.find((reviewer) => idMatch(reviewer.userId, userId!));
      !usr ? imageReviewerList.push({ userId: userId!, reviewedCount: 1 }) : usr.reviewedCount++;
    }

    // order reviewer list by reviewed count
    imageReviewerList.sort((a, b) => b.reviewedCount - a.reviewedCount);
    objectReviewerList.sort((a, b) => b.reviewedCount - a.reviewedCount);

    // build label list
    const imageLabels: string[] = [];
    for (const obj of img.objects) {
      objectCount++;
      obj.locked ? objectsReviewed++ : objectsNotReviewed++;

      const representativeLabel = findRepresentativeLabel(obj);
      if (representativeLabel) {
        const projLabel = project.labels.find((lbl) => idMatch(lbl._id, representativeLabel.labelId));
        const labelName = projLabel?.name || 'ERROR FINDING LABEL';
        objectLabelList[labelName] = Object.prototype.hasOwnProperty.call(objectLabelList, labelName)
          ? objectLabelList[labelName] + 1
          : 1;

        if (!imageLabels.includes(labelName)) {
          imageLabels.push(labelName);
        }
      }
    }

    // Build image label list
    for (const label of imageLabels) {
      imageLabelList[label] = Object.prototype.hasOwnProperty.call(imageLabelList, label)
        ? imageLabelList[label] + 1
        : 1;
    }
  }

  return {
    imageCount,
    imageReviewCount: { reviewed: imagesReviewed, notReviewed: imagesNotReviewed }, // TODO: Rename to imageReviewCount
    imageLabelList,
    objectCount,
    objectReviewCount: { reviewed: objectsReviewed, notReviewed: objectsNotReviewed },
    objectLabelList,
    imageReviewerList,
    objectReviewerList,
    multiReviewerCount
  };
}

interface GetStatsOutput {
  imageCount: number;
  imageReviewCount: { reviewed: number; notReviewed: number };
  objectCount: number;
  objectReviewCount: { reviewed: number; notReviewed: number };
  imageReviewerList: Reviewer[];
  objectReviewerList: Reviewer[];
  objectLabelList: Record<string, number>;
  imageLabelList: Record<string, number>;
  multiReviewerCount: number;
}

interface Reviewer {
  userId: string;
  reviewedCount: number;
}
