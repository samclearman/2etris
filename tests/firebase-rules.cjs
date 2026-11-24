// Run against local Emulator Suite only (see README). No cloud credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

async function guest() {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(res.status, 200);
  return res.json();
}

async function status(path, who, method = 'GET', value) {
  const url = new URL(`http://127.0.0.1:9000/sessions${path}.json`);
  url.searchParams.set('ns', 'demo-2etris-default-rtdb');
  if (who) url.searchParams.set('auth', who.idToken);
  const res = await fetch(url, { method, body: JSON.stringify(value) });
  return res.status;
}

test('room access, authenticated authorship and immutable history', async () => {
  const [host, visitor, third] = await Promise.all([guest(), guest(), guest()]);
  const room = '/' + randomBytes(4).toString('hex');
  const ev = who => ({ user: who.localId, time: { '.sv': 'timestamp' }, localTime: Date.now() });
  const init = { ...ev(host), t: 8, seed: 'smoke' };
  assert.equal(await status(room, host, 'PATCH', {
    'members/host': host.localId, 'events/0': init, 'events/1': { ...ev(host), t: 9, player: 0 },
  }), 200);
  assert.equal(await status('', host), 401); // no room listing
  assert.equal(await status(room + '/events', null), 401);
  assert.equal(await status(room + '/events', visitor), 401);
  const join = who => status(room, who, 'PATCH', {
    'members/guest': who.localId, 'events/2': { ...ev(who), t: 9, player: 1 },
  });
  const joins = await Promise.all([join(visitor), join(third)]);
  assert.deepEqual([...joins].sort(), [200, 401]);
  const [winner, outsider] = joins[0] === 200 ? [visitor, third] : [third, visitor];
  assert.equal(await status(room + '/events', winner), 200);
  assert.equal(await status(room + '/events', outsider), 401);
  const claim = { ...ev(winner), t: 9, player: 1 };
  assert.equal(await status(room + '/events/other', host, 'PUT', claim), 401);
  assert.equal(await status(room + '/events/2', winner, 'PUT', claim), 401);
  assert.equal(await status(room + '/events/2', winner, 'DELETE'), 401);
  assert.equal(await status(room + '/events/extra', outsider, 'PUT', { ...ev(outsider), t: 11, val: 2 }), 401);
  assert.equal(await status(room + '/events/level', host, 'PUT', { ...ev(host), t: 11, val: 99 }), 401);
});
