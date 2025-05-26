// Game state
let grid = [
    ['gray', 'orange', 'orange'],
    ['yellow', 'orange', 'black'],
    ['blue', 'blue', 'orange']
];
const colors = ['orange', 'yellow', 'blue', 'black', 'gray'];

// Initialize the grid
function initializeGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    
    // Set default corner colors
    document.getElementById('corner-tl').value = 'orange';
    document.getElementById('corner-tr').value = 'orange';
    document.getElementById('corner-bl').value = 'orange';
    document.getElementById('corner-br').value = 'orange';
    
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

// Update the visual display of the grid
function updateGridDisplay() {
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        tile.className = `tile ${grid[row][col]}`;
    });
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
        topLeft: document.getElementById('corner-tl').value,
        topRight: document.getElementById('corner-tr').value,
        bottomLeft: document.getElementById('corner-bl').value,
        bottomRight: document.getElementById('corner-br').value
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
            adjacent.push(currentGrid[newRow][newCol]);
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

// Apply tile actions
function applyTileAction(currentGrid, row, col) {
    const color = currentGrid[row][col];
    let newGrid = JSON.parse(JSON.stringify(currentGrid));
    
    switch (color) {
        case 'orange':
            const adjacent = getAdjacentTiles(currentGrid, row, col);
            const majorityColor = getMajorityColor(adjacent);
            if (majorityColor) {
                newGrid[row][col] = majorityColor;
            }
            break;
            
        case 'yellow':
            if (row > 0) {
                [newGrid[row][col], newGrid[row-1][col]] = [newGrid[row-1][col], newGrid[row][col]];
            }
            break;
            
        case 'blue':
            const centerColor = currentGrid[1][1];
            if (centerColor !== 'blue') {
                // Apply the center tile's action to this position
                switch (centerColor) {
                    case 'orange':
                        const centerAdjacent = getAdjacentTiles(currentGrid, row, col);
                        const centerMajority = getMajorityColor(centerAdjacent);
                        if (centerMajority) {
                            newGrid[row][col] = centerMajority;
                        }
                        break;
                    case 'yellow':
                        if (row > 0) {
                            [newGrid[row][col], newGrid[row-1][col]] = [newGrid[row-1][col], newGrid[row][col]];
                        }
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
            displaySolution(moves);
            return;
        }
        
        if (moves.length >= MAX_DEPTH) continue;
        
        // Try all possible moves
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const newGrid = applyTileAction(currentGrid, i, j);
                const newMoves = [...moves, {row: i, col: j}];
                queue.push([newGrid, newMoves]);
            }
        }
    }
    
    document.getElementById('solution').textContent = 'No solution found within depth limit!';
}

// Display the solution
function displaySolution(moves) {
    const solutionDiv = document.getElementById('solution');
    if (moves.length === 0) {
        solutionDiv.textContent = 'Puzzle is already solved!';
        return;
    }
    
    let solutionText = 'Solution steps:\n';
    moves.forEach((move, index) => {
        solutionText += `${index + 1}. Click tile at row ${move.row + 1}, column ${move.col + 1}\n`;
    });
    
    solutionDiv.textContent = solutionText;
}

// Initialize the game
initializeGrid(); 