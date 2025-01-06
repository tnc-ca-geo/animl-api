import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import { ImageModel } from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

const mocks = [
  // Should be unchanged
  {
    _id: 'no-labels',
    objects: [
      {
        _id: 'no-labels',
        locked: false,
        labels: [],
      }
    ]
  },
  // Should be unchanged
  {
    _id: 'no-matching-label',
    objects: [
      {
        _id: 'no-matching-label',
        locked: false,
        labels: [{
          labelId: 'no-matching-label',
        }]
      }
    ]
  },
  // Object should be removed
  {
    _id: 'matching-label-only-label',
    objects: [
      {
        _id: 'matching-label-only-label',
        locked: false,
        labels: [{
          labelId: 'matching-label-only-label',
        }]
      }
    ]
  },
  // Object should be unlocked and label removed
  {
    _id: 'many-labels-matching-label-validated',
    objects: [
      {
        _id: 'many-labels-matching-label-validated',
        locked: true,
        labels: [
          {
            labelId: 'many-labels-matching-label-validated',
            validation: {
              validated: true
            }
          },
          {
            labelId: 'not-matching-label',
            validation: {
              validated: true
            }
          }
        ]
      }
    ]
  },
  // Label should be removed but object unchanged
  {
    _id: 'many-labels-matching-label',
    objects: [
      {
        _id: 'many-labels-matching-label',
        locked: true,
        labels: [
          {
            labelId: 'many-labels-matching-label',
          },
          {
            labelId: 'not-matching-label',
            validation: {
              validated: true
            }
          },
          {
            labelId: 'other-not-matching-label',
          }
        ]
      }
    ]
  },
  {
    _id: 'do-all-operations',
    objects: [
      {
        _id: 'do-all-operations-0',
        locked: false,
        labels: [
          {
            labelId: 'do-all-operations',
          },
        ]
      },
      {
        _id: 'do-all-operations-1',
        locked: true,
        labels: [
          {
            labelId: 'many-objects-with-label',
            validation: {
              validated: true
            }
          },
          {
            labelId: 'not-matching',
          },
        ]
      },
      {
        _id: 'do-all-operations-2',
        locked: false,
        labels: [
          {
            labelId: 'do-all-operations',
          },
          {
            labelId: 'not-matching',
          },
        ]
      }
    ]
  },
];


tape('Image: DeleteLabel', async (t) => {
  try {
    MockConfig(t);

    const mockFind = Sinon.stub(ImageSchema, 'find');

    const bulkWriteMock = Sinon.stub(ImageSchema, 'bulkWrite').callsFake((command) => {
      console.log(command);
      return true 
    });

    // Do nothing
    mockFind.resolves(mocks[0])
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'no-labels' },
      { user: { 'curr_project': 'mock-project' }},
    );
    t.assert(bulkWriteMock.calledOnceWithExactly([]))

    // Do nothing
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'no-matching-label' },
      { user: { 'curr_project': 'mock-project' }},
    );
    bulkWriteMock.calledOnceWithExactly([]);
  
    // Delete object
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'matching-label-only-label' },
      { user: { 'curr_project': 'mock-project' }},
    );
    bulkWriteMock.calledOnceWithExactly([
      {
        updateOne: {
          filter: { _id: 'matching-label-only-label' },
          update: {
            $pull: { 
              'objects': {
                _id: {
                  $in: ['matching-label-only-label']
                }
              }
            }
          }
        }
      }
    ]);
  
    // Unlock
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'many-labels-matching-label-validated' },
      { user: { 'curr_project': 'mock-project' }},
    );
    bulkWriteMock.calledOnceWithExactly([
      {
        updateOne: {
          filter: { _id: 'matching-label-only-label' },
          update: {
            $set: { 'objects.$[obj].locked': false },
            $pull: { 
              'objects': {
                _id: {
                  $in: ['matching-label-only-label']
                }
              }
            }
          },
          arrayFilters: [
            { 'obj._id': 'matching-label-only-label' }
          ]
        }
      }
    ]);
  
    // Remove but don't unlock
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'many-labels-matching-label' },
      { user: { 'curr_project': 'mock-project' }},
    );
    bulkWriteMock.calledOnceWithExactly([
      {
        updateOne: {
          filter: { _id: 'many-labels-matching-label' },
          update: {
            $pull: { 
              'objects.$[obj].labels': {
                labelId: 'many-labels-matching-label'
              }
            }
          },
          arrayFilters: [
            { 'obj._id': 'many-labels-matching-label' }
          ]
        }
      }
    ]);
  
    // Do all operations
    await ImageModel.deleteLabelsFromImages(
      { labelId: 'do-all-operations' },
      { user: { 'curr_project': 'mock-project' }},
    );
    bulkWriteMock.calledOnceWithExactly([
      {
        updateOne: {
          filter: { _id: 'do-all-operations' },
          update: {
            $pull: { 
              'objects': {
                _id: {
                  $in: ['do-all-operations']
                }
              }
            }
          },
          arrayFilters: [
            { 'obj._id': 'do-all-operations-0' }
          ]
        }
      },
      {
        updateOne: {
          filter: { _id: 'do-all-operations' },
          update: {
            $set: { 'objects.$[obj].locked': false },
            $pull: { 
              'objects.$[obj].labels': {
                labelId: 'do-all-operations'
              }
            }
          },
          arrayFilters: [
            { 'obj._id': 'do-all-operations-1' }
          ]
        }
      },
      {
        updateOne: {
          filter: { _id: 'do-all-operations' },
          update: {
            $pull: { 
              'objects.$[obj].labels': {
                labelId: 'do-all-operations'
              }
            }
          },
          arrayFilters: [
            { 'obj._id': 'do-all-operations-2' }
          ]
        }
      }
    ]);
  } catch (err) {
    t.error(err);
  }
});
