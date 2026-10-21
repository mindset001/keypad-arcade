import mongoose from 'mongoose';

/* One Soccer League season per player. `rows` is the 6-club table (index 0 is the player). */
const LeagueSchema = new mongoose.Schema({
  user:  { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, unique:true },
  round: { type:Number, required:true, min:0, max:5 },
  rows:  { type:[{ _id:false, p:Number, w:Number, d:Number, l:Number, gf:Number, ga:Number, pts:Number }], required:true }
}, { timestamps:true });

/* dev hot-reload: drop a cached model so a changed schema (e.g. a new field) is never silently ignored */
if(process.env.NODE_ENV !== 'production') try{ mongoose.deleteModel('League'); }catch{}
export default mongoose.models.League || mongoose.model('League', LeagueSchema);
