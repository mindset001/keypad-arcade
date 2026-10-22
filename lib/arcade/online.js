/* Online play, peer to peer. The two browsers meet through a room code (the server only passes the
   WebRTC handshake, see app/api/rooms), then talk directly over two data channels:
     "ctl"  reliable + ordered    : hello, key presses, the end of the match
     "st"   unreliable, unordered : the host's game state, many times a second (old state is worthless)
   The HOST runs the game; the GUEST sends keys and draws what the host sends.
   `conn` has send(type, data), sendState(data), on(type, fn), onState(fn), onClose(fn) and close(). */
import { api } from './api.js';

const ICE = { iceServers:[{ urls:['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('cancelled')); }, { once:true }); });

/* wait until the browser has found its network addresses, so one message carries everything (no trickling) */
function gathered(pc, ms = 4000){
  return new Promise(res => {
    if(pc.iceGatheringState === 'complete') return res();
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(t); res(); };
    const check = () => { if(pc.iceGatheringState === 'complete') done(); };
    const t = setTimeout(done, ms); pc.addEventListener('icegatheringstatechange', check);
  });
}

function wrap(pc, ctl, st){
  const handlers = {}; let stateFn = null, closeFn = null, closed = false;
  const fireClose = () => { if(closed) return; closed = true; closeFn && closeFn(); };
  ctl.onmessage = e => { try{ const m = JSON.parse(e.data); handlers[m.t] && handlers[m.t](m.d); }catch{} };
  st.onmessage = e => { try{ stateFn && stateFn(JSON.parse(e.data)); }catch{} };
  ctl.onclose = fireClose;
  pc.addEventListener('connectionstatechange', () => { if(['failed', 'closed', 'disconnected'].includes(pc.connectionState)) fireClose(); });
  return {
    send(t, d){ if(ctl.readyState === 'open') ctl.send(JSON.stringify({ t, d })); },
    sendState(d){ if(st.readyState === 'open') st.send(JSON.stringify(d)); },
    on(t, fn){ handlers[t] = fn; }, onState(fn){ stateFn = fn; }, onClose(fn){ closeFn = fn; },
    get open(){ return ctl.readyState === 'open' && !closed; },
    close(){ closed = true; try{ ctl.close(); st.close(); pc.close(); }catch{} }
  };
}
const opened = (ch, ms = 15000) => new Promise((res, rej) => {
  if(ch.readyState === 'open') return res();
  const t = setTimeout(() => rej(new Error('Could not connect to your friend.')), ms);
  ch.addEventListener('open', () => { clearTimeout(t); res(); }, { once:true });
});

/* HOST: open a room. Returns { code, cancel(), connected } where `connected` resolves with a conn once a friend joins. */
export async function createRoom(game, name){
  const pc = new RTCPeerConnection(ICE), ctl = pc.createDataChannel('ctl'), st = pc.createDataChannel('st', { ordered:false, maxRetransmits:0 });
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  const r = await api('/rooms', 'POST', { game, name, offer:pc.localDescription.sdp });
  if(!r.ok){ pc.close(); throw new Error(r.data && r.data.error || 'Could not open a room.'); }
  const { code, token } = r.data, ac = new AbortController();
  const close = () => api(`/rooms/${code}`, 'DELETE', { token }).catch(() => {});
  const connected = (async () => {
    try{
      for(let i = 0; i < 400; i++){                                  // wait up to ~10 minutes for a friend
        await sleep(1500, ac.signal);
        const p = await api(`/rooms/${code}`, 'GET');
        if(p.ok && p.data.answer){
          await pc.setRemoteDescription({ type:'answer', sdp:p.data.answer });
          await Promise.all([opened(ctl), opened(st)]); close();
          return { conn:wrap(pc, ctl, st), guestName:p.data.guestName };
        }
        if(p.status === 404) throw new Error('The room closed.');
      }
      throw new Error('Nobody joined. Try again.');
    }catch(e){ pc.close(); throw e; }
  })();
  return { code, connected, cancel(){ ac.abort(); pc.close(); close(); } };
}

/* GUEST: join with a code. Resolves { conn, game, hostName }. */
export async function joinRoom(code, name){
  const r = await api(`/rooms/${code}`, 'GET');
  if(!r.ok) throw new Error(r.data && r.data.error || 'Could not find that room.');
  if(r.data.answer) throw new Error('That room is already full.');
  const pc = new RTCPeerConnection(ICE), chans = {};
  const both = new Promise(res => pc.addEventListener('datachannel', e => { chans[e.channel.label] = e.channel; if(chans.ctl && chans.st) res(); }));
  await pc.setRemoteDescription({ type:'offer', sdp:r.data.offer });
  await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
  const a = await api(`/rooms/${code}`, 'POST', { name, answer:pc.localDescription.sdp });
  if(!a.ok){ pc.close(); throw new Error(a.data && a.data.error || 'Could not join.'); }
  try{ await Promise.race([both, sleep(15000).then(() => { throw new Error('Could not connect to your friend.'); })]); await Promise.all([opened(chans.ctl), opened(chans.st)]); }
  catch(e){ pc.close(); throw e; }
  return { conn:wrap(pc, chans.ctl, chans.st), game:r.data.game, hostName:r.data.hostName };
}
