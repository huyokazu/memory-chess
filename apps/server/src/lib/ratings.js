import mongoose from 'mongoose';
import Match from '../models/Match.js';
import User from '../models/User.js';
import { eloChanges } from './rules.js';

// The match ledger and both account updates commit in one MongoDB transaction.
// A retry sees "settled" and cannot award the same game's Elo twice.
export async function settleRating(matchId) {
  return mongoose.connection.transaction(async (session) => {
    const match = await Match.findById(matchId).session(session);
    if (!match || match.status !== 'finished' || match.ratingStatus !== 'pending') return match;
    const white = await User.findById(match.white.id).session(session);
    const black = await User.findById(match.black.id).session(session);
    if (!white || !black) throw new Error('A rated match references a missing user');
    const delta = eloChanges(match.white.elo, match.black.elo, match.winner);
    match.ratingChanges = {};
    for (const [color, user] of [['w', white], ['b', black]]) {
      const before = user.elo;
      user.elo += delta[color];
      const stat = match.winner === null ? 'draws' : match.winner === color ? 'wins' : 'losses';
      user[stat] += 1;
      match.ratingChanges[color] = { before, after: user.elo, delta: delta[color] };
      await user.save({ session });
    }
    match.markModified('ratingChanges');
    match.ratingStatus = 'settled';
    await match.save({ session });
    return match;
  });
}

export async function recoverMatches() {
  await Match.updateMany({ status: 'active' }, {
    $set: { status: 'aborted', reason: 'server_restart', finishedAt: new Date(), ratingStatus: 'unrated' },
  });
  for (const match of await Match.find({ status: 'finished', ratingStatus: 'pending' })) {
    await settleRating(match.id);
  }
}
