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

// Initialize the grid
function initializeGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const tile = document.createElement('div');
            tile.className = `tile ${grid[i][j]}`;
            tile.dataset.row = i;
            tile.dataset.col = j;
            tile.onclick = () => cycleTileColor(i, j);
            gridElement.appendChild(tile);
        }
    }
}

// Cycle through colors when clicking a tile
function cycleTileColor(row, col) {
    const currentIndex = colors.indexOf(grid[row][col]);
    const nextIndex = (currentIndex + 1) % colors.length;
    grid[row][col] = colors[nextIndex];
    updateGridDisplay();
    solvePuzzle(); // Auto-solve on change
}

// Cycle through colors when clicking a corner
function cycleCornerColor(corner) {
    const cornerElement = document.querySelector(`.corner-${corner}`);
    const currentColor = cornerElement.className.split(' ').find(c => colors.includes(c));
    const currentIndex = colors.indexOf(currentColor);
    const nextIndex = (currentIndex + 1) % colors.length;

    // Remove current color class and add new one
    cornerElement.classList.remove(currentColor);
    cornerElement.classList.add(colors[nextIndex]);
    solvePuzzle(); // Auto-solve on change
}

// Update the visual display of the grid
function updateGridDisplay() {
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        tile.className = `tile ${grid[row][col]}`;
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

// Set random corner colors in the UI
function setCornerColors(corners) {
    const tlEl = document.querySelector('.corner-tl');
    const trEl = document.querySelector('.corner-tr');
    const blEl = document.querySelector('.corner-bl');
    const brEl = document.querySelector('.corner-br');

    // Remove all color classes and add the new ones
    colors.forEach(c => {
        tlEl.classList.remove(c);
        trEl.classList.remove(c);
        blEl.classList.remove(c);
        brEl.classList.remove(c);
    });

    tlEl.classList.add(corners.topLeft);
    trEl.classList.add(corners.topRight);
    blEl.classList.add(corners.bottomLeft);
    brEl.classList.add(corners.bottomRight);
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

// Get the corner colors from the UI
function getCornerColors() {
    return {
        topLeft: document.querySelector('.corner-tl').className.split(' ').find(c => colors.includes(c)),
        topRight: document.querySelector('.corner-tr').className.split(' ').find(c => colors.includes(c)),
        bottomLeft: document.querySelector('.corner-bl').className.split(' ').find(c => colors.includes(c)),
        bottomRight: document.querySelector('.corner-br').className.split(' ').find(c => colors.includes(c))
    };
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

// Update UI to show solving status
function updateSolverUI(status, progress = null) {
    const solveBtn = document.getElementById('solveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const statusEl = document.getElementById('solverStatus');

    if (status === 'solving') {
        solveBtn.disabled = true;
        solveBtn.textContent = 'Solving...';
        cancelBtn.style.display = 'inline-block';
        if (progress) {
            statusEl.textContent = `Exploring: ${progress.states.toLocaleString()} states | Depth: ${progress.depth} | Time: ${(progress.time / 1000).toFixed(1)}s`;
            statusEl.style.display = 'block';
        }
    } else if (status === 'idle') {
        solveBtn.disabled = false;
        solveBtn.textContent = 'Solve Puzzle';
        cancelBtn.style.display = 'none';
        statusEl.style.display = 'none';
    } else if (status === 'cancelled') {
        solveBtn.disabled = false;
        solveBtn.textContent = 'Solve Puzzle';
        cancelBtn.style.display = 'none';
        statusEl.textContent = 'Cancelled by user';
        statusEl.style.display = 'block';
    } else if (status === 'failed') {
        solveBtn.disabled = false;
        solveBtn.textContent = 'Solve Puzzle';
        cancelBtn.style.display = 'none';
        if (progress) {
            statusEl.textContent = progress.message;
        }
        statusEl.style.display = 'block';
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

    // Clear previous solution
    document.getElementById('solution-steps').innerHTML = '';
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
                    message: `Time limit reached (${(elapsed / 1000).toFixed(1)}s). Explored ${solverState.statesExplored.toLocaleString()} states. Try a simpler puzzle.`
                });
                return;
            }

            // Check states limit
            if (solverState.statesExplored >= SOLVER_LIMITS.MAX_STATES) {
                updateSolverUI('failed', {
                    message: `State limit reached (${solverState.statesExplored.toLocaleString()} states). Puzzle may be too complex or unsolvable.`
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
            message: `No solution found after exploring ${solverState.statesExplored.toLocaleString()} states. Puzzle may be unsolvable from this configuration.`
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

// Create a board state display
function createBoardState(grid) {
    const boardState = document.createElement('div');
    boardState.className = 'board-state';

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const tile = document.createElement('div');
            tile.className = `board-tile ${grid[i][j]}`;
            tile.textContent = grid[i][j].charAt(0).toUpperCase();
            boardState.appendChild(tile);
        }
    }

    return boardState;
}

// Display the solution
function displaySolution(moves, finalGrid) {
    const solutionSteps = document.getElementById('solution-steps');
    solutionSteps.innerHTML = '';

    if (moves.length === 0) {
        const step = document.createElement('li');
        step.className = 'solution-step';
        step.textContent = 'Puzzle is already solved!';
        solutionSteps.appendChild(step);
        return;
    }

    // Show initial state
    const initialStep = document.createElement('li');
    initialStep.className = 'solution-step';
    const initialContainer = document.createElement('div');
    initialContainer.className = 'step-container';

    const initialNumber = document.createElement('span');
    initialNumber.className = 'step-number';
    initialNumber.textContent = '0.';

    const initialText = document.createElement('span');
    initialText.className = 'step-text';
    initialText.textContent = 'Initial state';

    const initialInfo = document.createElement('div');
    initialInfo.className = 'step-info';
    initialInfo.appendChild(initialNumber);
    initialInfo.appendChild(initialText);

    initialContainer.appendChild(initialInfo);
    initialContainer.appendChild(createBoardState(grid));
    initialStep.appendChild(initialContainer);
    solutionSteps.appendChild(initialStep);

    // Show each move and resulting state
    moves.forEach((move, index) => {
        const step = document.createElement('li');
        step.className = 'solution-step';
        const container = document.createElement('div');
        container.className = 'step-container';

        const stepInfo = document.createElement('div');
        stepInfo.className = 'step-info';

        const stepNumber = document.createElement('span');
        stepNumber.className = 'step-number';
        stepNumber.textContent = `${index + 1}.`;

        const stepText = document.createElement('span');
        stepText.className = 'step-text';
        stepText.textContent = `Click tile at row ${move.row + 1}, column ${move.col + 1}`;

        const stepGrid = document.createElement('div');
        stepGrid.className = 'step-grid';

        // Create 3x3 grid
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const tile = document.createElement('div');
                tile.className = 'step-tile';
                if (i === move.row && j === move.col) {
                    tile.classList.add('target');
                }
                stepGrid.appendChild(tile);
            }
        }

        stepInfo.appendChild(stepNumber);
        stepInfo.appendChild(stepText);
        stepInfo.appendChild(stepGrid);

        container.appendChild(stepInfo);
        container.appendChild(createBoardState(move.grid));
        step.appendChild(container);
        solutionSteps.appendChild(step);
    });
}

// Save current puzzle state
function savePuzzle() {
    const saveName = document.getElementById('saveName').value.trim();
    if (!saveName) {
        showAlert('Please enter a name for the puzzle', 'warning');
        return;
    }

    const puzzleState = {
        grid: grid,
        corners: {
            topLeft: document.querySelector('.corner-tl').className.split(' ').find(c => colors.includes(c)),
            topRight: document.querySelector('.corner-tr').className.split(' ').find(c => colors.includes(c)),
            bottomLeft: document.querySelector('.corner-bl').className.split(' ').find(c => colors.includes(c)),
            bottomRight: document.querySelector('.corner-br').className.split(' ').find(c => colors.includes(c))
        }
    };

    // Get existing saved puzzles
    const savedPuzzles = JSON.parse(sessionStorage.getItem('moraJaiPuzzles') || '{}');
    savedPuzzles[saveName] = puzzleState;
    sessionStorage.setItem('moraJaiPuzzles', JSON.stringify(savedPuzzles));

    // Update the load dropdown
    updateLoadDropdown();

    // Clear the save name input
    document.getElementById('saveName').value = '';

    showAlert('Puzzle saved successfully!', 'success');
}

// Load a saved puzzle
function loadPuzzle() {
    const select = document.getElementById('loadPuzzle');
    const puzzleName = select.value;
    if (!puzzleName) return;

    const savedPuzzles = JSON.parse(sessionStorage.getItem('moraJaiPuzzles') || '{}');
    const puzzleState = savedPuzzles[puzzleName];

    if (puzzleState) {
        // Update grid
        grid = JSON.parse(JSON.stringify(puzzleState.grid));
        updateGridDisplay();

        // Update corner colors
        document.querySelector('.corner-tl').className = `corner-color corner-tl ${puzzleState.corners.topLeft}`;
        document.querySelector('.corner-tr').className = `corner-color corner-tr ${puzzleState.corners.topRight}`;
        document.querySelector('.corner-bl').className = `corner-color corner-bl ${puzzleState.corners.bottomLeft}`;
        document.querySelector('.corner-br').className = `corner-color corner-br ${puzzleState.corners.bottomRight}`;

        // Auto-solve the loaded puzzle
        solvePuzzle();
    }
}

// Update the load puzzle dropdown
function updateLoadDropdown() {
    const select = document.getElementById('loadPuzzle');
    const savedPuzzles = JSON.parse(sessionStorage.getItem('moraJaiPuzzles') || '{}');

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add saved puzzles
    Object.keys(savedPuzzles).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
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
    const corners = document.querySelectorAll('.corner-color');
    corners.forEach(corner => {
        corner.onmouseenter = () => { hoveredCorner = corner; };
        corner.onmouseleave = () => { if (hoveredCorner === corner) hoveredCorner = null; };
    });
}

function handleGlobalKeydown(e) {
    const key = e.key.toLowerCase();
    if (!colorKeyMap[key]) return;
    // Priority: hovered tile > focused tile > hovered corner > focused corner
    if (hoveredTile) {
        const row = parseInt(hoveredTile.dataset.row);
        const col = parseInt(hoveredTile.dataset.col);
        grid[row][col] = colorKeyMap[key];
        updateGridDisplay();
        hoveredTile.focus();
        solvePuzzle(); // Auto-solve on change
        return;
    }
    const active = document.activeElement;
    if (active && active.classList.contains('tile')) {
        const row = parseInt(active.dataset.row);
        const col = parseInt(active.dataset.col);
        grid[row][col] = colorKeyMap[key];
        updateGridDisplay();
        active.focus();
        solvePuzzle(); // Auto-solve on change
        return;
    }
    if (hoveredCorner) {
        colors.forEach(c => hoveredCorner.classList.remove(c));
        hoveredCorner.classList.add(colorKeyMap[key]);
        hoveredCorner.focus();
        solvePuzzle(); // Auto-solve on change
        return;
    }
    if (active && active.classList.contains('corner-color')) {
        colors.forEach(c => active.classList.remove(c));
        active.classList.add(colorKeyMap[key]);
        active.focus();
        solvePuzzle(); // Auto-solve on change
        return;
    }
}

// Initialize the game
function initializeGame() {
    initializeGrid();
    updateLoadDropdown();
    enableTileHoverTracking();
    enableCornerHoverTracking();
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('keydown', handleGlobalKeydown);
}

// Call initializeGame instead of just initializeGrid
initializeGame();