# Sprite credits

## Grey cat (in use)

Sprites export from **`assets/source/Cat_Grey.aseprite`** via `npm run sprites`.

| Behavior | Animation key | Aseprite tag |
|----------|---------------|--------------|
| Sitting (dormant) | `sit` | `Sit_1` |
| Napping (dormant) | `nap` | `Dream` |
| Short walk | `walk` | `W_1` |
| Long idle flourish (`stretch` key) | `stretch` | `Idle_3` |
| Brief alert | `alert` | `Idle_2` |
| Touch: look | `look_tilt` | `Idle_Tilt_1` |
| Touch: look up | `look_lift` | `Idle_Lift_1` |
| Touch: sit & look | `sit_tilt` | `Sit_Tilt_1` |
| Touch: happy | `happy` | `Idle_Yes` |
| Touch: scratch | `scratch` | `Scratching_Start` |

Tune vertical position in `scripts/export-sprites-from-aseprite.mjs`: `liftPx`, `drawOffsetY`, `canvasPadTop`, and per-animation `drawOffsetY`.
