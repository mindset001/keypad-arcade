import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name:      { type:String, required:true },                         // as typed, for display
  nameLower: { type:String, required:true, unique:true, index:true }, // case-insensitive identity
  passHash:  { type:String, required:true, select:false }
}, { timestamps:true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
