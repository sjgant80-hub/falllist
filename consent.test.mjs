// consent.test.mjs — PROOF-OF-PLAY for getting off a mailing list.
import {
  ACTIVE, PENDING, UNSUBSCRIBED, BOUNCED, COMPLAINED,
  normalizeEmail, isEmail, statusOf, canSend, recipientsOf, suppressed,
  findByEmail, findByToken, unsubTokenOf, unsubscribe, addSubscriber, resubscribe, markBounced, sendSummary,
} from './consent.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

const NOW = Date.UTC(2026, 7, 20, 9, 0);
const sub = (email, extra = {}) => ({ id: 'k7x9q2m4', email, name: '', source: 'manual', addedAt: NOW, status: ACTIVE, ...extra });

console.log('\n=== §1 · ⚑ THE LINK IN EVERY EMAIL NOW DOES SOMETHING ===');
{
  const list = [sub('reader@example.com')];
  const r = unsubscribe(list, 'reader@example.com', NOW);
  ok(r.ok === true, '⚑ an unsubscribe is honoured — before this, the link opened the sender’s admin app');
  ok(canSend(r.subscribers[0]) === false, 'and they stop receiving mail');
  ok(recipientsOf(r.subscribers).length === 0, 'the next send goes to nobody');
  ok(/taken off/.test(r.reason), 'and the person is told plainly what happened');

  const again = unsubscribe(r.subscribers, 'reader@example.com', NOW);
  ok(again.ok === true && again.already === true, 'clicking it twice is fine, not an error');
}

console.log('\n=== §2 · ⚑ THE TOMBSTONE — THE WHOLE POINT ===');
{
  const list = [sub('gone@example.com')];
  const off = unsubscribe(list, 'gone@example.com', NOW).subscribers;
  ok(off.length === 1, '⚑ unsubscribing MARKS, it never deletes — removeSub() deleted, and a deleted row is not a record of anything');

  const back = addSubscriber(off, { email: 'gone@example.com', source: 'csv-import' }, NOW);
  ok(back.ok === false, '⚑ AND THE NEXT CSV IMPORT CANNOT PUT THEM BACK — this is what the whole file is for');
  ok(back.suppressed === true, 'the import is told it was suppression, not a duplicate');
  ok(/asked to be taken off/.test(back.reason), 'in words the sender understands');
  ok(back.subscribers.length === 1, 'and nothing was added');

  ok(addSubscriber(off, { email: 'GONE@Example.COM' }, NOW).ok === false,
     '⚑ nor re-typed in different case — a suppression that a capital letter defeats is not one');
}

console.log('\n=== §3 · ⚑ SOMEBODY WHO NEVER SIGNED UP CAN STILL LEAVE ===');
{
  const r = unsubscribe([], 'forwarded@example.com', NOW);
  ok(r.ok === true && r.subscribers.length === 1,
     '⚑ a forwarded email unsubscribes an address not on the list — a tombstone with no record is exactly the case that matters');
  ok(statusOf(r.subscribers[0]) === UNSUBSCRIBED, 'and it is recorded as a suppression');
  ok(addSubscriber(r.subscribers, { email: 'forwarded@example.com' }, NOW).ok === false,
     'so importing them later is refused too');
  ok(unsubscribe([], 'not-an-address', NOW).ok === false, 'but garbage does not become a tombstone');
}

console.log('\n=== §4 · the link has to name somebody ===');
{
  const s = sub('reader@example.com');
  ok(unsubTokenOf(s) !== null, 'a random id makes a usable link');
  ok(findByToken([s], unsubTokenOf(s)) === s, 'and the link finds exactly that person');

  ok(unsubTokenOf({ id: 7 }) === null,
     '⚑ a COUNTER is refused — with ids 1,2,3 the link ?unsubscribe=4 removes a stranger and one recipient empties the list');
  ok(unsubTokenOf({ id: '00000042' }) === null, 'padding a counter to eight digits does not make it private');
  ok(unsubTokenOf({ id: 'abc' }) === null, 'nor does a short id');
  ok(unsubTokenOf({}) === null, 'nor no id at all');
  ok(findByToken([{ id: 7, email: 'a@b.com' }], '7') === null, '⚑ and a token we would never issue is never honoured either');
  ok(findByToken([s], null) === null, 'no token finds nobody');
}

console.log('\n=== §5 · ⚑ ONE GATE, AND SILENCE WHEN UNSURE ===');
{
  ok(canSend(sub('a@b.com')) === true, 'an active subscriber is sent to');
  ok(canSend(sub('a@b.com', { status: UNSUBSCRIBED })) === false, 'an unsubscribed one is not');
  ok(canSend(sub('a@b.com', { status: BOUNCED })) === false, 'nor a bounced one');
  ok(canSend(sub('a@b.com', { status: COMPLAINED })) === false, 'nor one who reported it as spam');
  ok(canSend(sub('a@b.com', { status: PENDING })) === false,
     '⚑ nor one who has not confirmed — double opt-in that still sends is not opt-in');
  ok(canSend(sub('a@b.com', { status: 'quarantined-v3' })) === false,
     '⚑ AN UNKNOWN STATUS IS SILENCE — a word this code has never seen came from somewhere, and guessing it means "fine to email" is how a suppression gets ignored by an upgrade');
  ok(canSend(sub('a@b.com', { status: '' })) === true, 'but a record written before statuses existed is still a subscriber');
  ok(canSend(sub('not an address')) === false, 'and an unusable address is never sent to');
  ok(canSend(null) === false, 'nothing is not a subscriber');
}

console.log('\n=== §6 · one person, one email ===');
{
  const list = [sub('a@b.com'), { ...sub('A@B.com'), id: 'zz88ww11' }];
  ok(recipientsOf(list).length === 1, '⚑ the same address in two spellings gets ONE email, not two');
  ok(findByEmail(list, 'A@B.COM') === list[0], 'and looking them up ignores case');
  ok(addSubscriber(list, { email: ' A@B.com ' }, NOW).ok === false, 'adding them again in any spelling is refused');
  ok(normalizeEmail('  Foo@Bar.COM ') === 'foo@bar.com', 'trimmed and lowercased');
  ok(normalizeEmail(null) === '' && normalizeEmail(42) === '', 'and nothing that is not text is an address');
  ok(isEmail('a+tag@b.co.uk') === true, '⚑ a +tag address is REAL — rejecting it turns a valid person away');
}

console.log('\n=== §7 · coming back has to be their own doing ===');
{
  const off = unsubscribe([sub('x@y.com')], 'x@y.com', NOW).subscribers;
  ok(resubscribe(off, 'x@y.com', NOW).ok === false,
     '⚑ a sender cannot un-unsubscribe somebody — if they could, the suppression list would be advice');
  const back = resubscribe(off, 'x@y.com', NOW, { byPerson: true });
  ok(back.ok === true && canSend(back.subscribers[0]) === true, 'but the person themselves can rejoin');
  ok(back.subscribers[0].unsubscribedAt === null, 'and the old suppression is cleared with them');

  const spam = [sub('c@d.com', { status: COMPLAINED })];
  ok(resubscribe(spam, 'c@d.com', NOW, { byPerson: true }).ok === false,
     '⚑ a spam complaint is NOT the sender’s to undo, even on the person’s say-so through this screen');
  ok(resubscribe([], 'nobody@x.com', NOW, { byPerson: true }).ok === false, 'and a stranger cannot rejoin what they never left');
}

console.log('\n=== §8 · what the sender is told before sending ===');
{
  const list = [sub('a@b.com'), sub('c@d.com', { status: UNSUBSCRIBED }), sub('e@f.com', { status: PENDING }), sub('g@h.com', { status: BOUNCED })];
  const s = sendSummary(list);
  ok(s.total === 4 && s.sending === 1,
     '⚑ "Send to 4 subscribers?" was a lie — it counted the whole list and sent to the active ones');
  ok(s.suppressed === 2, 'the suppression count is its own number');
  ok(s.byStatus[ACTIVE] === 1 && s.byStatus[PENDING] === 1, 'and the breakdown is honest about each');
  ok(suppressed(list).has('c@d.com') && suppressed(list).has('g@h.com'), 'the suppression list is both of them');
  ok(suppressed(list).has('a@b.com') === false, 'and nobody else');
}

console.log('\n=== §9 · double opt-in, and bounces ===');
{
  const r = addSubscriber([], { email: 'new@x.com' }, NOW, { requireConfirm: true });
  ok(r.ok === true && statusOf(r.subscribers[0]) === PENDING, 'with confirmation on, a signup starts pending');
  ok(canSend(r.subscribers[0]) === false, 'and gets nothing until they confirm');
  ok(statusOf(addSubscriber([], { email: 'new@x.com' }, NOW).subscribers[0]) === ACTIVE, 'with it off, they are active immediately');

  const b = markBounced([sub('dead@x.com')], 'dead@x.com', NOW);
  ok(statusOf(b.subscribers[0]) === BOUNCED, 'a bounce suppresses the address');
  ok(addSubscriber(b.subscribers, { email: 'dead@x.com' }, NOW).ok === false, 'and an import cannot revive it either');
  ok(/bounced/.test(addSubscriber(b.subscribers, { email: 'dead@x.com' }, NOW).reason), 'with the real reason, not a bare no');
}

console.log('\n=== §10 · nothing is changed underfoot ===');
{
  const list = [sub('a@b.com')];
  const frozen = JSON.stringify(list);
  unsubscribe(list, 'a@b.com', NOW);
  addSubscriber(list, { email: 'c@d.com' }, NOW);
  resubscribe(list, 'a@b.com', NOW, { byPerson: true });
  markBounced(list, 'a@b.com', NOW);
  ok(JSON.stringify(list) === frozen,
     '⚑ every call returns a NEW list — a record of who consented to what must not shift under an audit');
}

console.log('\n=== §11 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, 'x', [null], [{}], [{ email: null }], { email: {} }];
  let threw = null;
  for (const j of junk) {
    try {
      normalizeEmail(j); isEmail(j); statusOf(j); canSend(j); recipientsOf(j); suppressed(j);
      findByEmail(j, j); findByToken(j, j); unsubTokenOf(j);
      unsubscribe(j, j, j, j); addSubscriber(j, j, j, j); resubscribe(j, j, j, j); markBounced(j, j, j); sendSummary(j);
    } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(addSubscriber([], {}, NOW).ok === false, '⚑ and an empty candidate is refused, never added by default');
  ok(recipientsOf([null, {}, sub('a@b.com')]).length === 1, 'garbage in a list is skipped, not sent to');
  ok(unsubscribe([], 'a@b.com', 'not a clock').subscribers[0].unsubscribedAt === null,
     'an unreadable clock records no time rather than an invented one — but still records the suppression');
}

console.log('\n=== §12 · ⚑ LOOKING SOMEBODY UP MUST FIND THE RIGHT SOMEBODY ===');
{
  // Every lookup test above asked for the FIRST person on the list, so a lookup that ignores who was
  // asked for and hands back whoever is first would have passed all of them. The gate found it.
  const a = sub('first@x.com'), b = { ...sub('second@x.com'), id: 'zz88ww11' };
  ok(findByEmail([a, b], 'second@x.com') === b,
     '⚑ finding the SECOND person returns the second person — not simply whoever is first');
  ok(findByEmail([a, b], 'nobody@x.com') === null, 'and an address on the list at all is not "close enough"');
  ok(findByToken([a, b], 'zz88ww11') === b, '⚑ and the same for an unsubscribe link — the wrong person must never be removed');
  ok(findByToken([a, b], 'k7x9q2m4') === a, 'each token finds its own record');
  ok(findByToken([a, b], 'qqqqqqqq') === null, 'and an unknown token finds nobody');

  ok(findByToken([{ id: 'abc', email: 'x@y.com' }], 'abc') === null,
     '⚑ a SHORT id is not honoured even when it matches a real record — we would never have issued that link, so a click on one is a guess');
}

console.log('\n=== §13 · the edges the gate went looking for ===');
{
  const long = 'a'.repeat(254 - '@example.com'.length) + '@example.com';
  ok(long.length === 254 && isEmail(long) === true, '⚑ an address of exactly 254 characters is deliverable and accepted');
  ok(isEmail(long + 'a') === false, 'and one character more is not');

  const r = addSubscriber([], { email: 'new@x.com' }, NOW, { requireConfirm: true });
  ok(/confirmation/.test(r.reason), '⚑ a pending signup SAYS it is waiting on confirmation — "added" would be a lie to the sender');
  ok(addSubscriber([], { email: 'new@x.com' }, NOW).reason === 'added', 'and a plain one says added');

  const messy = [sub('a@b.com'), null, 'junk', sub('c@d.com', { status: UNSUBSCRIBED })];
  const s = sendSummary(messy);
  ok(s.byStatus.unreadable === 2,
     '⚑ rows that are not records are COUNTED as unreadable — dropping them made the breakdown quietly disagree with the total');
  ok(Object.values(s.byStatus).reduce((x, y) => x + y, 0) === s.total, 'so the breakdown always adds up to the total');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
