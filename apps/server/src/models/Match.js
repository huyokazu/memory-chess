import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, required: true },
  elo: { type: Number, required: true },
  bot: { type: Boolean, default: false },
}, { _id: false });

const matchSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  mode: { type: String, enum: ['hardcore', 'peeks'], required: true },
  kind: { type: String, enum: ['ranked', 'party', 'bot'], required: true },
  rated: { type: Boolean, required: true },
  white: { type: playerSchema, required: true },
  black: { type: playerSchema, required: true },
  status: { type: String, enum: ['active', 'finished', 'aborted'], default: 'active', index: true },
  winner: { type: String, enum: ['w', 'b', null], default: null },
  reason: String,
  pgn: String,
  finalFen: String,
  finishedAt: Date,
  ratingStatus: { type: String, enum: ['pending', 'settled', 'unrated'], default: 'unrated', index: true },
  ratingChanges: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

matchSchema.index({ 'white.id': 1, createdAt: -1 });
matchSchema.index({ 'black.id': 1, createdAt: -1 });

export default mongoose.model('Match', matchSchema);
