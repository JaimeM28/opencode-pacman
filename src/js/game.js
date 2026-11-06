// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    releaseElapsed: 0,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseDelay: g.releaseDelay,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function findGhostDirection( grid, ghost, target, choices = Object.keys( DIRS ) ) {
  const width = grid[ 0 ].length;
  const queue = [ { x: ghost.x, y: ghost.y, direction: null } ];
  const visited = new Set( [ ghost.y * width + ghost.x ] );
  let bestDirection = choices.find( ( direction ) => canMove( grid, ghost.x, ghost.y, direction, 'ghost' ) ) || ghost.dir;
  let bestDistance = Infinity;

  for ( let index = 0; index < queue.length; index++ ) {
    const cell = queue[ index ];
    const distance = Math.abs( cell.x - target.x ) + Math.abs( cell.y - target.y );
    // BFS conserva la ruta más corta también al elegir un objetivo alternativo.
    if ( distance < bestDistance ) {
      bestDistance = distance;
      bestDirection = cell.direction || bestDirection;
    }
    if ( distance === 0 ) break;

    const directions = index === 0 ? choices : Object.keys( DIRS );
    for ( const direction of directions ) {
      if ( !canMove( grid, cell.x, cell.y, direction, 'ghost' ) ) continue;
      const step = DIRS[ direction ];
      const x = ( cell.x + step.x + width ) % width;
      const y = cell.y + step.y;
      const key = y * width + x;
      if ( visited.has( key ) ) continue;
      visited.add( key );
      queue.push( { x, y, direction: cell.direction || direction } );
    }
  }

  return bestDirection;
}

function getGhostTarget( game, ghost ) {
  const pacman = game.pacman;
  const position = { x: Math.round( pacman.x ), y: Math.round( pacman.y ) };
  const direction = DIRS[ pacman.dir ];

  if ( ghost.kind === 'ambusher' ) {
    return { x: position.x + direction.x * 4, y: position.y + direction.y * 4 };
  }
  if ( ghost.kind === 'coordinated' ) {
    const chaser = game.ghosts.find( ( candidate ) => candidate.kind === 'chaser' );
    const pivot = { x: position.x + direction.x * 2, y: position.y + direction.y * 2 };
    return { x: pivot.x * 2 - Math.round( chaser.x ), y: pivot.y * 2 - Math.round( chaser.y ) };
  }
  if ( ghost.kind === 'shy' ) {
    const distance = Math.abs( ghost.x - position.x ) + Math.abs( ghost.y - position.y );
    if ( distance < 8 ) return { x: 1, y: game.grid.length - 2 };
  }

  return position;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = getGhostTarget( game, g );

  if ( g.kind === 'chaser' ) {
    g.dir = findGhostDirection( grid, g, target );
    return;
  }

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  g.dir = findGhostDirection( grid, g, target, choices );
}

function moveGhost( game, g ) {
  if ( game.releaseElapsed < g.releaseDelay ) return;

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  game.releaseElapsed = 0;
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game, deltaSeconds = 0 ) {
  game.releaseElapsed += deltaSeconds;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( game.releaseElapsed >= g.releaseDelay && collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
