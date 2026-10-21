/* Makes a registered player an admin (or takes it away). Admins are set ONLY here, by someone with
   access to the database: there is deliberately no web page or API that can grant the role.

     npm run admin -- <name>            make <name> an admin
     npm run admin -- <name> --remove   take admin away from <name>
     npm run admin -- --list            show the current admins

   `npm run admin` loads .env.local, so it works on the database your app uses. It prints that
   database's name first so you can check you are changing the one you meant to. */
import mongoose from 'mongoose';
import User from '../models/User.js';

const args = process.argv.slice(2);
const remove = args.includes('--remove'), list = args.includes('--list');
const name = args.find(a => !a.startsWith('--'));

if(!process.env.MONGODB_URI){ console.error('MONGODB_URI is not set. Run this as `npm run admin -- <name>` so .env.local is loaded.'); process.exit(1); }
if(!list && !name){ console.error('Usage: npm run admin -- <name> [--remove]   |   npm run admin -- --list'); process.exit(1); }

try{
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS:10000 });
  console.log(`Database: ${mongoose.connection.name}`);
  if(list){
    const admins = await User.find({ role:'admin' }).select('name createdAt').sort({ createdAt:1 }).lean();
    console.log(admins.length ? admins.map(a => `  ${a.name}`).join('\n') : '  (no admins yet)');
  } else {
    const lower = name.trim().toLowerCase();
    const r = await User.updateOne({ nameLower:lower }, { role:remove ? 'user' : 'admin' });
    if(r.matchedCount === 0){ console.error(`No player called "${name}" in this database. They must register first (names are not case-sensitive).`); process.exitCode = 1; }
    else console.log(remove ? `${name} is no longer an admin.` : `${name} is now an admin. They can open /admin while logged in.`);
  }
}catch(e){ console.error('Failed:', e.name); process.exitCode = 1; }
finally{ await mongoose.disconnect().catch(() => {}); }
