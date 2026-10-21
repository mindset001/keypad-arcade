import mongoose from 'mongoose';

/* One row per rate-limit key (e.g. "login:name:ada"). MongoDB deletes the row itself once resetAt passes. */
const RateLimitSchema = new mongoose.Schema({
  _id:     { type:String },
  count:   { type:Number, required:true },
  resetAt: { type:Date, required:true, index:{ expireAfterSeconds:0 } }
}, { versionKey:false });

if(process.env.NODE_ENV !== 'production') try{ mongoose.deleteModel('RateLimit'); }catch{}
export default mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);
