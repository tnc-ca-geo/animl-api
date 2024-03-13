import { ImageModel } from '../api/db/models/Image.js';

export default function(task) {
    return ImageModel.getStats(task.config);
}
