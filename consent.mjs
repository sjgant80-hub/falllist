// consent.mjs — nobody could get off this list.
//
// ⚑ WHAT WAS MISSING. Every email falllist sends carries an unsubscribe link in its footer, and
// nothing on the other end reads it. `checkSignupMode()` handles `?signup=1` and nothing handles
// `?unsubscribe=1` — clicking it opened the sender's own admin app. A visible unsubscribe link that
// does nothing is worse than no link: the person believes they have left, keeps receiving the emails,
// and the sender never learns they wanted out.
//
// ⚑ AND THE LINK COULD NOT HAVE WORKED ANYWAY. `?unsubscribe=1` names nobody. A person clicking it
// says only "somebody wants off", so the link needs the subscriber's own token in it.
//
// ⚑ AND `status: 'active'` WAS THE ONLY STATUS. It is written in three places and changed in none,
// while sendNewsletter() filters for the ones whose status is active — a filter over a field that
// cannot vary. The code looks like it honours a lifecycle it does not have.
//
// ⚑ THE ONE THAT MATTERS MOST: DELETING IS NOT UNSUBSCRIBING. The only way off the list was
// removeSub(), which deletes the row. Delete the row and the next CSV import — from the same shop
// till, the same event signup sheet — adds them straight back, and the first thing they get is the
// mail they asked to stop. A withdrawal of consent must OUTLIVE the record it was withdrawn from.
// That is the whole reason a suppression list exists, and it is the one thing this tool did not have.
//
// Pure: no clock, no storage, no network. The caller passes `now`.

export const ACTIVE = 'active';
export const PENDING = 'pending';             // asked to join, has not confirmed — double opt-in
export const UNSUBSCRIBED = 'unsubscribed';   // asked to leave. permanent unless THEY come back
export const BOUNCED = 'bounced';             // the address does not exist
export const COMPLAINED = 'complained';       // reported the mail as spam. hardest stop of all

/** Statuses that must never receive another send. Complained is here for a legal reason, not a tidy one. */
const SILENT = new Set([UNSUBSCRIBED, BOUNCED, COMPLAINED]);

/**
 * One address, one spelling.
 *
 * ⚑ `Foo@Bar.com` and `foo@bar.com` are the same person, and a list that thinks otherwise emails them
 * twice and then honours their unsubscribe only once. Trim and lowercase — nothing cleverer. Stripping
 * dots or +tags is a Gmail habit that silently merges two different people at most other providers.
 */
export function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

/**
 * Deliberately loose. Guessing at exotic-but-valid addresses rejects real people.
 *
 * The 254 is the real limit an address can be delivered to. A minimum-length check sat here too,
 * until the gate showed that loosening it by one changed nothing — the pattern below already needs
 * five characters, so the check could never fire. A guard that cannot fail is not protecting anything.
 */
export function isEmail(value) {
  const e = normalizeEmail(value);
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/** The status of a record, defaulting to active only for a record that plainly is one. */
export function statusOf(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const s = typeof sub.status === 'string' ? sub.status.trim().toLowerCase() : '';
  if (s === '') return ACTIVE;                       // written before statuses existed
  return s;
}

/**
 * ⚑ THE ONE GATE. Everything that sends must ask this and nothing else.
 *
 * Unknown statuses are treated as DO NOT SEND. A status this kernel has never heard of arrived from
 * somewhere — a future version, a hand-edited export — and the safe reading of "I do not understand
 * this person's wishes" is silence.
 */
export function canSend(sub) {
  const s = statusOf(sub);
  if (s === null) return false;
  if (!isEmail(sub.email)) return false;
  return s === ACTIVE;
}

/**
 * Who a send actually goes to — deduplicated by address.
 *
 * ⚑ A CSV import adds the same person again under a different spelling, and without this they get
 * every newsletter twice from a list that shows them once.
 */
export function recipientsOf(subscribers) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const seen = new Set();
  const out = [];
  for (const sub of list) {
    if (!canSend(sub)) continue;
    const e = normalizeEmail(sub.email);
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(sub);
  }
  return out;
}

/** Everyone who must never be mailed again, as bare addresses. This IS the suppression list. */
export function suppressed(subscribers) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const out = new Set();
  for (const sub of list) {
    // No guard needed for garbage rows: statusOf() answers null for anything that is not a record,
    // and null is not a silent status. A second guard saying the same thing is one the gate can
    // rewrite either way without a test noticing.
    if (SILENT.has(statusOf(sub))) out.add(normalizeEmail(sub.email));
  }
  out.delete('');
  return out;
}

/** Find one record by address, whatever it was capitalised as. */
export function findByEmail(subscribers, email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  const list = Array.isArray(subscribers) ? subscribers : [];
  return list.find(s => s && typeof s === 'object' && normalizeEmail(s.email) === e) || null;
}

/**
 * The token that goes in the unsubscribe link.
 *
 * ⚑ AND IT REFUSES A GUESSABLE ONE. If ids are `1`, `2`, `3`, then `?unsubscribe=4` unsubscribes a
 * stranger, and one bored recipient can empty the whole list. Rather than invent randomness in a pure
 * kernel, this REFUSES to build a link out of an id too short or too orderly to be private, so the
 * fault surfaces at the sender rather than at the victim.
 */
export function unsubTokenOf(sub) {
  const id = sub && sub.id != null ? String(sub.id) : '';
  if (id.length < 8) return null;                    // a counter, or nothing at all
  if (/^\d+$/.test(id)) return null;                 // digits only is a counter however long
  return id;
}

export function findByToken(subscribers, token) {
  const t = typeof token === 'string' ? token.trim() : '';
  if (t.length < 8 || /^\d+$/.test(t)) return null;  // never honour a token we would not have issued
  const list = Array.isArray(subscribers) ? subscribers : [];
  return list.find(s => s && typeof s === 'object' && String(s.id) === t) || null;
}

/**
 * ⚑ UNSUBSCRIBE MARKS, IT NEVER DELETES. The tombstone is the point: it is what stops the next import
 * putting them back. Returns a NEW list.
 *
 * Unsubscribing somebody who is not on the list still records the tombstone, because that is exactly
 * the case that matters — a forwarded email, an address on a sheet about to be imported.
 */
export function unsubscribe(subscribers, emailOrToken, now, opts) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const o = (opts && typeof opts === 'object') ? opts : {};
  const status = SILENT.has(o.as) ? o.as : UNSUBSCRIBED;
  const t = timeOrNull(now);

  const found = findByToken(list, emailOrToken) || findByEmail(list, emailOrToken);
  if (found) {
    if (SILENT.has(statusOf(found))) {
      return { ok: true, already: true, reason: 'already off the list', subscribers: list };
    }
    return {
      ok: true, already: false, reason: 'taken off the list',
      subscribers: list.map(s => s === found
        ? { ...s, status, unsubscribedAt: t, unsubscribeReason: reasonText(o.reason) }
        : s),
    };
  }

  const email = normalizeEmail(emailOrToken);
  if (!isEmail(email)) return { ok: false, already: false, reason: 'that is not an address we can act on', subscribers: list };

  // Not on the list, but the tombstone still has to exist or an import will add them.
  return {
    ok: true, already: false, reason: 'taken off the list',
    subscribers: [...list, {
      id: null, email, name: '', source: 'unsubscribe-link',
      addedAt: t, status, unsubscribedAt: t, unsubscribeReason: reasonText(o.reason),
    }],
  };
}

/**
 * ⚑ ADDING SOMEBODY CANNOT UNDO THEIR LEAVING. This is the rule the whole file exists for. An import,
 * a signup form filled in by somebody else, a re-typed address at a till — none of them may bring a
 * suppressed person back. Only the person themselves can, through resubscribe().
 */
export function addSubscriber(subscribers, candidate, now, opts) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const o = (opts && typeof opts === 'object') ? opts : {};
  const c = (candidate && typeof candidate === 'object') ? candidate : {};
  const email = normalizeEmail(c.email);
  const t = timeOrNull(now);

  if (!isEmail(email)) return { ok: false, reason: 'that is not a real email address', subscribers: list };

  const existing = findByEmail(list, email);
  if (existing) {
    const s = statusOf(existing);
    if (SILENT.has(s)) {
      return {
        ok: false,
        reason: s === UNSUBSCRIBED
          ? 'that address asked to be taken off this list'
          : `that address is suppressed (${s})`,
        suppressed: true,
        subscribers: list,
      };
    }
    return { ok: false, reason: 'already on the list', subscribers: list };
  }

  const status = o.requireConfirm === true ? PENDING : ACTIVE;
  return {
    ok: true, reason: status === PENDING ? 'confirmation needed' : 'added',
    subscribers: [...list, { ...c, email, addedAt: t, status }],
  };
}

/**
 * Somebody who left, coming back of their own accord.
 *
 * ⚑ Guarded by an explicit `byPerson`, because the whole value of the suppression list is that no
 * amount of importing can clear it. Making the exception loud is what keeps it from being used by
 * accident. A complaint is never reversed here at all — that one is not the sender's to undo.
 */
export function resubscribe(subscribers, email, now, opts) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const o = (opts && typeof opts === 'object') ? opts : {};
  if (o.byPerson !== true) {
    return { ok: false, reason: 'only the person themselves can rejoin a list they left', subscribers: list };
  }
  const found = findByEmail(list, email);
  if (!found) return { ok: false, reason: 'not on the list', subscribers: list };
  if (statusOf(found) === COMPLAINED) {
    return { ok: false, reason: 'that address reported this list as spam and cannot be re-added here', subscribers: list };
  }
  return {
    ok: true, reason: 'back on the list',
    subscribers: list.map(s => s === found
      ? { ...s, status: ACTIVE, resubscribedAt: timeOrNull(now), unsubscribedAt: null }
      : s),
  };
}

/** A bounced address is suppressed the same way — the difference is only in what it tells the sender. */
export function markBounced(subscribers, email, now) {
  return unsubscribe(subscribers, email, now, { as: BOUNCED, reason: 'delivery failed' });
}

/** What the sender is about to do, before they do it. */
export function sendSummary(subscribers) {
  const list = Array.isArray(subscribers) ? subscribers : [];
  const to = recipientsOf(list);
  // ⚑ A row that is not a record is COUNTED, as unreadable. Skipping it made the breakdown add up to
  // less than the total, and a sender reading "412 subscribers" over a breakdown of 409 has no way to
  // know the three missing ones exist, let alone that they will never be mailed.
  const counts = {};
  for (const sub of list) {
    const s = statusOf(sub) || 'unreadable';
    counts[s] = (counts[s] || 0) + 1;
  }
  return { total: list.length, sending: to.length, suppressed: suppressed(list).size, byStatus: counts };
}

function timeOrNull(now) {
  const n = Number(now);
  return Number.isFinite(n) ? n : null;
}

function reasonText(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : '';
}

export default {
  ACTIVE, PENDING, UNSUBSCRIBED, BOUNCED, COMPLAINED,
  normalizeEmail, isEmail, statusOf, canSend, recipientsOf, suppressed,
  findByEmail, findByToken, unsubTokenOf, unsubscribe, addSubscriber, resubscribe, markBounced, sendSummary,
};
