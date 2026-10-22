import mongoose from 'mongoose';

/* A waiting room for an online match. It only carries the WebRTC "handshake" (an offer from the host,
   an answer from the guest); the game itself then runs directly between the two browsers. Rooms expire on their own. */
const RoomSchema = new mongoose.Schema({
  code:      { type:String, required:true, unique:true },
  game:      { type:String, enum:['tennis', 'soccer'], required:true },
  hostName:  { type:String, required:true },
  guestName: { type:String, default:'' },
  token:     { type:String, required:true },            // only the host knows it (needed to close the room)
  offer:     { type:String, required:true },
  answer:    { type:String, default:'' },
  createdAt: { type:Date, default:Date.now, expires:900 } // gone after 15 minutes
});

/* dev hot-reload: drop a cached model so a changed schema is never silently ignored */
if(process.env.NODE_ENV !== 'production') try{ mongoose.deleteModel('Room'); }catch{}
export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
