import test from 'tape';
import { processSequence } from '../analyzeMLSequenceLevelWithTaxonomy.js';

// Mock data constants
const ML_MODEL = 'speciesnet-classifier';
const TARGET_CLASS = 'rodent:90d950db-2106-4bd9-a4c1-777604c3eada';
const DESCENDANT_CLASS = 'brown rat:ff803ff7-ed2b-4520-9304-99b408657f47';

const DEPLOYMENT = {
  _id: 'test-deployment-id',
  name: 'test-deployment'
};

const ML_LABELS = [{
  targetClass: TARGET_CLASS,
  taxonomicDescendentClasses: [DESCENDANT_CLASS]
}];

// Test Case 1: Actual - Object is locked with validated label matching target or descendant
const sequenceActual = {
  images: [
    { _id: 'img1', dateTimeOriginal: new Date('2024-01-01T10:00:00Z'), objects: [] },
    { _id: 'img2', dateTimeOriginal: new Date('2024-01-01T10:00:05Z'), objects: [] },
    {
      _id: 'img3',
      dateTimeOriginal: new Date('2024-01-01T10:00:10Z'),
      objects: [{
        _id: 'obj-id',
        locked: true,
        labels: [{
          _id: 'label-id',
          type: 'manual',
          labelId: 'brown rat',
          validation: { validated: true, validationDate: new Date() }
        }],
        firstValidLabel: [{
          _id: 'label-id',
          type: 'manual',
          labelId: 'brown rat',
          validation: { validated: true, validationDate: new Date() }
        }]
      }]
    }
  ],
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T10:00:10Z'),
  imageCount: 3
};

// Test Case 2: True Positive - Object is locked, has ML label for target/descendant, and validated label matches
const sequenceTruePositive = {
  images: [
    { _id: 'img4', dateTimeOriginal: new Date('2024-01-01T11:00:00Z'), objects: [] },
    { _id: 'img5', dateTimeOriginal: new Date('2024-01-01T11:00:05Z'), objects: [] },
    {
      _id: 'img6',
      dateTimeOriginal: new Date('2024-01-01T11:00:10Z'),
      objects: [{
        _id: 'obj-id',
        locked: true,
        labels: [
          {
            _id: 'label-id-1',
            type: 'ml',
            labelId: 'brown rat',
            mlModel: ML_MODEL,
            validation: { validated: true, validationDate: new Date() }
          }
        ],
        firstValidLabel: [{
          _id: 'label-id-1',
          type: 'ml',
          labelId: 'brown rat',
          mlModel: ML_MODEL,
          validation: { validated: true, validationDate: new Date() }
        }]
      }]
    }
  ],
  startTime: new Date('2024-01-01T11:00:00Z'),
  endTime: new Date('2024-01-01T11:00:10Z'),
  imageCount: 3
};

// Test Case 3: False Positive - Object is locked, has ML label for target/descendant, but validated label is different
const sequenceFalsePositive = {
  images: [
    { _id: 'img7', dateTimeOriginal: new Date('2024-01-01T12:00:00Z'), objects: [] },
    { _id: 'img8', dateTimeOriginal: new Date('2024-01-01T12:00:05Z'), objects: [] },
    {
      _id: 'img9',
      dateTimeOriginal: new Date('2024-01-01T12:00:10Z'),
      objects: [{
        _id: 'obj-id',
        locked: true,
        labels: [
          {
            _id: 'label-id-1',
            type: 'ml',
            labelId: 'rodent',
            mlModel: ML_MODEL
          },
          {
            _id: 'label-id-2',
            type: 'manual',
            labelId: 'bird',
            validation: { validated: true, validationDate: new Date() }
          }
        ],
        firstValidLabel: [{
          _id: 'label-id-2',
          type: 'manual',
          labelId: 'bird',
          validation: { validated: true, validationDate: new Date() }
        }]
      }]
    }
  ],
  startTime: new Date('2024-01-01T12:00:00Z'),
  endTime: new Date('2024-01-01T12:00:10Z'),
  imageCount: 3
};

// Test Case 4: False Negative - Object is locked, has validated label for target/descendant, but NO ML label for it
const sequenceFalseNegative = {
  images: [
    { _id: 'img10', dateTimeOriginal: new Date('2024-01-01T13:00:00Z'), objects: [] },
    { _id: 'img11', dateTimeOriginal: new Date('2024-01-01T13:00:05Z'), objects: [] },
    {
      _id: 'img12',
      dateTimeOriginal: new Date('2024-01-01T13:00:10Z'),
      objects: [{
        _id: 'obj-id',
        locked: true,
        labels: [
          {
            _id: 'label-id-1',
            type: 'ml',
            labelId: 'bird',
            mlModel: ML_MODEL
          },
          {
            _id: 'label-id-2',
            type: 'manual',
            labelId: 'brown rat',
            validation: { validated: true, validationDate: new Date() }
          }
        ],
        firstValidLabel: [{
          _id: 'label-id-2',
          type: 'manual',
          labelId: 'brown rat',
          validation: { validated: true, validationDate: new Date() }
        }]
      }]
    }
  ],
  startTime: new Date('2024-01-01T13:00:00Z'),
  endTime: new Date('2024-01-01T13:00:10Z'),
  imageCount: 3
};

test('analyzeMLSequenceLevelWithTaxonomy - processSequence', async (t) => {
  t.test('should count actual when sequence has locked object with validated target/descendant label and false negative because there was a validated label but no matching ml prediction', (t) => {
    const data = {
      [`${DEPLOYMENT._id}_rodent`]: {
        allActuals: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0
      }
    };

    processSequence(sequenceActual, DEPLOYMENT, data, ML_LABELS, ML_MODEL);

    t.equal(data[`${DEPLOYMENT._id}_rodent`].allActuals, 1, 'should count 1 actual');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].truePositives, 0, 'should count 0 true positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falsePositives, 0, 'should count 0 false positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falseNegatives, 1, 'should count 1 false negatives');
    t.end();
  });

  t.test('should count true positive when sequence has locked object with ML prediction validated as target/descendant', (t) => {
    const data = {
      [`${DEPLOYMENT._id}_rodent`]: {
        allActuals: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0
      }
    };

    processSequence(sequenceTruePositive, DEPLOYMENT, data, ML_LABELS, ML_MODEL);

    t.equal(data[`${DEPLOYMENT._id}_rodent`].allActuals, 1, 'should count 1 actual');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].truePositives, 1, 'should count 1 true positive');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falsePositives, 0, 'should count 0 false positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falseNegatives, 0, 'should count 0 false negatives');
    t.end();
  });

  t.test('should count false positive when sequence has locked object with ML prediction not validated as target/descendant', (t) => {
    const data = {
      [`${DEPLOYMENT._id}_rodent`]: {
        allActuals: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0
      }
    };

    processSequence(sequenceFalsePositive, DEPLOYMENT, data, ML_LABELS, ML_MODEL);

    t.equal(data[`${DEPLOYMENT._id}_rodent`].allActuals, 0, 'should count 0 actuals');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].truePositives, 0, 'should count 0 true positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falsePositives, 1, 'should count 1 false positive');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falseNegatives, 0, 'should count 0 false negatives');
    t.end();
  });

  t.test('should count false negative when sequence has locked object with validated target/descendant but no ML prediction', (t) => {
    const data = {
      [`${DEPLOYMENT._id}_rodent`]: {
        allActuals: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0
      }
    };

    processSequence(sequenceFalseNegative, DEPLOYMENT, data, ML_LABELS, ML_MODEL);

    t.equal(data[`${DEPLOYMENT._id}_rodent`].allActuals, 1, 'should count 1 actual');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].truePositives, 0, 'should count 0 true positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falsePositives, 0, 'should count 0 false positives');
    t.equal(data[`${DEPLOYMENT._id}_rodent`].falseNegatives, 1, 'should count 1 false negative');
    t.end();
  });

  t.end();
});
