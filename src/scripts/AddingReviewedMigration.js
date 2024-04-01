import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { isImageReviewed } from '../api/db/models/utils.js';
import Image from '../api/db/schemas/Image.js';

async function updateImages() {
    try {
        const config = await getConfig();
        const dbClient = await connectToDatabase(config);

        let skip = 0;
        let limit = 1; // how many images to fetch at a time
        let count = collection.countDocuments();
        console.log('Total documents: ', count);
        let doneCount = 0

        while (skip < count) {
            const documents = await Image.find().skip(skip).limit(limit).toArray();
            console.log('documents fetched: ', documents.length);
            const operations = []
            for (image in documents) {
                operations.push({
                    updateOne: {
                        filter: { _id: image._id },
                        update: { $set: { reviewed: isImageReviewed(image) } }
                    }
                });
            }
            await dbClient.bulkWrite(operations);
            skip += limit;
            doneCount += documents.length;
        }

        console.log('Documents updated successfully: ', doneCount);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        dbClient.connection.close();
    }
}

updateImages();