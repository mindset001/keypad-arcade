import mongoose from 'mongoose';

import { GAME_IDS } from '../lib/arcade/data.js'; // one shared list of games
export { GAME_IDS };

const ScoreSchema = new mongoose.Schema({
  user:  { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  name:  { type:String, required:true },
  game:  { type:String, enum:GAME_IDS, required:true },
  score: { type:Number, required:true, min:1 }
}, { timestamps:true });

ScoreSchema.index({ game:1, score:-1, createdAt:1 });   // leaderboard
ScoreSchema.index({ user:1, game:1, score:-1 });        // a player's own list / best

/* dev hot-reload: drop a cached model so a changed schema (e.g. a new field) is never silently ignored */
if(process.env.NODE_ENV !== 'production') try{ mongoose.deleteModel('Score'); }catch{}
export default mongoose.models.Score || mongoose.model('Score', ScoreSchema);
