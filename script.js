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

// Set a random initial grid
function setRandomGrid() {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            grid[i][j] = colors[Math.floor(Math.random() * colors.length)];
        }
    }
    updateGridDisplay();
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

// Breadth-first search solver with depth limit
function solvePuzzle() {
    const MAX_DEPTH = 20; // Limit the search depth to prevent stack overflow
    const queue = [[JSON.parse(JSON.stringify(grid)), []]];
    const visited = new Set();
    
    while (queue.length > 0) {
        const [currentGrid, moves] = queue.shift();
        const gridKey = JSON.stringify(currentGrid);
        
        if (visited.has(gridKey)) continue;
        visited.add(gridKey);
        
        if (isSolved(currentGrid)) {
            displaySolution(moves, currentGrid);
            return;
        }
        
        if (moves.length >= MAX_DEPTH) continue;
        
        // Try all possible moves
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const newGrid = applyTileAction(currentGrid, i, j);
                const newMoves = [...moves, {row: i, col: j, grid: newGrid}];
                queue.push([newGrid, newMoves]);
            }
        }
    }
    
    document.getElementById('solution').textContent = 'No solution found within depth limit!';
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
        alert('Please enter a name for the puzzle');
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
    
    alert('Puzzle saved successfully!');
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
        
        // Clear solution
        document.getElementById('solution-steps').innerHTML = '';
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
        return;
    }
    const active = document.activeElement;
    if (active && active.classList.contains('tile')) {
        const row = parseInt(active.dataset.row);
        const col = parseInt(active.dataset.col);
        grid[row][col] = colorKeyMap[key];
        updateGridDisplay();
        active.focus();
        return;
    }
    if (hoveredCorner) {
        colors.forEach(c => hoveredCorner.classList.remove(c));
        hoveredCorner.classList.add(colorKeyMap[key]);
        hoveredCorner.focus();
        return;
    }
    if (active && active.classList.contains('corner-color')) {
        colors.forEach(c => active.classList.remove(c));
        active.classList.add(colorKeyMap[key]);
        active.focus();
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