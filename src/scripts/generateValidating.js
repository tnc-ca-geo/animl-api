import { analysisConfig } from "./analysisConfig.js"
import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Image from '../../.build/api/db/schemas/Image.js';

export const generateValidationList = async (analysisConfig, predictedLabels) => {
  const { PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

  const config = await getConfig();
  console.log('Connecting to db...');
  await connectToDatabase(config);

  const validatingLabels = predictedLabels.reduce((acc, lbl) => {
    return { ...acc, [lbl]: [] }
  }, {});

  console.log('collecting images...');
  const images = await Image.aggregate([{
    $match: {
      projectId: PROJECT_ID,
      dateAdded: {
        $gte: new Date(START_DATE),
        $lte: new Date(END_DATE),
      },
      reviewed: true,
    },
  }]);

  console.log('building validation lists...');
  const validationLists = images.reduce((imgAcc, img) => {
    img.objects.forEach((obj) => {
      const mlLabel = obj.labels.find((lbl) => lbl.mlModel === ML_MODEL);
      if (!mlLabel) {
        return;
      }

      const validating = validatingLabels[mlLabel.labelId];

      if (!validating) {
        return;
      }

      const ids = obj.labels.reduce((acc, lbl) => {
        if (lbl.mlModel === 'megadetector') {
          return acc;
        }
        return acc.concat(lbl.labelId);
      }, []);

      validatingLabels[mlLabel.labelId] = new Set([...validating, ...ids]);
    })
    return imgAcc;
  }, validatingLabels);

  return validationLists;
}

// Example
console.log(generateValidationList(analysisConfig, ['rodent', 'skunk']));
