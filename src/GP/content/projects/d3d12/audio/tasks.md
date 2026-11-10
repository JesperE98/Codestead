# Audio (Hedgerow) – no tasks (DirectX 12)

learnopengl "2D Game / Audio" adds music and sound effects with the irrKlang library: an `ISoundEngine` made with
`createIrrKlangDevice()`, background music started in Init with `SoundEngine->play2D("…breakout.mp3", true)` (looping),
and short effects in DoCollisions – a bleep when a brick breaks or the ball hits a solid block, another when the ball
hits the paddle, a "powerup" sound when the paddle catches a power-up – each `play2D(file, false)`; `drop()` at the end.

The course's simulator plays no sound and the course ships no audio files, so this chapter has **no tasks**:
`edits.txt` is empty and start/ = solution/ = `powerups`' solution (the power-ups' test row included), so the learner can
build and run the game as it is. Direct3D 12 does no audio, like every graphics API: on Windows a Direct3D program
plays sound with **XAudio2** (part of Windows: `XAudio2Create`, an `IXAudio2MasteringVoice` for the device and an
`IXAudio2SourceVoice` per sound, fed with `SubmitSourceBuffer` – a looping buffer for the music, one-shot buffers for
the effects), or with a cross-platform library such as miniaudio, OpenAL Soft, SDL_mixer or irrKlang (free for
non-commercial use only). The calls go to the same places as learnopengl's play2D calls.

Picture: the same as `powerups`' solution (see `../powerups/tasks.md`) – at 3.0 s (frame 180) the confused picture with
the 150 px paddle, at 1.5 s (frame 90) the six falling power-ups.
