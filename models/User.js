import mongoose from 'mongoose';
import { THEMES } from '../lib/arcade/data.js';

const UserSchema = new mongoose.Schema({
  name:      { type:String, required:true },                         // as typed, for display
  nameLower: { type:String, required:true, unique:true, index:true }, // case-insensitive identity
  passHash:  { type:String, required:true, select:false },
  theme:     { type:String, enum:THEMES, default:THEMES[0] }                   // handset colour
}, { timestamps:true });

/* dev hot-reload: drop a cached model so a changed schema (e.g. a new field) is never silently ignored */
if(process.env.NODE_ENV !== 'production') try{ mongoose.deleteModel('User'); }catch{}
export default mongoose.models.User || mongoose.model('User', UserSchema);
