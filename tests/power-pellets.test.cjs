const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const test = require( 'node:test' );
const vm = require( 'node:vm' );

function loadGame() {
  const context = vm.createContext( {} );
  context.window = context;
  for ( const name of [ 'maze', 'game', 'render' ] ) {
    loadScript( context, name );
  }
  return context;
}

function loadScript( context, name ) {
  const filename = path.join( __dirname, '..', 'src', 'js', `${name}.js` );
  vm.runInContext( fs.readFileSync( filename, 'utf8' ), context, { filename } );
}

function freezeActors( game ) {
  game.pacman.speed = 0;
  for ( const ghost of game.ghosts ) ghost.speed = 0;
}

function countPellets( grid ) {
  return grid.flat().filter( tile => tile === 4 ).length;
}

function distanceMap( grid, target ) {
  const width = grid[ 0 ].length;
  const queue = [ target ];
  const distances = new Map( [ [ target.y * width + target.x, 0 ] ] );
  for ( let index = 0; index < queue.length; index++ ) {
    const cell = queue[ index ];
    for ( const [ dx, dy ] of [ [ -1, 0 ], [ 1, 0 ], [ 0, -1 ], [ 0, 1 ] ] ) {
      let x = cell.x + dx;
      const y = cell.y + dy;
      if ( y === 14 ) x = ( x + width ) % width;
      if ( y < 0 || y >= grid.length || x < 0 || x >= width || grid[ y ][ x ] === 1 ) continue;
      const key = y * width + x;
      if ( distances.has( key ) ) continue;
      distances.set( key, distances.get( cell.y * width + cell.x ) + 1 );
      queue.push( { x, y } );
    }
  }
  return distances;
}

test( 'four pellets replace dots and count toward victory', () => {
  const api = loadGame();
  const game = api.createGame();
  assert.equal( countPellets( game.grid ), 4 );
  for ( const [ x, y ] of [ [ 1, 1 ], [ 26, 1 ], [ 1, 29 ], [ 26, 29 ] ] ) {
    assert.equal( game.grid[ y ][ x ], 4 );
    assert.equal( api.isWall( game.grid, x, y, 'pacman' ), false );
  }
  assert.equal( game.dotsRemaining, game.grid.flat().filter( tile => tile === 2 || tile === 4 ).length );
} );

test( 'each pellet awards 50 points once and resets power and combo', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  const originalMaze = JSON.stringify( api.MAZE );
  const remaining = game.dotsRemaining;
  for ( const [ x, y ] of [ [ 1, 1 ], [ 26, 1 ], [ 1, 29 ], [ 26, 29 ] ] ) {
    game.powerRemaining = 1;
    game.ghostCombo = 3;
    Object.assign( game.pacman, { x, y } );
    const score = game.score;
    api.update( game, 0.5 );
    assert.equal( game.score, score + 50 );
    assert.equal( game.grid[ y ][ x ], 0 );
    assert.equal( game.powerRemaining, 6 );
    assert.equal( game.ghostCombo, 0 );
    api.update( game, 0.5 );
    assert.equal( game.score, score + 50 );
    assert.equal( game.powerRemaining, 5.5 );
  }
  assert.equal( game.dotsRemaining, remaining - 4 );
  assert.equal( JSON.stringify( api.MAZE ), originalMaze );
} );

test( 'pellet consumption protects against a collision in the same update', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  Object.assign( game.pacman, { x: 1, y: 1 } );
  Object.assign( game.ghosts[ 0 ], { x: 1, y: 1 } );
  api.update( game, 0.5 );
  assert.equal( game.lives, 3 );
  assert.equal( game.score, 250 );
  assert.equal( game.powerRemaining, 6 );
  assert.equal( game.ghosts[ 0 ].mode, 'returning' );
  api.update( game, 0.5 );
  assert.equal( game.score, 250 );
} );

test( 'combo awards 200, 400, 800, 1600 and caps subsequent rewards', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  game.releaseElapsed = 10;
  game.powerRemaining = 6;
  for ( const ghost of game.ghosts ) {
    ghost.x = game.pacman.x;
    ghost.y = game.pacman.y;
  }
  api.update( game, 0 );
  assert.equal( game.score, 3000 );
  assert.equal( game.ghostCombo, 4 );
  assert.equal( game.lives, 3 );
  api.update( game, 0 );
  assert.equal( game.score, 3000 );
  game.ghosts[ 0 ].mode = 'active';
  api.update( game, 0 );
  assert.equal( game.score, 4600 );
  assert.equal( game.ghostCombo, 5 );
} );

test( 'power expiration resets the combo and restores lethal collisions', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  game.powerRemaining = 0.5;
  game.ghostCombo = 3;
  Object.assign( game.ghosts[ 0 ], { x: game.pacman.x, y: game.pacman.y } );
  api.update( game, 0.5 );
  assert.equal( game.powerRemaining, 0 );
  assert.equal( game.ghostCombo, 0 );
  assert.equal( game.lives, 2 );
  api.updateTimers( game, 10 );
  assert.equal( game.powerRemaining, 0 );
  assert.ok( game.ghosts.every( ghost => ghost.respawnRemaining === 0 ) );
} );

test( 'frightened ghosts maximize path distance, including tunnel routes', () => {
  const api = loadGame();
  const game = api.createGame();
  game.releaseElapsed = 10;
  game.powerRemaining = 6;
  const width = game.grid[ 0 ].length;
  let checks = 0;
  for ( const target of [ { x: 1, y: 1 }, { x: 26, y: 29 }, { x: 0, y: 14 }, { x: 13, y: 23 } ] ) {
    Object.assign( game.pacman, target );
    const distances = distanceMap( game.grid, target );
    for ( const [ key ] of distances ) {
      const ghost = game.ghosts[ checks % 4 ];
      ghost.x = key % width;
      ghost.y = Math.floor( key / width );
      const neighbors = api.getGhostNeighbors( game.grid, ghost );
      const maximum = Math.max( ...neighbors.map( cell => distances.get( cell.y * width + cell.x ) ) );
      api.decideGhost( game, ghost );
      const next = neighbors.find( cell => cell.direction === ghost.dir );
      assert.ok( next );
      assert.equal( distances.get( next.y * width + next.x ), maximum );
      assert.equal( ghost.speed, 0.1 );
      checks++;
    }
  }
  assert.ok( checks > 1000 );
  Object.assign( game.pacman, { x: 3, y: 1 } );
  Object.assign( game.ghosts[ 0 ], { x: 2, y: 1, dir: 'right' } );
  api.decideGhost( game, game.ghosts[ 0 ] );
  assert.equal( game.ghosts[ 0 ].dir, 'left' );
  Object.assign( game.pacman, { x: 27.9, y: 14 } );
  assert.equal( api.getPacmanCell( game ).x, 0 );
} );

test( 'all ghosts return by a shortest route and recover for two seconds', () => {
  const api = loadGame();
  for ( const home of api.GHOST_STARTS ) {
    const game = api.createGame();
    game.releaseElapsed = 10;
    game.powerRemaining = 6;
    const ghost = game.ghosts.find( candidate => candidate.kind === home.kind );
    Object.assign( ghost, { x: 0, y: 14, mode: 'returning' } );
    const distance = distanceMap( game.grid, home ).get( 14 * game.grid[ 0 ].length );
    let frames = 0;
    while ( ghost.mode === 'returning' && frames < 2000 ) {
      api.moveGhost( game, ghost );
      frames++;
    }
    assert.equal( frames, distance * 10 );
    assert.equal( ghost.mode, 'recovering' );
    assert.equal( ghost.respawnRemaining, 2 );
    assert.deepEqual( [ ghost.x, ghost.y ], [ home.x, home.y ] );
    api.updateTimers( game, 1.5 );
    api.moveGhost( game, ghost );
    assert.equal( ghost.mode, 'recovering' );
    assert.deepEqual( [ ghost.x, ghost.y ], [ home.x, home.y ] );
    api.updateTimers( game, 0.5 );
    api.moveGhost( game, ghost );
    assert.equal( ghost.mode, 'active' );
    assert.equal( api.isGhostVulnerable( game, ghost ), true );
    assert.equal( game.releaseElapsed, 12 );
    assert.equal( ghost.speed, 0.1 );
  }
} );

test( 'arrival starts the full recovery timer after movement', () => {
  const api = loadGame();
  const game = api.createGame();
  const ghost = game.ghosts[ 0 ];
  Object.assign( ghost, { x: 13, y: 12.9, dir: 'down', mode: 'returning' } );
  api.update( game, 0.5 );
  assert.equal( ghost.mode, 'recovering' );
  assert.equal( ghost.respawnRemaining, 2 );
} );

test( 'returning, recovering and initially waiting ghosts cannot collide', () => {
  const api = loadGame();
  for ( const power of [ 0, 6 ] ) {
    for ( const mode of [ 'returning', 'recovering', 'waiting' ] ) {
      const game = api.createGame();
      freezeActors( game );
      game.powerRemaining = power;
      const ghost = game.ghosts[ 0 ];
      Object.assign( ghost, { x: game.pacman.x, y: game.pacman.y } );
      ghost.mode = mode === 'waiting' ? 'active' : mode;
      ghost.releaseDelay = mode === 'waiting' ? 10 : 0;
      ghost.respawnRemaining = 2;
      api.update( game, 0.5 );
      assert.equal( game.lives, 3 );
      assert.equal( game.score, 0 );
    }
  }
} );

test( 'another pellet leaves returning and recovering ghosts in their states', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  Object.assign( game.pacman, { x: 1, y: 1 } );
  Object.assign( game.ghosts[ 0 ], { x: 1, y: 5, mode: 'returning' } );
  Object.assign( game.ghosts[ 1 ], { mode: 'recovering', respawnRemaining: 1.5 } );
  api.update( game, 0.5 );
  assert.equal( game.powerRemaining, 6 );
  assert.equal( game.ghosts[ 0 ].mode, 'returning' );
  assert.equal( game.ghosts[ 1 ].mode, 'recovering' );
  assert.equal( game.ghosts[ 1 ].respawnRemaining, 1 );
} );

test( 'initial release stays staggered and newly released ghosts are vulnerable', () => {
  const api = loadGame();
  for ( const time of [ 0, 1.5, 2, 3.5, 4, 5.5, 6 ] ) {
    const game = api.createGame();
    game.releaseElapsed = time;
    game.powerRemaining = 6;
    for ( const ghost of game.ghosts ) {
      const original = { x: ghost.x, y: ghost.y };
      api.moveGhost( game, ghost );
      const released = time >= ghost.releaseDelay;
      assert.equal( ghost.x !== original.x || ghost.y !== original.y, released );
      assert.equal( api.isGhostVulnerable( game, ghost ), released );
    }
  }
} );

test( 'normal personalities and colors resume after power expires', () => {
  const api = loadGame();
  const game = api.createGame();
  game.releaseElapsed = 10;
  const red = game.ghosts[ 0 ];
  game.powerRemaining = 6;
  assert.equal( api.getGhostColor( game, red ), '#2121ff' );
  game.powerRemaining = 1.9;
  assert.equal( api.getGhostColor( game, red ), '#2121ff' );
  game.powerRemaining = 1.6;
  assert.equal( api.getGhostColor( game, red ), '#fff' );
  api.updateTimers( game, 1.6 );
  const colors = { chaser: '#ff0000', ambusher: '#ffb8ff', coordinated: '#00ffff', shy: '#ffb852' };
  for ( const ghost of game.ghosts ) {
    assert.equal( api.getGhostColor( game, ghost ), colors[ ghost.kind ] );
  }
  Object.assign( red, { x: 13, y: 11, dir: 'right' } );
  Object.assign( game.pacman, { x: 12, y: 11, dir: 'left' } );
  api.decideGhost( game, red );
  assert.equal( red.dir, 'left' );
  const pink = game.ghosts[ 1 ];
  assert.deepEqual( [ api.getGhostTarget( game, pink ).x, api.getGhostTarget( game, pink ).y ], [ 8, 11 ] );
} );

test( 'render draws large pellets and only eyes for returning ghosts', () => {
  const api = loadGame();
  const game = api.createGame();
  const radii = [];
  const fills = [];
  const ctx = {
    beginPath() {}, lineTo() {}, closePath() {},
    arc( x, y, radius ) { radii.push( radius ); },
    fill() { fills.push( this.fillStyle ); },
  };
  api.drawDots( ctx, game.grid );
  assert.equal( radii.filter( radius => radius === 6 ).length, 4 );
  assert.equal( radii.length, game.dotsRemaining );
  fills.length = 0;
  game.ghosts[ 0 ].mode = 'returning';
  api.drawGhost( ctx, game.ghosts[ 0 ], '#ff0000' );
  assert.equal( fills.includes( '#ff0000' ), false );
  assert.equal( fills.filter( color => color === '#fff' ).length, 2 );
  assert.equal( fills.filter( color => color === '#0000bb' ).length, 2 );
} );

test( 'life loss resets ghost states and preserves consumed tiles and score', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  game.score = 500;
  game.grid[ 1 ][ 1 ] = 0;
  game.dotsRemaining--;
  const remaining = game.dotsRemaining;
  Object.assign( game.ghosts[ 0 ], { x: game.pacman.x, y: game.pacman.y } );
  game.ghosts[ 1 ].mode = 'returning';
  Object.assign( game.ghosts[ 2 ], { mode: 'recovering', respawnRemaining: 1 } );
  game.ghosts.reverse();
  api.update( game, 0.5 );
  assert.equal( game.lives, 2 );
  assert.equal( game.releaseElapsed, 0 );
  assert.equal( game.powerRemaining, 0 );
  assert.equal( game.ghostCombo, 0 );
  assert.equal( game.score, 500 );
  assert.equal( game.grid[ 1 ][ 1 ], 0 );
  assert.equal( game.dotsRemaining, remaining );
  for ( const ghost of game.ghosts ) {
    const home = api.GHOST_STARTS.find( start => start.kind === ghost.kind );
    assert.deepEqual( [ ghost.x, ghost.y ], [ home.x, home.y ] );
    assert.equal( ghost.mode, 'active' );
    assert.equal( ghost.respawnRemaining, 0 );
  }
  game.powerRemaining = 4;
  game.ghostCombo = 3;
  api.resetPositions( game );
  assert.equal( game.powerRemaining, 0 );
  assert.equal( game.ghostCombo, 0 );
} );

test( 'victory requires the last pellet and last life still produces a loss', () => {
  const api = loadGame();
  const game = api.createGame();
  freezeActors( game );
  game.state = 'playing';
  game.grid = game.grid.map( row => row.map( tile => tile === 2 || tile === 4 ? 0 : tile ) );
  game.grid[ 1 ][ 1 ] = 4;
  game.dotsRemaining = 1;
  api.update( game, 0 );
  assert.equal( game.state, 'playing' );
  Object.assign( game.pacman, { x: 1, y: 1 } );
  api.update( game, 0 );
  assert.equal( game.state, 'won' );
  assert.equal( game.dotsRemaining, 0 );
  const loss = api.createGame();
  freezeActors( loss );
  loss.lives = 1;
  Object.assign( loss.ghosts[ 0 ], { x: loss.pacman.x, y: loss.pacman.y } );
  api.update( loss, 0 );
  assert.equal( loss.state, 'lost' );
  assert.equal( loss.lives, 0 );
} );

test( 'browser entrypoint handles start, keyboard, game clock and restart', () => {
  const api = loadGame();
  const canvasContext = new Proxy( {}, { get: () => () => {} } );
  const handlers = {};
  const element = {
    getContext: () => canvasContext,
    classList: { add() {}, remove() {} },
    addEventListener( name, callback ) { handlers[ name ] = callback; },
  };
  api.document = {
    getElementById: () => element,
    addEventListener( name, callback ) { handlers[ name ] = callback; },
  };
  let callback;
  api.requestAnimationFrame = next => { callback = next; };
  loadScript( api, 'main' );
  const currentGame = () => vm.runInContext( 'game', api );
  callback( 0 );
  assert.equal( currentGame().state, 'start' );
  handlers.click();
  callback( 1000 );
  const game = currentGame();
  assert.equal( game.state, 'playing' );
  handlers.keydown( { key: 'ArrowUp', preventDefault() {} } );
  assert.equal( game.pacman.nextDir, 'up' );
  Object.assign( game.pacman, { x: 1, y: 1, speed: 0 } );
  callback( 1500 );
  assert.equal( game.powerRemaining, 6 );
  callback( 2000 );
  assert.equal( game.powerRemaining, 5.5 );
  game.state = 'won';
  callback( 3000 );
  assert.equal( game.powerRemaining, 5.5 );
  api.startGame();
  callback( 4000 );
  const fresh = currentGame();
  assert.equal( fresh.powerRemaining, 0 );
  assert.equal( fresh.ghostCombo, 0 );
  assert.equal( fresh.score, 0 );
  assert.equal( fresh.lives, 3 );
  assert.equal( countPellets( fresh.grid ), 4 );
  assert.ok( fresh.ghosts.every( ghost => ghost.mode === 'active' && ghost.respawnRemaining === 0 ) );
} );
