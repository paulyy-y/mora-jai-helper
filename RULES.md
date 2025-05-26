A Mora Jai grid is 3x3. each tile is one of the colors listed below along with its associated actions. An action is triggered by pressing a tile. On each corner of the board, there is a color. In order to open a Mora Jai box, each corner must hold a tile matching the symbol color.

Tile Colors and Behaviors
- Orange: If there is a majority color around it, pressing the tile will change color to the majority color. 
- Yellow: Swaps with piece above it. If it is at the top, does nothing.
- Blue: Copies the action of the item in the center of the board.
- Black: Shifts row to the right. Loops over.
- Gray: Does nothing.

Create an HTML/JS application that will allow user to input the starting tiles + colors as well as the corner colors. And once that is done, provide a set of moves that must be taken in sequence in order to solve the puzzle.