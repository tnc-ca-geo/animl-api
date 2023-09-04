import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const Schema = mongoose.Schema;

const ImageErrorSchema = new Schema({
  _id: {
    type: String,
    required: true,
    default: randomUUID,
    index: true
  },  /* _id is name in_snake_case */
  image: {
    type: String,
    index: true
  },
  batch: {
    type: String,
    index: true
  },
  created: {
    type: Date,
    default: Date.now,
    required: true
  },
  path: {
    type: String
  },
  error: {
    type: String,
    required: true
  }
});

ImageErrorSchema.on('index', (e) => {
  console.log('ImageError Indexing Error', e);
});

const ImageError = mongoose.model('ImageError', ImageErrorSchema);

export {
  ImageErrorSchema,
  ImageError
};
