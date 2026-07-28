export function createAutoSaveCoordinator() {
  let epoch = 0;
  let revision = 0;
  let pending = null;
  const inFlight = new Set();

  function schedule(payload) {
    revision += 1;
    pending = { epoch, revision, payload: { ...payload } };
    return pending;
  }

  function beginRequest() {
    if (!pending) return null;
    const ticket = {
      epoch: pending.epoch,
      revision: pending.revision,
      payload: { ...pending.payload },
    };
    inFlight.add(`${ticket.epoch}:${ticket.revision}`);
    return ticket;
  }

  function isSameEpoch(ticket) {
    return Boolean(ticket) && ticket.epoch === epoch;
  }

  function isCurrent(ticket) {
    return Boolean(
      ticket &&
        pending &&
        ticket.epoch === epoch &&
        pending.epoch === ticket.epoch &&
        pending.revision === ticket.revision,
    );
  }

  function complete(ticket) {
    if (!ticket) return;
    inFlight.delete(`${ticket.epoch}:${ticket.revision}`);
    if (isCurrent(ticket)) pending = null;
  }

  function advanceEpoch() {
    let detached = null;
    if (pending && !inFlight.has(`${pending.epoch}:${pending.revision}`)) {
      detached = {
        epoch: pending.epoch,
        revision: pending.revision,
        payload: { ...pending.payload },
      };
    }
    epoch += 1;
    pending = null;
    return detached;
  }

  function adoptCreatedId(ticket, id) {
    if (
      !ticket ||
      !id ||
      !pending ||
      pending.epoch !== ticket.epoch ||
      pending.payload.id
    ) {
      return false;
    }
    pending = {
      ...pending,
      payload: { ...pending.payload, id },
    };
    return true;
  }

  function peek() {
    return pending ? { ...pending.payload } : null;
  }

  function clear() {
    revision += 1;
    pending = null;
  }

  return {
    schedule,
    beginRequest,
    isSameEpoch,
    isCurrent,
    complete,
    advanceEpoch,
    adoptCreatedId,
    peek,
    clear,
  };
}

