import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import { ImageModel } from '../.build/api/db/models/Image.js';
import { DeleteImagesByFilter } from '../.build/task/image.js';

const FILTERS = { cameras: ['camera1'] };

// Serves `pages` in order from queryByFilter and records every delete
const stubPagination = (pages) => {
  const queries = [];
  const deleted = [];

  let i = 0;
  Sinon.stub(ImageModel, 'queryByFilter').callsFake(async (input) => {
    queries.push(input);
    return pages[i++];
  });

  Sinon.stub(ImageModel, 'deleteImages').callsFake(async (input) => {
    deleted.push(...input.imageIds);
    return { imageIds: input.imageIds, errors: [] };
  });

  return { queries, deleted };
};

const page = (ids, next = null) => ({
  results: ids.map((_id) => ({ _id })),
  hasNext: next !== null,
  next,
});

tape('DeleteImagesByFilter: deletes a single page and stops', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const { queries, deleted } = stubPagination([page(['project:a', 'project:b'])]);

    const res = await DeleteImagesByFilter({ projectId: 'project', config: { filters: FILTERS } });

    t.equal(queries.length, 1, 'Should not re-query when there is no next page');
    t.deepEquals(deleted, ['project:a', 'project:b']);
    t.deepEquals(res.filters, FILTERS, 'Should echo the filters back');
    t.deepEquals(res.errors, []);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape(
  'DeleteImagesByFilter: pages through results and deletes each image exactly once',
  async (t) => {
    try {
      Sinon.restore();
      MockConfig(t);

      const { queries, deleted } = stubPagination([
        page(['project:a', 'project:b'], 'cursor-1'),
        page(['project:c', 'project:d'], 'cursor-2'),
        page(['project:e']),
      ]);

      await DeleteImagesByFilter({ projectId: 'project', config: { filters: FILTERS } });

      t.equal(queries.length, 3, 'Should query once per page');
      t.deepEquals(deleted, ['project:a', 'project:b', 'project:c', 'project:d', 'project:e']);
      t.equal(new Set(deleted).size, deleted.length, 'Should never delete the same image twice');
    } catch (err) {
      t.error(err);
    }

    Sinon.restore();
    t.end();
  },
);

tape('DeleteImagesByFilter: threads the next cursor and keeps filters constant', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const { queries } = stubPagination([page(['project:a'], 'cursor-1'), page(['project:b'])]);

    await DeleteImagesByFilter({ projectId: 'project', config: { filters: FILTERS } });

    t.equal(queries[0].next, undefined, 'First query should have no cursor');
    t.equal(queries[1].next, 'cursor-1', 'Second query should resume from the first page cursor');
    t.deepEquals(queries[0].filters, FILTERS);
    t.deepEquals(queries[1].filters, FILTERS, 'Filters must not drift between pages');
    t.equal(queries[0].limit, ImageModel.DELETE_IMAGES_BATCH_SIZE);
    t.equal(queries[1].limit, ImageModel.DELETE_IMAGES_BATCH_SIZE);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('DeleteImagesByFilter: no-ops when nothing matches the filters', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const { queries, deleted } = stubPagination([page([])]);

    const res = await DeleteImagesByFilter({ projectId: 'project', config: { filters: FILTERS } });

    t.equal(queries.length, 1);
    t.deepEquals(deleted, [], 'Should not attempt a delete');
    t.deepEquals(res.errors, []);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape(
  'DeleteImagesByFilter: terminates when a page reports hasNext but returns no results',
  async (t) => {
    try {
      Sinon.restore();
      MockConfig(t);

      // The result set shrinks as we delete from it, so the backend can report a next page that
      // turns out to be empty. The loop must not spin forever on that.
      const { queries, deleted } = stubPagination([
        page(['project:a'], 'cursor-1'),
        page([], 'cursor-2'),
      ]);

      const res = await DeleteImagesByFilter({
        projectId: 'project',
        config: { filters: FILTERS },
      });

      t.equal(queries.length, 2, 'Should stop after the empty page');
      t.deepEquals(deleted, ['project:a']);
      t.deepEquals(res.errors, []);
    } catch (err) {
      t.error(err);
    }

    Sinon.restore();
    t.end();
  },
);

tape('DeleteImagesByFilter: accumulates errors across pages without aborting', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    Sinon.stub(ImageModel, 'queryByFilter')
      .onCall(0)
      .resolves(page(['project:a'], 'cursor-1'))
      .onCall(1)
      .resolves(page(['project:b']));

    Sinon.stub(ImageModel, 'deleteImages').callsFake(async (input) => ({
      imageIds: input.imageIds,
      errors: [`failed ${input.imageIds[0]}`],
    }));

    const res = await DeleteImagesByFilter({ projectId: 'project', config: { filters: FILTERS } });

    t.deepEquals(
      res.errors,
      ['failed project:a', 'failed project:b'],
      'Should collect errors from every page rather than stopping at the first',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
