export const TURN_MS = 10000;
export const TURNS_PER_ROUND = 3;
export const PHASES = ['ready', 'running', 'blank', 'answer', 'roundEnd', 'exhausted'];

export function createSession(ids, random = Math.random) {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { version: 2, order, cursor: 0, round: 1, turn: 0, turnMs: TURN_MS, phase: 'ready', deadline: null };
}

export function currentId(session) {
  return session.order[session.cursor];
}

export function beginTurn(session, now = Date.now()) {
  if (session.phase !== 'ready' || !currentId(session)) return false;
  session.phase = 'running';
  session.turnMs = TURN_MS;
  session.deadline = now + TURN_MS;
  return true;
}

export function expireTurn(session, now = Date.now()) {
  if (session.phase !== 'running' || now < session.deadline) return false;
  session.phase = 'blank';
  session.deadline = null;
  return true;
}

export function revealAnswer(session) {
  if (session.phase !== 'blank') return false;
  session.phase = 'answer';
  return true;
}

export function advanceTurn(session) {
  if (session.phase !== 'answer') return false;
  session.cursor++;
  session.turn++;
  session.phase = session.turn === TURNS_PER_ROUND ? 'roundEnd' : 'ready';
  session.deadline = null;
  return true;
}

export function nextRound(session) {
  if (session.phase !== 'roundEnd') return false;
  if (session.order.length - session.cursor < TURNS_PER_ROUND) {
    session.phase = 'exhausted';
  } else {
    session.round++;
    session.turn = 0;
    session.phase = 'ready';
  }
  return true;
}

export function validSession(session, ids) {
  if (!session || session.version !== 2 || !Array.isArray(session.order)) return false;
  if (session.order.length !== ids.length || new Set(session.order).size !== ids.length) return false;
  const allowed = new Set(ids);
  if (!session.order.every(id => allowed.has(id))) return false;
  if (!Number.isInteger(session.cursor) || session.cursor < 0 || session.cursor > ids.length) return false;
  if (!Number.isInteger(session.round) || session.round < 1) return false;
  if (!PHASES.includes(session.phase)) return false;
  if (['roundEnd', 'exhausted'].includes(session.phase)) {
    return session.turn === TURNS_PER_ROUND && session.cursor === session.round * TURNS_PER_ROUND;
  }
  if (![0, 1, 2].includes(session.turn) || session.cursor !== (session.round - 1) * TURNS_PER_ROUND + session.turn) return false;
  if (!currentId(session)) return false;
  return session.phase === 'running' ? Number.isFinite(session.deadline) : session.deadline === null;
}

// Preserve the original start time when upgrading an in-progress 15-second turn.
export function migrateTurnDuration(session) {
  const previousDuration = session.turnMs ?? 15000;
  if (session.phase === 'running' && previousDuration !== TURN_MS) {
    session.deadline += TURN_MS - previousDuration;
  }
  session.turnMs = TURN_MS;
}
