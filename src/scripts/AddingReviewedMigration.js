const { isImageReviewed } = require('../api/db/models/utils');

const MongoClient = require('mongodb').MongoClient;

async function updateImages() {
    const uri = 'server'; // Replace with your MongoDB connection string
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const collection = client.db('animl-dev').collection('images');

        let skip = 0;
        let limit = 1; // how many images to fetch at a time
        let count = collection.countDocuments();
        console.log('Total documents: ', count);
        let doneCount = 0

        while (skip < count) {
            const documents = await collection.find().skip(skip).limit(limit).toArray();
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
            await collection.bulkWrite(operations);
            skip += limit;
            doneCount += documents.length;
        }

        console.log('All documents updated successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.close();
    }
}

updateImages();