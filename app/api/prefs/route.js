import { route, body, json, HttpError } from '@/lib/api';
import { THEMES } from '@/lib/arcade/data';
import User from '@/models/User';

/* PUT { theme } -> saves the player's handset colour. */
export const PUT = route(async (request, session) => {
  const { theme } = await body(request);
  if(!THEMES.includes(theme)) throw new HttpError(400, 'Unknown colour.');
  await User.updateOne({ _id:session.id }, { theme });
  return json({ theme });
}, { auth:true });
