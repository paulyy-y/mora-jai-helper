# Design: Mora Jai solver

The contract every UI change in this repo follows. Written when the repo got its first tokens; update it in the same change as the tokens.

## System and profile
- System: the house design system (`~/.agents/skills/web-ui-kronus/references/design-system.md`): classic desktop layout drawn flat, sock palette, system fonts.
- Profile: web app (title line, toolbar, panes, status bar), one screen. One person copies a Mora Jai puzzle box from Blue Prince onto the board and reads off the shortest list of tiles to press, on a desktop beside the game or on a phone.
- Layout: from 768px the Board and Saved puzzles group boxes sit in a 360px left column and the Solution table fills the right, scrolling inside its pane; below 768px everything stacks in DOM order (board, solution, saved puzzles), so Tab order always follows the screen.

## Tokens
- Source: `mora-jai-helper/public/tokens.css`, an unchanged copy of `assets/tokens.css` (the only place UI colors, sizes, radii, shadows and durations are defined). `index.html` holds layout and components only.
- Tile colours: `mora-jai-helper/public/pieces.css` holds the game's eight tile colours (`--piece-*`) with a letter colour for each (`--on-piece-*`). They are the puzzle's content, not UI colour, and stay the same in both themes. Every tile and corner shows its shortcut letter, so colour never carries meaning alone.
- Themes: Ink (dark) by default; Oat (light) via `data-theme="light"` on `<html>`, set by the house's shared theme script (`https://ui.paulyy.com/theme.js`, loaded in `<head>`) and its `<theme-toggle>` sun/moon button at the right of the title line. The choice is the shared `theme` cookie on `.paulyy.com`, so it matches every other paulyy.com site; a light choice saved here before (`localStorage` `moraJai.theme`) moves into it once. The script also keeps `<meta name="theme-color">` on `--bg`. The UI says light and dark, never Ink or Oat.
- Fonts: IBM Plex Sans and IBM Plex Mono from `https://ui.paulyy.com/plex.css`, imported by tokens.css, so nothing is bundled here; each stack ends in system faces for when that host can't be reached. The favicon's inline SVG keeps a system face, since an SVG used as an image can't load web fonts.

| Token | Role | Pairs (minimum) |
|---|---|---|
| `--bg`, `--panel`, `--code`, `--sel` | page, panes, toolbars and headers, selection | |
| `--text`, `--muted`, `--faint` | body, secondary, metadata | 4.5:1 on every surface |
| `--accent`, `--on-accent` | primary action (Solve), the pressed tile in a step, focus | 4.5:1 as text; `--on-accent` 4.5:1 on the fill |
| `--ok`, `--warn`, `--bad`, `--info` and `-soft` | solver notices, always with a word and an icon | 4.5:1 on surfaces and on their `-soft` fill |
| `--input`, `--focus` | control, tile and pane borders, focus ring | 3:1 on `--bg`, `--panel`, `--code` |
| `--border` | hairlines inside panes | none |
| `--band-1` to `--band-4` | the knit band, once at the top | 3:1 on `--bg` |
| `--piece-*`, `--on-piece-*` | tile fills and the letter on them | 4.5:1 letter on fill |

## Type, space, shape, motion
- Type: `--font-display` for headings, legends, table headers and tile letters; `--font` for text; `--mono` for the keys in Help. Labels (legends, table headers) are sentence case, 13px semibold in `--muted`, never uppercase. Sizes 12 / 13 / 14 / 16 / 18 px; weights 400 and 600, with 700 only for the letters on tiles.
- Space: 4px steps. Radius: 2px on controls and tiles, 0 on panes and group boxes. Shadow: the Help dialog only.
- Motion: only the Help dialog fades in (120 ms, `--dur-fast`); nothing else animates; off under reduced motion.
- Breakpoints: phone below 768px, desktop from 768px.
- Behaviour, icons, forms and formats: as `design-system.md` in the web-ui-kronus skill says (no toasts; Lucide icons beside words).

## States
Every state can be reached from the page itself:
- Solved: the default board on load (10 presses).
- Already open: set all four corners to match the corner tiles (default board: top-left gray, top-right orange, bottom-left blue, bottom-right orange).
- No answer: set every tile gray (the search space is one position).
- No answer in 50,000 positions, progress after one second, and Stop: set all four corners white and the board to pink, black, yellow / purple, pink, black / yellow, purple, orange; press Stop within about 7 seconds to see Stopped.
- Saved puzzles: empty on a fresh browser profile; Save puzzle with an empty name shows the field error; Delete then Undo delete within 5 seconds.

## Do
- Reuse the components in `design-system.md` (title line, toolbar, group box, tables) before adding new ones.
- Report results in the button that did the work ("Saved", "Replaced", "Undo delete") or in the solution pane; solver progress also goes to the status bar.
- Name buttons verb + object; keep the same name through the flow.

## Don't
- Literal colors outside `tokens.css` and `pieces.css`.
- Menu bars, underlined shortcut letters, fake window buttons, filler status text, big cards that only show a number.
- Gradients (other than the knit band), glass, hero banners, alert pop-ups or decorative motion.

## Exceptions
None: no `ui-scan-ignore` comments.

## Check
`node ~/.agents/skills/web-ui-kronus/scripts/ui-scan.mjs mora-jai-helper/public --strictness standard` exits 0. It checks every token pair in both themes, Ink (bare `:root`) and Oat (`data-theme="light"`), plus the tile letter pairs in `pieces.css`; its summary line lists `(light, dark)`.
