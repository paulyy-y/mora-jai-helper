// Game state
let grid = [
    ['gray', 'orange', 'orange'],
    ['yellow', 'orange', 'black'],
    ['blue', 'blue', 'orange']
];
const colors = ['orange', 'yellow', 'blue', 'black', 'gray', 'pink', 'purple', 'white'];

// Map first letter to color
const colorKeyMap = {
    o: 'orange',
    y: 'yellow',
    b: 'blue',
    k: 'black', // 'k' for black to avoid conflict with blue
    g: 'gray',
    p: 'pink',
    u: 'purple', // 'u' for purple to avoid conflict with pink
    w: 'white'
};
const colorLetter = Object.fromEntries(Object.entries(colorKeyMap).map(([k, c]) => [c, k.toUpperCase()]));

// Corner targets: the colour each corner tile must end up as
let corners = { tl: 'orange', tr: 'orange', bl: 'orange', br: 'orange' };
const cornerNames = { tl: 'Top-left', tr: 'Top-right', bl: 'Bottom-left', br: 'Bottom-right' };

const STORAGE_KEY = 'moraJaiPuzzles';
const THEME_KEY = 'moraJai.theme';
const $ = id => document.getElementById(id);

// Track hovered tile or corner
let hoveredTile = null;
let hoveredCorner = null;

// Solver state for async operation
let solverState = {
    isRunning: false,
    shouldCancel: false,
    restartAfterCancel: false,
    statesExplored: 0,
    startTime: 0
};

// Solver limits
const SOLVER_LIMITS = {
    MAX_STATES: 50000,
    MAX_TIME_MS: 10000,
    MAX_DEPTH: 15,
    BATCH_SIZE: 500 // States to process before yielding to UI
};

// Initialize the grid: nine tile buttons placed inside the ring of corner targets
function initializeGrid() {
    const board = $('board');
    board.querySelectorAll('.tile').forEach(t => t.remove());
    // Tiles go between the top and bottom corners, so Tab follows the board top to bottom
    const bottomLeft = board.querySelector('[data-corner="bl"]');

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tile';
            tile.dataset.row = i;
            tile.dataset.col = j;
            tile.style.gridArea = `${i + 2} / ${j + 2}`;
            tile.onclick = () => cycleTileColor(i, j);
            board.insertBefore(tile, bottomLeft);
        }
    }
    board.querySelectorAll('.corner').forEach(c => {
        c.onclick = () => cycleCornerColor(c.dataset.corner);
    });
    updateGridDisplay();
}

// Cycle through colors when clicking a tile
function cycleTileColor(row, col) {
    const currentIndex = colors.indexOf(grid[row][col]);
    const nextIndex = (currentIndex + 1) % colors.length;
    grid[row][col] = colors[nextIndex];
    boardChanged();
}

// Cycle through colors when clicking a corner
function cycleCornerColor(corner) {
    const nextIndex = (colors.indexOf(corners[corner]) + 1) % colors.length;
    corners[corner] = colors[nextIndex];
    boardChanged();
}

// Any edit by hand: redraw, note the puzzle has changed, and solve again
function boardChanged() {
    updateGridDisplay();
    setContext(currentName ? `${currentName}, edited` : 'Edited puzzle');
    solvePuzzle(); // Auto-solve on change
}

// Update the visual display of the grid and the corner targets
function updateGridDisplay() {
    document.querySelectorAll('.tile').forEach(tile => {
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        const color = grid[row][col];
        tile.className = `tile piece-${color}`;
        tile.textContent = colorLetter[color];
        tile.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${color}`);
    });
    document.querySelectorAll('.corner').forEach(el => {
        const color = corners[el.dataset.corner];
        el.className = `corner piece-${color}`;
        el.textContent = colorLetter[color];
        el.setAttribute('aria-label', `${cornerNames[el.dataset.corner]} target: ${color}`);
    });
    enableTileHoverTracking();
}

// Quick solvability check with limited resources
function quickSolveCheck(testGrid, corners, maxStates = 5000, maxDepth = 12) {
    const queue = [[testGrid, []]];
    const visited = new Set();

    while (queue.length > 0 && visited.size < maxStates) {
        const [currentGrid, moves] = queue.shift();
        const gridKey = JSON.stringify(currentGrid);

        if (visited.has(gridKey)) continue;
        visited.add(gridKey);

        // Check if solved
        if (currentGrid[0][0] === corners.topLeft &&
            currentGrid[0][2] === corners.topRight &&
            currentGrid[2][0] === corners.bottomLeft &&
            currentGrid[2][2] === corners.bottomRight) {
            return { solvable: true, moves: moves.length };
        }

        if (moves.length >= maxDepth) continue;

        // Try all possible moves
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const newGrid = applyTileAction(currentGrid, i, j);
                const newGridKey = JSON.stringify(newGrid);
                if (!visited.has(newGridKey)) {
                    queue.push([newGrid, [...moves, { row: i, col: j }]]);
                }
            }
        }
    }

    return { solvable: false, moves: -1 };
}

// Check if a grid is already solved
function isGridSolved(testGrid, corners) {
    return testGrid[0][0] === corners.topLeft &&
           testGrid[0][2] === corners.topRight &&
           testGrid[2][0] === corners.bottomLeft &&
           testGrid[2][2] === corners.bottomRight;
}

// Set the corner targets (drawn by updateGridDisplay)
function setCornerColors(target) {
    corners = { tl: target.topLeft, tr: target.topRight, bl: target.bottomLeft, br: target.bottomRight };
}

// Generate a solvable random grid that is NOT already solved
function setRandomGrid() {
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Generate random corner target colors
        const corners = {
            topLeft: colors[Math.floor(Math.random() * colors.length)],
            topRight: colors[Math.floor(Math.random() * colors.length)],
            bottomLeft: colors[Math.floor(Math.random() * colors.length)],
            bottomRight: colors[Math.floor(Math.random() * colors.length)]
        };

        // Start with a solved state - corners match their target colors
        // Fill the rest with random colors
        const solvedGrid = [
            [corners.topLeft, colors[Math.floor(Math.random() * colors.length)], corners.topRight],
            [colors[Math.floor(Math.random() * colors.length)], colors[Math.floor(Math.random() * colors.length)], colors[Math.floor(Math.random() * colors.length)]],
            [corners.bottomLeft, colors[Math.floor(Math.random() * colors.length)], corners.bottomRight]
        ];

        // Apply 5-15 random moves to scramble (fewer moves for simpler puzzles)
        let currentGrid = JSON.parse(JSON.stringify(solvedGrid));
        const numMoves = 5 + Math.floor(Math.random() * 11); // 5-15 moves

        for (let m = 0; m < numMoves; m++) {
            const row = Math.floor(Math.random() * 3);
            const col = Math.floor(Math.random() * 3);
            currentGrid = applyTileAction(currentGrid, row, col);
        }

        // Skip if already solved - we want an actual puzzle
        if (isGridSolved(currentGrid, corners)) {
            continue;
        }

        // Verify this grid is solvable with a quick check
        const result = quickSolveCheck(currentGrid, corners);

        if (result.solvable && result.moves > 0) {
            // Found a solvable puzzle that requires moves!
            grid = currentGrid;
            setCornerColors(corners);
            updateGridDisplay();
            solvePuzzle(); // Auto-solve after generating
            return;
        }
    }

    // Fallback: Create a simple but not-solved puzzle with random corners
    const corners = {
        topLeft: colors[Math.floor(Math.random() * colors.length)],
        topRight: colors[Math.floor(Math.random() * colors.length)],
        bottomLeft: colors[Math.floor(Math.random() * colors.length)],
        bottomRight: colors[Math.floor(Math.random() * colors.length)]
    };

    grid = [
        [corners.topLeft, colors[Math.floor(Math.random() * colors.length)], corners.topRight],
        [colors[Math.floor(Math.random() * colors.length)], colors[Math.floor(Math.random() * colors.length)], colors[Math.floor(Math.random() * colors.length)]],
        [corners.bottomLeft, colors[Math.floor(Math.random() * colors.length)], corners.bottomRight]
    ];

    // Keep applying moves until we're not solved
    for (let m = 0; m < 10; m++) {
        const row = Math.floor(Math.random() * 3);
        const col = Math.floor(Math.random() * 3);
        grid = applyTileAction(grid, row, col);
        if (!isGridSolved(grid, corners)) {
            break;
        }
    }

    setCornerColors(corners);
    updateGridDisplay();
    solvePuzzle(); // Auto-solve after generating
}

// Get the corner targets
function getCornerColors() {
    return { topLeft: corners.tl, topRight: corners.tr, bottomLeft: corners.bl, bottomRight: corners.br };
}

// Check if the puzzle is solved
function isSolved(currentGrid) {
    const corners = getCornerColors();
    return currentGrid[0][0] === corners.topLeft &&
           currentGrid[0][2] === corners.topRight &&
           currentGrid[2][0] === corners.bottomLeft &&
           currentGrid[2][2] === corners.bottomRight;
}

// Get adjacent tiles for a given position
function getAdjacentTiles(currentGrid, row, col) {
    const adjacent = [];
    const directions = [[-1,0], [1,0], [0,-1], [0,1]];

    for (const [dx, dy] of directions) {
        const newRow = row + dx;
        const newCol = col + dy;
        if (newRow >= 0 && newRow < 3 && newCol >= 0 && newCol < 3) {
            adjacent.push({row: newRow, col: newCol, color: currentGrid[newRow][newCol]});
        }
    }
    return adjacent;
}

// Get majority color from adjacent tiles
function getMajorityColor(adjacent) {
    const counts = {};
    adjacent.forEach(color => {
        counts[color] = (counts[color] || 0) + 1;
    });

    let maxCount = 0;
    let majorityColor = null;

    for (const [color, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            majorityColor = color;
        }
    }

    return maxCount > 1 ? majorityColor : null;
}

// Get all neighbors for a given position in clockwise order
function getAllNeighborsClockwise(currentGrid, row, col) {
    const neighbors = [];
    // Define positions in clockwise order: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left
    const positions = [
        {row: row-1, col: col},      // top
        {row: row-1, col: col+1},    // top-right
        {row: row, col: col+1},      // right
        {row: row+1, col: col+1},    // bottom-right
        {row: row+1, col: col},      // bottom
        {row: row+1, col: col-1},    // bottom-left
        {row: row, col: col-1},      // left
        {row: row-1, col: col-1}     // top-left
    ];

    for (const pos of positions) {
        if (pos.row >= 0 && pos.row < 3 && pos.col >= 0 && pos.col < 3) {
            neighbors.push({
                row: pos.row,
                col: pos.col,
                color: currentGrid[pos.row][pos.col]
            });
        }
    }
    return neighbors;
}

// Rotate neighbors clockwise
function rotateNeighborsClockwise(currentGrid, row, col) {
    const neighbors = getAllNeighborsClockwise(currentGrid, row, col);
    if (neighbors.length < 2) return currentGrid;

    const newGrid = JSON.parse(JSON.stringify(currentGrid));
    const colors = neighbors.map(n => n.color);
    colors.unshift(colors.pop()); // Rotate colors clockwise

    neighbors.forEach((pos, i) => {
        newGrid[pos.row][pos.col] = colors[i];
    });

    return newGrid;
}

// Apply white tile transformation
function applyWhiteTileTransformation(currentGrid, row, col, targetColor = 'gray') {
    const newGrid = JSON.parse(JSON.stringify(currentGrid));
    const adjacent = getAdjacentTiles(currentGrid, row, col);

    // First, handle the clicked tile - always turn into Gray
    newGrid[row][col] = 'gray';

    // Then handle adjacent tiles
    adjacent.forEach(pos => {
        if (targetColor === 'blue') {
            // When Blue copies White behavior:
            // - Only turn Gray tiles to Blue
            // - Don't affect White tiles
            if (currentGrid[pos.row][pos.col] === 'gray') {
                newGrid[pos.row][pos.col] = 'blue';
            }
        } else {
            // Regular White tile behavior:
            // - Turn White tiles to Gray
            // - Turn Gray tiles to White
            if (currentGrid[pos.row][pos.col] === 'white') {
                newGrid[pos.row][pos.col] = 'gray';
            } else if (currentGrid[pos.row][pos.col] === 'gray') {
                newGrid[pos.row][pos.col] = 'white';
            }
        }
    });

    return newGrid;
}

// Apply tile actions
function applyTileAction(currentGrid, row, col) {
    const color = currentGrid[row][col];
    let newGrid = JSON.parse(JSON.stringify(currentGrid));

    switch (color) {
        case 'orange':
            const adjacent = getAdjacentTiles(currentGrid, row, col);
            const majorityColor = getMajorityColor(adjacent.map(a => a.color));
            if (majorityColor) {
                newGrid[row][col] = majorityColor;
            }
            break;

        case 'yellow':
            if (row > 0) {
                [newGrid[row][col], newGrid[row-1][col]] = [newGrid[row-1][col], newGrid[row][col]];
            }
            break;

        case 'purple':
            if (row < 2) {
                [newGrid[row][col], newGrid[row+1][col]] = [newGrid[row+1][col], newGrid[row][col]];
            }
            break;

        case 'blue':
            const centerColor = currentGrid[1][1];
            if (centerColor !== 'blue') {
                // Apply the center tile's action to this position
                switch (centerColor) {
                    case 'orange':
                        const centerAdjacent = getAdjacentTiles(currentGrid, row, col);
                        const centerMajority = getMajorityColor(centerAdjacent.map(a => a.color));
                        if (centerMajority) {
                            newGrid[row][col] = centerMajority;
                        }
                        break;
                    case 'yellow':
                        if (row > 0) {
                            [newGrid[row][col], newGrid[row-1][col]] = [newGrid[row-1][col], newGrid[row][col]];
                        }
                        break;
                    case 'purple':
                        if (row < 2) {
                            [newGrid[row][col], newGrid[row+1][col]] = [newGrid[row+1][col], newGrid[row][col]];
                        }
                        break;
                    case 'pink':
                        newGrid = rotateNeighborsClockwise(newGrid, row, col);
                        break;
                    case 'white':
                        newGrid = applyWhiteTileTransformation(newGrid, row, col, 'blue');
                        break;
                    case 'black':
                        const rowToShift = [...newGrid[row]];
                        rowToShift.unshift(rowToShift.pop());
                        newGrid[row] = rowToShift;
                        break;
                }
            }
            break;

        case 'black':
            const rowToShift = [...newGrid[row]];
            rowToShift.unshift(rowToShift.pop());
            newGrid[row] = rowToShift;
            break;

        case 'pink':
            newGrid = rotateNeighborsClockwise(newGrid, row, col);
            break;

        case 'white':
            newGrid = applyWhiteTileTransformation(newGrid, row, col);
            break;

        case 'gray':
            // Do nothing
            break;
    }

    return newGrid;
}

// Show one of a button's stacked labels (see .lbls in index.html)
function setButtonLabel(btn, state) {
    btn.querySelectorAll('.lbls > span').forEach(s => s.classList.toggle('on', s.dataset.s === state));
}

// Show a label for about 3 seconds, then go back to the idle one
const labelTimers = new WeakMap();
function flashButtonLabel(btn, state, ms = 3000) {
    clearTimeout(labelTimers.get(btn));
    setButtonLabel(btn, state);
    labelTimers.set(btn, setTimeout(() => setButtonLabel(btn, 'idle'), ms));
}

function announce(text) {
    $('announce').textContent = text;
}

function plural(n, one, many = one + 's') {
    return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

// Status bar: what the solver is doing or last did
function setSolverStatus(state, states = null, ms = null) {
    $('sbState').textContent = state;
    $('sbStates').textContent = states == null ? '' : `${plural(states, 'position')} checked`;
    $('sbTime').textContent = ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// Replace what the solution pane shows with a message (the table stays mounted, hidden)
function showInSolutionPane(node) {
    $('solMsg').replaceChildren(node);
    $('stepsTable').hidden = true;
    $('stepsTable').removeAttribute('aria-busy');
    $('moveCount').textContent = '';
}

function showNotice(kind, icon, word, text) {
    const box = document.createElement('div');
    box.className = `notice ${kind}`;
    const strong = document.createElement('strong');
    strong.className = 'word';
    strong.innerHTML = `<svg class="i mark" aria-hidden="true"><use href="#i-${icon}"/></svg> `;
    strong.append(word);
    const p = document.createElement('p');
    p.textContent = text;
    box.append(strong, p);
    showInSolutionPane(box);
}

// Solving takes over the pane only after a second, so quick solves don't flash
let progressTimer = null;
let progressInPane = false;
function showProgress(progress) {
    const p = document.createElement('p');
    p.className = 'msg';
    p.textContent = `Solving … checked ${progress.states.toLocaleString()} of at most ${SOLVER_LIMITS.MAX_STATES.toLocaleString()} positions.`;
    showInSolutionPane(p);
}

// Update UI to show solving status
function updateSolverUI(status, progress = null) {
    const solveBtn = $('solveBtn');
    const stopBtn = $('stopBtn');
    const running = status === 'solving';

    setButtonLabel(solveBtn, running ? 'busy' : 'idle');
    if (running) solveBtn.setAttribute('aria-disabled', 'true');
    else solveBtn.removeAttribute('aria-disabled');
    // Stop disables itself when the solver ends; keep keyboard focus on the toolbar
    if (!running && document.activeElement === stopBtn) solveBtn.focus();
    stopBtn.disabled = !running;
    stopBtn.title = running ? 'Stop the solver' : "The solver isn't running";
    if (!running) {
        clearTimeout(progressTimer);
        progressInPane = false;
    }

    if (status === 'solving') {
        $('stepsTable').setAttribute('aria-busy', 'true');
        setSolverStatus('Solving', progress.states, progress.time);
        if (progressInPane) showProgress(progress);
    } else if (status === 'cancelled') {
        setSolverStatus('Stopped', solverState.statesExplored, Date.now() - solverState.startTime);
        showNotice('warn', 'clock', 'Stopped', 'The solver stopped before it found an answer. Press Solve to start again.');
        announce('Solver stopped.');
    } else if (status === 'failed') {
        setSolverStatus('No answer', solverState.statesExplored, Date.now() - solverState.startTime);
        showNotice(progress.kind, progress.icon, progress.word, progress.message);
        announce(`${progress.word}. ${progress.message}`);
    }
}

// Cancel the current solve operation
function cancelSolve() {
    if (solverState.isRunning) {
        solverState.shouldCancel = true;
        solverState.restartAfterCancel = false; // Manual cancel, don't restart
    }
}

// Yield control back to the browser
function yieldToUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

// Async breadth-first search solver with intelligent termination
async function solvePuzzle() {
    // If already running, cancel and queue restart
    if (solverState.isRunning) {
        solverState.shouldCancel = true;
        solverState.restartAfterCancel = true;
        return;
    }

    // Initialize solver state
    solverState = {
        isRunning: true,
        shouldCancel: false,
        restartAfterCancel: false,
        statesExplored: 0,
        startTime: Date.now()
    };

    // The old answer stays (marked busy) until the new one is ready; after a second, progress replaces it
    clearTimeout(progressTimer);
    progressInPane = false;
    progressTimer = setTimeout(() => {
        if (!solverState.isRunning) return;
        progressInPane = true;
        showProgress({ states: solverState.statesExplored });
    }, 1000);

    updateSolverUI('solving', { states: 0, depth: 0, time: 0 });

    const queue = [[JSON.parse(JSON.stringify(grid)), []]];
    const visited = new Set();
    let batchCount = 0;
    let maxDepthReached = 0;

    try {
        while (queue.length > 0) {
            // Check cancellation
            if (solverState.shouldCancel) {
                // Don't show cancelled UI if we're restarting
                if (!solverState.restartAfterCancel) {
                    updateSolverUI('cancelled');
                }
                return;
            }

            // Check time limit
            const elapsed = Date.now() - solverState.startTime;
            if (elapsed > SOLVER_LIMITS.MAX_TIME_MS) {
                updateSolverUI('failed', {
                    kind: 'warn', icon: 'clock', word: `No answer within ${SOLVER_LIMITS.MAX_TIME_MS / 1000} seconds`,
                    message: `Checked ${plural(solverState.statesExplored, 'position')}. The puzzle may need more than ${SOLVER_LIMITS.MAX_DEPTH} presses; check the colours against the game.`
                });
                return;
            }

            // Check states limit
            if (solverState.statesExplored >= SOLVER_LIMITS.MAX_STATES) {
                updateSolverUI('failed', {
                    kind: 'warn', icon: 'clock', word: `No answer in ${SOLVER_LIMITS.MAX_STATES.toLocaleString()} positions`,
                    message: `The solver stops there. The puzzle may need more than ${SOLVER_LIMITS.MAX_DEPTH} presses; check the colours against the game.`
                });
                return;
            }

            const [currentGrid, moves] = queue.shift();
            const gridKey = JSON.stringify(currentGrid);

            if (visited.has(gridKey)) continue;
            visited.add(gridKey);
            solverState.statesExplored++;

            // Track max depth for progress display
            if (moves.length > maxDepthReached) {
                maxDepthReached = moves.length;
            }

            // Update UI periodically
            batchCount++;
            if (batchCount >= SOLVER_LIMITS.BATCH_SIZE) {
                batchCount = 0;
                updateSolverUI('solving', {
                    states: solverState.statesExplored,
                    depth: maxDepthReached,
                    time: Date.now() - solverState.startTime
                });
                await yieldToUI();
            }

            if (isSolved(currentGrid)) {
                updateSolverUI('idle');
                displaySolution(moves, currentGrid);
                return;
            }

            if (moves.length >= SOLVER_LIMITS.MAX_DEPTH) continue;

            // Try all possible moves
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    const newGrid = applyTileAction(currentGrid, i, j);
                    const newGridKey = JSON.stringify(newGrid);
                    // Skip if we've already visited this state
                    if (!visited.has(newGridKey)) {
                        const newMoves = [...moves, {row: i, col: j, grid: newGrid}];
                        queue.push([newGrid, newMoves]);
                    }
                }
            }
        }

        // Queue exhausted without solution
        updateSolverUI('failed', {
            kind: 'bad', icon: 'x', word: 'No answer',
            message: `Checked every position reachable in ${SOLVER_LIMITS.MAX_DEPTH} presses (${plural(solverState.statesExplored, 'position')}); none opens the box. Check the tile and corner colours against the game.`
        });
    } finally {
        const shouldRestart = solverState.restartAfterCancel;
        solverState.isRunning = false;
        solverState.restartAfterCancel = false;

        // If layout changed during solve, restart with new layout
        if (shouldRestart) {
            // Use setTimeout to avoid stack overflow from recursive calls
            setTimeout(() => solvePuzzle(), 0);
        }
    }
}

// A small 3x3 picture of a board, with each tile's letter; the row's text says the same in words
function createBoardState(grid) {
    const boardState = document.createElement('div');
    boardState.className = 'mini';
    boardState.setAttribute('role', 'img');
    boardState.setAttribute('aria-label', grid.map((row, i) => `Row ${i + 1}: ${row.join(', ')}`).join('; '));

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const tile = document.createElement('span');
            tile.className = `piece-${grid[i][j]}`;
            tile.textContent = colorLetter[grid[i][j]];
            boardState.appendChild(tile);
        }
    }

    return boardState;
}

// Where on the board a press happens, as a 3x3 with the pressed tile filled
function createWhere(row, col) {
    const where = document.createElement('div');
    where.className = 'where';
    where.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('span');
        if (i === row * 3 + col) cell.className = 'hit';
        where.appendChild(cell);
    }
    return where;
}

function createStepRow(number, pressText, subText, whereNode, boardNode) {
    const tr = document.createElement('tr');
    const n = document.createElement('td');
    n.className = 'n';
    n.textContent = number;
    const press = document.createElement('td');
    press.className = 'press';
    press.textContent = pressText;
    if (subText) {
        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.textContent = subText;
        press.appendChild(sub);
    }
    const where = document.createElement('td');
    if (whereNode) where.appendChild(whereNode);
    const after = document.createElement('td');
    after.appendChild(boardNode);
    tr.append(n, press, where, after);
    return tr;
}

// Display the solution
function displaySolution(moves, finalGrid) {
    const elapsed = Date.now() - solverState.startTime;

    if (moves.length === 0) {
        setSolverStatus('Already open', solverState.statesExplored, elapsed);
        showNotice('ok', 'check', 'Already open', 'Every corner tile already matches its corner. Nothing to press.');
        announce('Already open. Nothing to press.');
        return;
    }

    const body = $('stepsBody');
    const rows = [createStepRow(0, 'Start', null, null, createBoardState(grid))];
    let before = grid;
    moves.forEach((move, index) => {
        const pressed = before[move.row][move.col];
        rows.push(createStepRow(index + 1,
            `Row ${move.row + 1}, column ${move.col + 1}`,
            `${pressed[0].toUpperCase()}${pressed.slice(1)} tile`,
            createWhere(move.row, move.col),
            createBoardState(move.grid)));
        before = move.grid;
    });
    body.replaceChildren(...rows);

    $('solMsg').replaceChildren();
    $('stepsTable').hidden = false;
    $('stepsTable').removeAttribute('aria-busy');
    const presses = plural(moves.length, 'press', 'presses');
    $('moveCount').textContent = presses;
    setSolverStatus(`Solved in ${presses}`, solverState.statesExplored, elapsed);
    announce(`Solved in ${presses}.`);
}

// The puzzle on the board, named in the title line
let currentName = null;
function setContext(text) {
    $('ctx').textContent = text;
}

// Saved puzzles live in localStorage, so they survive closing the tab
function readSaved() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeSaved(saved) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        return true;
    } catch {
        return false;
    }
}

// Earlier versions kept puzzles in sessionStorage; bring any from this tab across once
function migrateSessionPuzzles() {
    try {
        const old = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
        const names = Object.keys(old);
        if (!names.length) return;
        const saved = readSaved();
        names.forEach(name => { if (!(name in saved)) saved[name] = old[name]; });
        if (writeSaved(saved)) sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage blocked: nothing to bring across
    }
}

function setSaveError(message) {
    const input = $('saveName');
    const help = $('saveHelp');
    if (message) {
        input.setAttribute('aria-invalid', 'true');
        help.textContent = message;
        help.classList.add('err');
    } else {
        input.removeAttribute('aria-invalid');
        help.textContent = 'Kept in this browser.';
        help.classList.remove('err');
    }
}

// Save current puzzle state
function savePuzzle(event) {
    event.preventDefault();
    const input = $('saveName');
    const saveBtn = $('saveBtn');
    const saveName = input.value.trim();
    if (!saveName) {
        setSaveError('Enter a name for this puzzle.');
        input.focus();
        return;
    }

    const savedPuzzles = readSaved();
    const replacing = saveName in savedPuzzles;
    savedPuzzles[saveName] = {
        grid: JSON.parse(JSON.stringify(grid)),
        corners: getCornerColors()
    };
    if (!writeSaved(savedPuzzles)) {
        setSaveError('This browser blocked saving. Allow site data for this page and try again.');
        flashButtonLabel(saveBtn, 'fail');
        return;
    }

    setSaveError(null);
    input.value = '';
    updateLoadDropdown();
    $('loadPuzzle').value = saveName;
    updateDeleteButton();
    currentName = saveName;
    setContext(saveName);
    flashButtonLabel(saveBtn, replacing ? 'replaced' : 'done');
    announce(replacing ? `Replaced ${saveName}.` : `Saved ${saveName}.`);
}

// Load a saved puzzle
function loadPuzzle() {
    const puzzleName = $('loadPuzzle').value;
    updateDeleteButton();
    if (!puzzleName) return;

    const puzzleState = readSaved()[puzzleName];
    if (puzzleState) {
        grid = JSON.parse(JSON.stringify(puzzleState.grid));
        setCornerColors(puzzleState.corners);
        updateGridDisplay();
        currentName = puzzleName;
        setContext(puzzleName);
        // Auto-solve the loaded puzzle
        solvePuzzle();
    }
}

// Delete the chosen puzzle at once; the same button offers Undo for 5 seconds
let pendingUndo = null;
function deleteOrUndo() {
    const btn = $('deleteBtn');
    const saved = readSaved();

    if (pendingUndo) {
        const { name, state, wasCurrent } = pendingUndo;
        clearTimeout(pendingUndo.timer);
        pendingUndo = null;
        saved[name] = state;
        writeSaved(saved);
        updateLoadDropdown();
        $('loadPuzzle').value = name;
        setButtonLabel(btn, 'idle');
        updateDeleteButton();
        if (wasCurrent) {
            currentName = name;
            setContext(name);
        }
        announce(`Restored ${name}.`);
        return;
    }

    const name = $('loadPuzzle').value;
    if (!name || !(name in saved)) return;
    const state = saved[name];
    delete saved[name];
    writeSaved(saved);
    const wasCurrent = currentName === name;
    if (wasCurrent) {
        currentName = null;
        setContext('Unsaved puzzle');
    }
    updateLoadDropdown();
    setButtonLabel(btn, 'undo');
    btn.disabled = false;
    btn.title = `Put ${name} back`;
    pendingUndo = {
        name, state, wasCurrent,
        timer: setTimeout(() => {
            pendingUndo = null;
            setButtonLabel(btn, 'idle');
            updateDeleteButton();
        }, 5000)
    };
    announce(`Deleted ${name}. Undo delete is available for 5 seconds.`);
}

function updateDeleteButton() {
    if (pendingUndo) return;
    const btn = $('deleteBtn');
    const chosen = $('loadPuzzle').value;
    btn.disabled = !chosen;
    btn.title = chosen ? `Delete ${chosen}` : 'Choose a saved puzzle first';
}

// Update the load puzzle dropdown, the count beside the group and its help line
function updateLoadDropdown() {
    const select = $('loadPuzzle');
    const names = Object.keys(readSaved()).sort((a, b) => a.localeCompare(b));

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.disabled = names.length === 0;
    $('savedCount').textContent = names.length;
    $('loadHelp').textContent = names.length
        ? 'Choosing one puts it on the board.'
        : 'None yet. Name the board and save it.';
    updateDeleteButton();
}

// Add keyboard support for grid tiles
function enableTileHoverTracking() {
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.onmouseenter = () => { hoveredTile = tile; };
        tile.onmouseleave = () => { if (hoveredTile === tile) hoveredTile = null; };
    });
}

// Add keyboard support for corner selectors
function enableCornerHoverTracking() {
    document.querySelectorAll('.corner').forEach(corner => {
        corner.onmouseenter = () => { hoveredCorner = corner; };
        corner.onmouseleave = () => { if (hoveredCorner === corner) hoveredCorner = null; };
    });
}

function setTileColor(tile, color) {
    grid[parseInt(tile.dataset.row)][parseInt(tile.dataset.col)] = color;
    boardChanged();
    tile.focus();
}

function setCornerColor(corner, color) {
    corners[corner.dataset.corner] = color;
    boardChanged();
    corner.focus();
}

function handleGlobalKeydown(e) {
    // Leave typing, browser shortcuts and the open Help window alone
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, select, textarea, dialog')) return;
    const key = e.key.toLowerCase();
    if (!colorKeyMap[key]) return;
    const color = colorKeyMap[key];
    const active = document.activeElement;
    // Priority: hovered tile > focused tile > hovered corner > focused corner
    if (hoveredTile) return setTileColor(hoveredTile, color);
    if (active && active.classList.contains('tile')) return setTileColor(active, color);
    if (hoveredCorner) return setCornerColor(hoveredCorner, color);
    if (active && active.classList.contains('corner')) return setCornerColor(active, color);
}

// Theme: dark by default, light from the toggle, remembered in this browser
function applyTheme(light) {
    const root = document.documentElement;
    if (light) root.dataset.theme = 'light';
    else delete root.dataset.theme;
    const btn = $('themeBtn');
    const label = light ? 'Switch to dark theme' : 'Switch to light theme';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.querySelector('use').setAttribute('href', light ? '#i-moon' : '#i-sun');
    $('themeColor').content = getComputedStyle(root).getPropertyValue('--bg').trim();
}

function toggleTheme() {
    const light = document.documentElement.dataset.theme !== 'light';
    applyTheme(light);
    try {
        if (light) localStorage.setItem(THEME_KEY, 'light');
        else localStorage.removeItem(THEME_KEY);
    } catch {
        // Not remembered when storage is blocked; the toggle still works for this visit
    }
}

// Help dialog: focus goes back to the Help button when it closes
function initializeHelp() {
    const dlg = $('helpDlg');
    $('helpBtn').onclick = () => dlg.showModal();
    dlg.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => dlg.close(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => $('helpBtn').focus());
}

// Initialize the game
function initializeGame() {
  migrateSessionPuzzles();
  initializeGrid();
  updateLoadDropdown();
  enableTileHoverTracking();
  enableCornerHoverTracking();
  applyTheme(document.documentElement.dataset.theme === 'light');
  initializeHelp();

  $('themeBtn').onclick = toggleTheme;
  $('solveBtn').onclick = () => { if (!solverState.isRunning) solvePuzzle(); };
  $('stopBtn').onclick = cancelSolve;
  $('randomBtn').onclick = () => {
      currentName = null;
      setRandomGrid();
      setContext('Random puzzle');
  };
  $('saveForm').addEventListener('submit', savePuzzle);
  $('saveName').addEventListener('input', () => {
      if ($('saveName').getAttribute('aria-invalid') && $('saveName').value.trim()) setSaveError(null);
  });
  $('loadPuzzle').onchange = loadPuzzle;
  $('deleteBtn').onclick = deleteOrUndo;

  window.removeEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("keydown", handleGlobalKeydown);
  // Auto-solve on initial page load
  solvePuzzle();
}

// Call initializeGame instead of just initializeGrid
initializeGame();