# Audio (Hedgerow) – no tasks (Vulkan)

learnopengl "2D Game / Audio" adds music and sound effects with the irrKlang library: an `ISoundEngine` made with
`createIrrKlangDevice()`, background music started in Init with `SoundEngine->play2D("…breakout.mp3", true)` (looping),
and short effects in DoCollisions – a bleep when a brick breaks or the ball hits a solid block, another when the ball
hits the paddle, a "powerup" sound when the paddle catches a power-up – each `play2D(file, false)`; `drop()` at the end
(see `../../opengl/audio/tasks.md`).

**Vulkan does no audio at all** – like OpenGL and DirectX 12, it only talks to the GPU. A Vulkan program plays sound
with a separate library, exactly as learnopengl's OpenGL program does: irrKlang (free for non-commercial use only),
OpenAL / OpenAL Soft, miniaudio or SDL_mixer on any platform, XAudio2 on Windows. The calls would go into the same
places as learnopengl's (the free functions `Init`, `DoCollisions` and `cleanup()`), never into the Vulkan code.

The course's simulator plays no sound and the course ships no audio files, so this chapter has **no tasks**:
`edits.txt` is empty and start/ = solution/ = `powerups`' solution (the power-ups' test row included), so the learner
can build and run the game as it is.

Picture: the same as `powerups`' solution (see `../powerups/tasks.md`) – at 3.0 s (frame 180) the confused picture
with the 150 px paddle, at 1.5 s (frame 90) the six falling power-ups.
