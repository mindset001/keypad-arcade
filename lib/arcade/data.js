/* Names and help text shared by the menus. */
export const GAMES = { snake:'Snake Xenzia', roll:'Rapid Roll', bounce:'Bounce', soccer:'Soccer League' };
export const GAME_IDS = Object.keys(GAMES);
export const THEMES = ['violet', 'blue', 'red', 'black']; // handset colours; the first is the default
export const THEME_NAMES = { violet:'Violet', blue:'Blue', red:'Red', black:'Black' };
export const MAZES = ['No maze','Box','Tunnel','Mill','Rails'];
export const HELP = {
  snake:[
    'Eat the food to grow.',
    'Hitting a wall or yourself ends the game. With no maze, the edges wrap around.',
    '◂ ▸ ▲ ▼ turn the snake.',
    'Every 5th food a bug appears for a few seconds. Catch it for a big bonus.',
    'Higher levels are faster and score more.',
    'Touch controls: swipe anywhere on the screen to turn.'
  ],
  roll:[
    'The platforms scroll up. Keep the ball alive.',
    '◂ ▸ steer the ball. It falls from one platform to the next.',
    'Spiked platforms and the spikes on the ceiling cost a life.',
    'Land on a heart to win a life back.',
    'Touch controls: hold the big ◀ ▶ buttons.'
  ],
  soccer:[
    'Two teams of five. Most goals in two halves wins. Walls keep the ball in play.',
    '◂ ▸ ▲ ▼ run. You drive the player with the arrow above them, whoever is nearest the ball.',
    'With the ball, Select: tap to pass, hold then let go to shoot. Hold longer for a harder shot. Face a corner of the goal to aim.',
    'Without the ball, Select: slide tackle.',
    'Quick: one game against the computer. League: play all 5 clubs, 3 points a win.',
    'Touch controls: drag the stick to run, tap KICK to pass, hold it to shoot.'
  ],
  bounce:[
    'The ball bounces all by itself. ◂ ▸ steer it.',
    'Hold ▲ for a high bounce, hold ▼ for a low one. On a phone just tap: ▲ or ▼ sets your next bounce.',
    'Collect every ring (O) to open the exit gate, then roll through it.',
    'Spikes, pits and bugs cost a life. A flag is a checkpoint.',
    'Pump (P) makes the ball big: it bounces lower and smashes checker blocks, but cannot fit narrow gaps.',
    'Deflator (D) makes it small again. Hearts give a life, gems give points.',
    'Touch controls: ◀ ▶ to roll. Tap HIGH or LOW to pick your next bounce.'
  ]
};
