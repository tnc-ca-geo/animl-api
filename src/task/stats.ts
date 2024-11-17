import { ProjectModel } from '../api/db/models/Project.js';
import { buildPipeline, idMatch } from '../api/db/models/utils.js';
import Image, { type ImageSchema } from '../api/db/schemas/Image.js';
import _ from 'lodash';
import { type TaskInput } from '../api/db/models/Task.js';
import { type FiltersSchema } from '../api/db/schemas/Project.js';

export default async function (task: TaskInput<{ filters: FiltersSchema }>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  let imageCount = 0;
  let reviewed = 0;
  let notReviewed = 0;
  const reviewerList: Array<Reviewer> = [];
  const labelList: Record<string, number> = {};
  // NOTE: just curious how many images get touched
  // by more than one reviewer. can remove later
  let multiReviewerCount = 0;

  const project = await ProjectModel.queryById(context.user['curr_project']);
  const pipeline = buildPipeline(task.config.filters, context.user['curr_project']);

  // stream in images from MongoDB
  for await (const img of Image.aggregate<ImageSchema>(pipeline)) {
    // increment imageCount
    imageCount++;

    // increment reviewedCount
    img.reviewed ? reviewed++ : notReviewed++;

    // build reviwer list
    let reviewers = [];
    for (const obj of img.objects) {
      for (const lbl of obj.labels) {
        if (lbl.validation) reviewers.push(lbl.validation.userId);
      }
    }
    reviewers = _.uniq(reviewers);
    if (reviewers.length > 1) multiReviewerCount++;

    for (const userId of reviewers) {
      const usr = reviewerList.find((reviewer) => idMatch(reviewer.userId, userId!));
      !usr ? reviewerList.push({ userId: userId!, reviewedCount: 1 }) : usr.reviewedCount++;
    }

    // order reviewer list by reviewed count
    reviewerList.sort((a, b) => b.reviewedCount - a.reviewedCount);

    // build label list
    for (const obj of img.objects) {
      if (obj.locked) {
        const firstValidLabel = obj.labels.find(
          (label) => label.validation && label.validation.validated,
        );
        if (firstValidLabel) {
          const projLabel = project.labels.find((lbl) => idMatch(lbl._id, firstValidLabel.labelId));
          const labelName = projLabel?.name || 'ERROR FINDING LABEL';
          labelList[labelName] = Object.prototype.hasOwnProperty.call(labelList, labelName)
            ? labelList[labelName] + 1
            : 1;
        }
      }
    }
  }

  return {
    imageCount,
    reviewedCount: { reviewed, notReviewed },
    reviewerList,
    labelList,
    multiReviewerCount,
  };
}

interface Reviewer {
  userId: string;
  reviewedCount: number;
}
