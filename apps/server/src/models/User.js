import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  passwordHash: { type: String, required: true, select: false },
  elo: { type: Number, default: 1200, required: true },
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },
  draws: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export function publicUser(user) {
  return {
    id: String(user._id), username: user.username, elo: user.elo,
    wins: user.wins, losses: user.losses, draws: user.draws,
  };
}

export default mongoose.model('User', userSchema);
