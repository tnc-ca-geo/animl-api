import _ from 'lodash';
import { DateTime } from 'luxon';
import { isFilterValid } from 'mongodb-query-parser';
import mongoose, { HydratedDocument, PipelineStage, Types, PipelineStage } from 'mongoose';
import { Config } from '../../../config/config.js';
import { User } from '../../auth/authorization.js';
import {
  AuthenticationError,
  DuplicateLabelError,
  ForbiddenError,
  NotFoundError,
} from '../../errors.js';
import Image, { ImageSchema } from '../schemas/Image.js';
import ImageAttempt from '../schemas/ImageAttempt.js';
import { CameraConfigSchema, DeploymentSchema, ProjectSchema } from '../schemas/Project.js';
import { LabelSchema } from '../schemas/shared/index.js';
import { WirelessCameraSchema } from '../schemas/WirelessCamera.js';
import type * as gql from '../../../@types/graphql.js';

// TODO: this file is getting unwieldy, break up

export function idMatch(
  idA: string | mongoose.Types.ObjectId,
  idB: string | mongoose.Types.ObjectId,
): boolean {
  return idA.toString() === idB.toString();
}

export function buildImgUrl(image: ImageSchema, config: Config, size = 'original') {
  const url = config['/IMAGES/URL'];
  const id = image._id;
  const ext = image.fileTypeExtension;
  return url + '/' + size + '/' + id + '-' + size + '.' + ext;
}

export function buildLabelPipeline(labels: string[]): PipelineStage[] {
  const pipeline: PipelineStage[] = [];

  // map over objects & labels and filter for first validated label
  pipeline.push({
    $set: {
      objects: {
        $map: {
          input: '$objects',
          as: 'obj',
          in: {
            $setField: {
              field: 'firstValidLabel',
              input: '$$obj',
              value: {
                $filter: {
                  input: '$$obj.labels',
                  as: 'label',
                  cond: { $eq: ['$$label.validation.validated', true] },
                  limit: 1,
                },
              },
            },
          },
        },
      },
    },
  });

  const labelsFilter: { $or: Record<string, any>[] } = {
    $or: [
      // has an object that is locked,
      // and its first validated label is included in labels filter
      {
        objects: {
          $elemMatch: {
            locked: true,
            'firstValidLabel.labelId': { $in: labels },
          },
        },
      },

      // has an object is not locked, but it has label that is
      // not-invalidated and included in filters
      {
        objects: {
          $elemMatch: {
            locked: false,
            labels: {
              $elemMatch: {
                'validation.validated': { $not: { $eq: false } },
                labelId: { $in: labels },
              },
            },
          },
        },
      },
    ],
  };

  // if labels includes "none", also return images with no objects
  if (labels.includes('none')) {
    const noObjectsFilter = {
      $or: [
        // return images w/ no objects,
        { objects: { $size: 0 } },
        // or images in which all labels of all objects have been invalidated
        {
          objects: {
            $not: {
              $elemMatch: {
                labels: {
                  $elemMatch: {
                    $or: [{ validation: null }, { 'validation.validated': true }],
                  },
                },
              },
            },
          },
        },
      ],
    };
    labelsFilter.$or.push(noObjectsFilter);
  }

  pipeline.push({ $match: labelsFilter });

  return pipeline;
}

export function buildPipeline(
  {
    cameras,
    deployments,
    createdStart,
    createdEnd,
    addedStart,
    addedEnd,
    labels,
    reviewed,
    custom,
  }: gql.Filters,
  projectId?: string,
): PipelineStage[] {
  const pipeline: PipelineStage[] = [];

  // match current project
  if (projectId) {
    pipeline.push({ $match: { projectId: projectId } });
  }

  // match cameras filter
  if (cameras) {
    pipeline.push({ $match: { cameraId: { $in: cameras } } });
  }

  // match deployments filter
  if (deployments) {
    // cast string id to ObjectId
    const deploymentIds = deployments.map((depString) => new mongoose.Types.ObjectId(depString));
    pipeline.push({ $match: { deploymentId: { $in: deploymentIds } } });
  }

  // match date created filter
  if (createdStart || createdEnd) {
    pipeline.push({
      $match: {
        dateTimeOriginal: {
          ...(createdStart && { $gte: createdStart.toJSDate() }),
          ...(createdEnd && { $lt: createdEnd.toJSDate() }),
        },
      },
    });
  }

  // match date added filter
  if (addedStart || addedEnd) {
    console.log('adding date added filter');
    pipeline.push({
      $match: {
        dateAdded: {
          ...(addedStart && { $gte: addedStart.toJSDate() }),
          ...(addedEnd && { $lt: addedEnd.toJSDate() }),
        },
      },
    });
  }
  
  // match reviewedFilter
  if (reviewed !== null) {
    pipeline.push({
      $match: {
        reviewed: reviewed,
      },
    });
  }

  // match labels filter
  if (labels) {
    pipeline.push(...buildLabelPipeline(labels));
  }

  // match custom filter
  if (custom) {
    pipeline.push({ $match: isFilterValid(custom) });
  }

  console.log('utils.buildPipeline() - pipeline: ', JSON.stringify(pipeline));
  return pipeline;
}

export function sanitizeMetadata(md: ImageMetadata): ImageMetadata {
  const sanitized: Record<string, any> = {};
  // If second char in key is uppercase,
  // assume it's an acronym (like GPSLatitude) & leave it,
  // else camel case
  for (const key in md) {
    // eslint-disable-next-line eqeqeq
    const newKey = !(key.charAt(1) == key.charAt(1).toUpperCase())
      ? key.charAt(0).toLowerCase() + key.slice(1)
      : key;
    sanitized[newKey] = md[key as keyof ImageMetadata];
  }

  // TODO: I don't love that this is here. We can't parse the dateTimeOriginal
  // in the GraphQL layer's Date Scalar b/c the input type-def for createImage
  // is a JSONObject of unknown shape. So the parsing has to live in the model
  // layer somewhere, I'm just not sure this is the best place for it.
  if (sanitized.dateTimeOriginal && (sanitized.dateTimeOriginal as unknown) !== 'unknown') {
    const dto = DateTime.fromISO(sanitized.dateTimeOriginal as unknown as string);
    sanitized.dateTimeOriginal = dto;
  }

  return sanitized as ImageMetadata;
}

export function createImageAttemptRecord(md: ImageMetadata) {
  console.log('creating ImageAttempt record with metadata: ', md);
  return new ImageAttempt({
    _id: md.imageId,
    projectId: md.projectId,
    batchId: md.batchId,
    metadata: {
      _id: md.imageId,
      bucket: md.prodBucket,
      batchId: md.batchId,
      dateAdded: DateTime.now(),
      cameraId: md.serialNumber,
      ...(md.fileTypeExtension && { fileTypeExtension: md.fileTypeExtension }),
      ...(md.path && { path: md.path }),
      ...(md.dateTimeOriginal && { dateTimeOriginal: md.dateTimeOriginal }),
      ...(md.timezone && { timezone: md.timezone }),
      ...(md.make && { make: md.make }),
      ...(md.model && { model: md.model }),
      ...(md.fileName && { originalFileName: md.fileName }),
      ...(md.imageWidth && { imageWidth: md.imageWidth }),
      ...(md.imageHeight && { imageHeight: md.imageHeight }),
      ...(md.imageBytes && { imageBytes: md.imageBytes }),
      ...(md.MIMEType && { mimeType: md.MIMEType }),
    },
  });
}

// Unpack user-set exif tags
export function getUserSetData(input: ImageMetadata) {
  const userDataMap: Record<string, (m: ImageMetadata) => null | Record<string, string>> = {
    BuckEyeCam: (input) => {
      if (!input.comment) {
        return null;
      }
      const userData: Record<string, string> = {};
      input.comment.split('\n').forEach((item) => {
        if (item.includes('TEXT1') || item.includes('TEXT2')) {
          userData[item.split('=')[0]] = item.split('=')[1];
        }
      });
      return userData;
    },
    RidgeTec: (input) => {
      if (!input.userComment) {
        return null;
      }
      const userData: Record<string, string> = {};
      input.userComment.split('\n').forEach((item) => {
        if (item.includes('AccountId')) {
          userData[item.split('=')[0]] = item.split('=')[1];
        }
      });
      return userData;
    },
    RECONYX: (input) => {
      if (!input.userLabel) {
        return null;
      }
      return {
        userLabel: input.userLabel,
      };
    },
  };

  return input.make && userDataMap[input.make] ? userDataMap[input.make](input) : null;
}

// Parse trigger source (e.g. burst, timelapse, manual, PIR)
// TODO: possibly combine with getUserSetData?
export function getTriggerSource(input: ImageMetadata) {
  const userDataMap: Record<string, (m: ImageMetadata) => null | string> = {
    BuckEyeCam: (input) => {
      if (!input.comment) {
        return null;
      }
      let triggerSource = null;
      input.comment.split('\n').forEach((item) => {
        const [key, value] = item.split('=');
        if (key === 'SOURCE') {
          triggerSource = value;
        }
      });
      return triggerSource;
    },
    RidgeTec: () => null,
    RECONYX: () => null,
  };

  return input.make && userDataMap[input.make] ? userDataMap[input.make](input) : null;
}

// Parse string coordinates to decimal degrees
// input e.g. - `34 deg 6' 25.59" N`
export function parseCoordinates(md: ImageMetadata) {
  function parse(stringCoord: string) {
    let deg, min, sec;
    // eslint-disable-next-line prefer-const
    [deg, min, sec] = stringCoord.match(/[+-]?(\d*\.)?\d+/g)!;
    const cardinal = stringCoord.match(/[N|S|E|W]$/g)![0];
    const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    return cardinal === 'S' || cardinal === 'W' ? degrees * -1 : degrees;
  }

  if (!md.GPSLongitude || !md.GPSLatitude) {
    return null;
  } else if (typeof md.GPSLongitude === 'string') {
    return [parse(md.GPSLongitude), parse(md.GPSLatitude)];
  } else {
    return [md.GPSLongitude, md.GPSLatitude];
  }
}

// Map image metadata to image schema
export function createImageRecord(md: ImageMetadata) {
  console.log('creating ImageRecord with metadata: ', md);
  const coords = parseCoordinates(md);
  const userSetData = getUserSetData(md);
  const triggerSource = getTriggerSource(md);

  const location = coords && {
    geometry: { type: 'Point', coordinates: coords },
    ...(md.GPSAltitude && { altitude: md.GPSAltitude }),
  };

  return new Image({
    _id: md.imageId,
    batchId: md.batchId,
    bucket: md.prodBucket,
    fileTypeExtension: md.fileTypeExtension,
    dateAdded: DateTime.now(),
    dateTimeOriginal: md.dateTimeOriginal,
    timezone: md.timezone,
    cameraId: md.serialNumber,
    make: md.make,
    deploymentId: md.deploymentId,
    projectId: md.projectId,
    ...(md.model && { model: md.model }),
    ...(md.fileName && { originalFileName: md.fileName }),
    ...(md.path && { path: md.path }),
    ...(md.imageWidth && { imageWidth: md.imageWidth }),
    ...(md.imageHeight && { imageHeight: md.imageHeight }),
    ...(md.imageBytes && { imageBytes: md.imageBytes }),
    ...(md.MIMEType && { mimeType: md.MIMEType }),
    ...(userSetData && { userSetData: userSetData }),
    ...(location && { location: location }),
    ...(triggerSource && { triggerSource: triggerSource }),
  });
}

export function isLabelDupe(
  image: ImageSchema,
  newLabel: {
    labelId: string;
    conf?: Maybe<number>;
    bbox: number[];
    mlModel?: string;
    mlModelVersion?: string;
  },
): boolean {
  const labels = image.objects.reduce((labels, object) => {
    object.labels.forEach((label) => labels.push(label));
    return labels;
  }, [] as LabelSchema[]);

  for (const label of labels) {
    const mlModelMatch =
      newLabel.mlModel && label.mlModel && idMatch(newLabel.mlModel, label.mlModel);

    const mlModelVerMatch =
      newLabel.mlModelVersion &&
      label.mlModelVersion &&
      newLabel.mlModelVersion.toString() === label.mlModelVersion.toString();

    const labelMatch = newLabel.labelId === label.labelId;
    const confMatch = newLabel.conf === label.conf;
    const bboxMatch = _.isEqual(newLabel.bbox, label.bbox);

    if (mlModelMatch && mlModelVerMatch && labelMatch && confMatch && bboxMatch) {
      return true;
    }
  }

  return false;
}

export function reviewerLabelRecord(
  project: ProjectSchema,
  image: ImageSchema,
  label: LabelInput,
): LabelRecord {
  label.type = 'manual';
  const labelRecord = createLabelRecord(label, label.userId!);

  // Check if Label Exists on Project and if not throw an error
  if (
    !project.labels.some((l) => {
      return idMatch(l._id, labelRecord.labelId);
    })
  ) {
    throw new NotFoundError('A label with that ID does not exist in this project');
  } else if (
    !project.labels.some((l) => {
      return idMatch(l._id, labelRecord.labelId) && l.reviewerEnabled;
    })
  ) {
    throw new ForbiddenError('This label is currently disabled');
  }

  if (isLabelDupe(image, labelRecord)) throw new DuplicateLabelError();

  return labelRecord;
}

// TODO: accommodate users as label authors as well as models
export function createLabelRecord(input: LabelInput, authorId: string): LabelRecord {
  const { _id, type, labelId, conf, bbox, mlModelVersion, validation } = input;
  return {
    ...(_id && { _id }),
    type,
    labelId,
    conf,
    bbox,
    labeledDate: DateTime.now(),
    ...(authorId && type === 'ml' && { mlModel: authorId }),
    ...(authorId && type === 'ml' && { mlModelVersion }),
    ...(authorId && type === 'manual' && { userId: authorId }),
    ...(authorId && type === 'manual' && { validation }),
  };
}

// TODO: consider calling this isAuthorized() ?
export function hasRole(user: User, targetRoles: string[] = []) {
  const hasAuthorizedRole =
    user['curr_project_roles'] &&
    user['curr_project_roles'].some((role) => targetRoles.includes(role));
  return user['is_superuser'] || hasAuthorizedRole;
}

// TODO: accommodate user-created deployments with no startDate?
export function findDeployment(
  img: ImageMetadata,
  camConfig: CameraConfigSchema,
  projTimeZone: string,
) {
  console.log('finding deployment for img: ', img);
  // find the deployment that's start date is closest to (but preceeds)
  // the image's created date

  // NOTE: we do not know the timezone for the image yet b/c we pull the
  // timezone from the deployment record, which we are in the proess of finding.
  // So Luxon will assume imgCreated to be in UTC+0 by default (but it likely isn't)
  // and we'll be comparing that to the deployment's start date,
  // which is stored in UTC+0...

  // current (imperfect) solution is be to use the project's default timezone
  // and assume the image is in that timezone. That would mean there's still
  // a chance the correct deployment we want to associate the image with
  // is in a different timezone than the project default and it could get
  // paired to the wrong deployment.

  // It would be a pretty small chance though:
  // the time between the correct deployment's start date and the image's real
  // created date would have to be less than the # of hours off the project's
  // default timezone is from the image's actual (but unknown) timezone. For example
  // if the project's defaut timzeone was UTC+0 and the image's real timezone
  // was UTC-7, essentially we'd be treating the image like it was created 7 hours
  // later than it actually was, which means if there there is a more recent deployment
  // than the one the image should fall in, and the image was created within
  // 7 hours of that more recent deployment's start date, it would mistakenly
  // get associated with that more recent deployment

  let imgCreated = !DateTime.isDateTime(img.dateTimeOriginal)
    ? DateTime.fromISO(img.dateTimeOriginal.toString())
    : img.dateTimeOriginal;
  imgCreated = imgCreated.setZone(projTimeZone, { keepLocalTime: true });
  const defaultDep = camConfig.deployments.find((dep) => dep.name === 'default');

  let mostRecentDep = null;
  let shortestInterval = null;
  for (const dep of camConfig.deployments) {
    if (dep.name !== 'default') {
      const depStart = DateTime.fromJSDate(dep.startDate as any as Date);
      const timeDiff = imgCreated.diff(depStart).toObject().milliseconds;
      // if time elapsed is negative,
      // image was taken before the deployment start date
      if ((shortestInterval === null || shortestInterval! > timeDiff!) && timeDiff! >= 0) {
        mostRecentDep = dep;
        shortestInterval = timeDiff;
      }
    }
  }

  return mostRecentDep || defaultDep;
}

export function mapImgToDep(
  img: ImageMetadata,
  camConfig: CameraConfigSchema,
  projTimeZone: string,
) {
  if (camConfig.deployments.length === 0) {
    const err = new NotFoundError('Camera config has no deployments');
    throw err;
  }

  return camConfig.deployments.length === 1
    ? camConfig.deployments[0]
    : findDeployment(img, camConfig, projTimeZone)!;
}

export function sortDeps(
  deps: mongoose.Types.DocumentArray<DeploymentSchema> | DeploymentSchema[],
): mongoose.Types.DocumentArray<DeploymentSchema> {
  return deps.toSorted((a, b) =>
    a.name === 'default'
      ? // Default first
        -1
      : // Otherwise, order by date
        DateTime.fromJSDate(a.startDate!)
          .diff(DateTime.fromJSDate(b.startDate!))
          .as('milliseconds'),
  ) as mongoose.Types.DocumentArray<DeploymentSchema>;
}

export function findActiveProjReg(camera: WirelessCameraSchema) {
  const activeProjReg = camera.projRegistrations.find((pr) => pr.active);
  if (!activeProjReg) {
    const err = new NotFoundError("Can't find active project registration on camera");
    throw err;
  }
  return activeProjReg.projectId;
}

export function isImageReviewed(image: ImageSchema) {
  // images are considered reviewed if they:
  // have objects,
  // all objects are locked,
  // AND there are no locked objects with all invalidated labels
  const hasObjs = image.objects.length > 0;
  const hasUnlockedObjs = image.objects.some((obj) => obj.locked === false);
  const hasAllInvalidatedLabels = !image.objects.some((obj) =>
    obj.labels.some((lbl) => !lbl.validation || lbl.validation.validated),
  );
  return hasObjs && !hasUnlockedObjs && !hasAllInvalidatedLabels;
}

/**
 * Decorator to check if user has role before calling underlying method
 * @param roles
 * @returns
 */
export function roleCheck(roles: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      if (!hasRole((this as BaseAuthedModel).user, roles)) {
        throw new ForbiddenError();
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export class BaseAuthedModel {
  user: User;
  constructor(user: User | null) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }
}

export type MethodParams<T> = T extends (...args: infer P) => any ? P : never;

export type Pagination<T = {}> = T & {
  paginatedField?: Maybe<string>;
  sortAscending?: Maybe<boolean>;
  limit?: Maybe<number>;
  next?: Maybe<string>;
  previous?: Maybe<string>;
};

export interface GenericResponse {
  isOk: boolean;
}

// NOTE: This interface was reverse-engineered by looking at the properties that were
// accessed on this object within this file. It is not authoratative and may be incomplete.
// export interface ImageMetadata extends WithRequired<ImageMetadataSchema, 'dateTimeOriginal'> {
export interface ImageMetadata {
  dateTimeOriginal: Date | DateTime<true> | DateTime<false>;
  imageId: string;
  prodBucket: string;
  serialNumber: string; // Used as cameraId
  deploymentId: Types.ObjectId;
  projectId: string;
  fileName?: string; // Used as originalFileName, optional
  MIMEType?: string; // Optional, note the case sensitivity

  comment?: string;
  userComment?: string;
  userLabel?: string;

  GPSLongitude?: string;
  GPSLatitude?: string;
  GPSAltitude?: string;

  hash: string;
  errors?: Array<Error | string>;

  batchId: string;
  fileTypeExtension: string;
  timezone: string;
  make: string;
  model?: string;
  path?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageBytes?: number;
}
type LabelInput = {
  _id?: Maybe<string>;
  userId?: Maybe<string>;
  type?: 'ml' | 'manual';
  labelId: string;
  conf?: Maybe<number>;
  bbox: number[];
  mlModelVersion?: string;
  validation?: any; // Replace `any` with a more specific type if applicable
};
export interface LabelRecord {
  _id?: string;
  type?: string;
  labelId: string;
  conf?: Maybe<number>;
  bbox: number[];
  labeledDate: DateTime;
  mlModel?: string;
  mlModelVersion?: string;
  userId?: string;
  validation?: Maybe<{ validated: boolean }>;
}
