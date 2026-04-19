# game_on

Browser port of the platformer prototype using Phaser 3.

## Run locally

From `/Users/ivan/work/game/game_on`:

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

## Current scope

- Main menu
- Loading screen
- Procedural level generation
- Core movement: run, jump, double jump, wall jump, wall slide
- Enemies, coins, moving platforms, saws, portals, finish
- Death animation
- Ghost replay after level completion
- Next level only after `Enter`

This is the first browser slice, not full parity with the Python prototype yet.
