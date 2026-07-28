import test from 'node:test';
import assert from 'node:assert/strict';

import { createAutoSaveCoordinator } from '../../src/services/autoSaveCoordinator.js';

test('a late save from a previous editing epoch cannot become current', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'old draft' });
  const ticket = coordinator.beginRequest();

  coordinator.advanceEpoch();

  assert.equal(coordinator.isSameEpoch(ticket), false);
  assert.equal(coordinator.isCurrent(ticket), false);
});

test('completing an old request does not clear a newer pending payload', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'first' });
  const ticket = coordinator.beginRequest();
  coordinator.schedule({ name: 'second' });

  coordinator.complete(ticket);

  assert.deepEqual(coordinator.peek(), { name: 'second' });
});

test('advancing an epoch detaches an unsaved payload for background persistence', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'preserve me' });

  const detached = coordinator.advanceEpoch();

  assert.deepEqual(detached.payload, { name: 'preserve me' });
  assert.equal(coordinator.peek(), null);
});

test('advancing an epoch does not detach a payload already being persisted', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'already saving' });
  coordinator.beginRequest();

  const detached = coordinator.advanceEpoch();

  assert.equal(detached, null);
});

test('a created id is adopted by a newer pending payload in the same epoch', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ id: '', name: 'first version' });
  const ticket = coordinator.beginRequest();
  coordinator.schedule({ id: '', name: 'latest version' });

  coordinator.adoptCreatedId(ticket, 'resume-1');

  assert.deepEqual(coordinator.peek(), {
    id: 'resume-1',
    name: 'latest version',
  });
});

