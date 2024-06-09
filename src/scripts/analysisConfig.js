/*
 *  analysis config
 */

const analysisConfig = {
  ANALYSIS_DIR: '/analysis',
  PROJECT_ID: 'catalina', //'sci_biosecurity',
  START_DATE: '2023-4-26',
  END_DATE: '2024-5-29',
  ML_MODEL: 'mirav2',
  TARGET_CLASSES: [
    {
      predicted_id: 'rodent',
      validation_ids: ['rodent', 'mouse', 'rat', '4a6973cd-5666-4277-b2eb-292a688e96c0'],
    }, // vole
    { predicted_id: 'skunk', validation_ids: ['skunk', '8b7de047-5622-481d-a591-331ce0b4ef04'] }, // 'striped skunk'
    { predicted_id: 'lizard', validation_ids: ['lizard'] },
    { predicted_id: 'fox', validation_ids: ['fox'] },
    { predicted_id: 'bird', validation_ids: ['bird', '731d97ef-aff7-4ffb-8f07-66a9f06dd686'] }, // scrub jay
  ],
};

const reportColumns = [
  'cameraId',
  'deploymentName',
  'targetClass',
  'validationClasses',
  'falsePositives',
  'truePositives',
  'falseNegatives',
  'precision',
  'recall',
  'f1',
];

export { analysisConfig, reportColumns };
