/*
 *  ML analysis config
 */

const analysisConfig = {
  ANALYSIS_DIR: '/analysis',
  PROJECT_ID: 'sci_biosecurity',
  START_DATE: '2023-4-28',
  END_DATE: '2024-5-29',
  ML_MODEL: 'mirav2', // first use of 'mirav2' was 2023-4-28
  SKIP_DEFAULT_DEPLOYMENT: true,
  TARGET_CLASSES: [
    // class naming convention: '<label.name>:<label._id>'
    {
      predicted: 'rodent:rodent',
      validation: [
        'rodent:rodent',
        'mouse:mouse',
        'rat:rat',
        'vole:4a6973cd-5666-4277-b2eb-292a688e96c0',
      ],
    },
    {
      predicted: 'skunk:skunk',
      validation: ['skunk:skunk', 'striped skunk:8b7de047-5622-481d-a591-331ce0b4ef04'],
    },
    { predicted: 'lizard:lizard', validation: ['lizard:lizard'] },
    { predicted: 'fox:fox', validation: ['fox:fox'] },
    {
      predicted: 'bird:bird',
      validation: ['bird:bird', 'scrub jay:731d97ef-aff7-4ffb-8f07-66a9f06dd686'],
    },
  ],
  // ML_MODEL: 'megadetector_v5a', // first use of 'megadetector_v5a' was 2023-07-29
  // TARGET_CLASSES: [
  //   {
  //     predicted: 'animal:1',
  //     validation: [], // special case: for animal, validation classes include any class that is not "person" or "vehicle"
  //   },
  //   {
  //     predicted: 'person:2',
  //     validation: ['person:2'],
  //   },
  //   {
  //     predicted: 'vehicle:3',
  //     validation: ['vehicle:3'],
  //   },
  // ],
  MAX_SEQUENCE_DELTA: 3, // maximum time (in seconds) between images to consider them part of same sequence
};

const reportColumns = [
  'cameraId',
  'deploymentName',
  'targetClass',
  'validationClasses',
  'allActuals',
  'truePositives',
  'falsePositives',
  'falseNegatives',
  'precision',
  'recall',
  'f1',
];

export { analysisConfig, reportColumns };
