import mongoose from 'mongoose';
import { ForbiddenError, NotFoundError } from '../../errors.js';
import Image, { ImageSchema } from '../schemas/Image.js';
import { Context } from '../../handler.js';
import { idMatch } from './utils.js';

/** Identifies a single comment on a single image. */
export interface CommentRef {
  imageId: string;
  id: string;
}

/** Only project back the comments array - the rest of the image doc (objects, labels, etc.) can be large. */
export const COMMENTS_PROJECTION = { comments: 1 } as const;

/**
 * Matches the targeted comment and, for non-superusers, only if they authored it - so the
 * ownership check happens as part of the write rather than in a separate read before it.
 * Intended to be combined with an image scope filter.
 */
export function commentScope(
  input: CommentRef,
  context: Pick<Context, 'user'>,
): mongoose.FilterQuery<ImageSchema> {
  return {
    comments: {
      $elemMatch: {
        _id: input.id,
        ...(context.user['is_superuser'] ? {} : { author: context.user['cognito:username'] }),
      },
    },
  };
}

/**
 * Called when an atomic comment update matched nothing, to work out whether the comment
 * doesn't exist or just isn't the user's. Only runs on the failure path.
 */
export async function commentMutationError(
  imageFilter: mongoose.FilterQuery<ImageSchema>,
  input: CommentRef,
  action: 'delete' | 'edit',
): Promise<never> {
  const image = await Image.findOne(imageFilter, COMMENTS_PROJECTION);
  if (!image) throw new NotFoundError('Image not found');

  const comment = image.comments?.filter((c) => idMatch(c._id!, input.id))[0];
  if (!comment) throw new NotFoundError('Comment not found on image');

  throw new ForbiddenError(`Can only ${action} your own comments`);
}
