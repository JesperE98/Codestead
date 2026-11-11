# Audio

The game's making great progress, but it still feels a bit empty as there's no audio whatsoever. In this chapter
learnopengl fixes that – with music in the background and a sound effect whenever something hits something.

{{api}} doesn't offer us any support for sound capabilities (like many other aspects of game development). A graphics
API talks to the GPU and to nothing else.
:::opengl
That holds for OpenGL, Vulkan and DirectX 12 alike.
:::
:::vulkan
That holds for Vulkan as for OpenGL and DirectX 12.
:::
:::d3d12
That holds for Direct3D 12 as for OpenGL and Vulkan (DirectX as a whole has had audio parts, but Direct3D has never
been one of them).
:::
We would have to manually load audio files into a collection of bytes, process and convert them to an audio stream,
and manage multiple audio streams appropriately for use in our game. This can get complicated pretty quickly and
requires some low-level knowledge of audio engineering. So games use a library for it, and so does learnopengl.

**This chapter has no tasks.** The course can't check sound, and it ships no audio files. The project is the `powerups`
chapter's solution as it is – the six test power-ups included –, so you can build and run the game; its pictures are
those of `powerups`: at 1.5 s the six falling pills, at 3.0 s the confused picture with the wide paddle. What follows
explains learnopengl's audio code and where it would go in Hedgerow; you can add it to your own copy with one of the
libraries below.

## irrKlang

learnopengl uses a library for audio management called **irrKlang**. irrKlang is a high level 2D and 3D cross-platform
(Windows, macOS, Linux) sound engine and audio library that plays WAV, MP3, OGG and FLAC files, to name a few. It also
features several audio effects like reverb, delay and distortion that can be extensively tweaked.

3D audio means that an audio source can have a 3D position that will attenuate its volume based on the listener's
distance to the source, making it feel natural in a 3D world – think of gunfire in a 3D world: most often you'll be able
to hear where it came from just by the direction and location of the sound. A 2D game only needs 2D sounds: played
the same in both ears, at their own volume.

irrKlang is an easy-to-use audio library that can play most audio files with just a few lines of code, which makes it
a good candidate for a small game. Note that irrKlang has a slightly restrictive license: you are allowed to use it as
you see fit for non-commercial purposes, but you have to pay for its pro version whenever you want to use it
commercially. irrKlang is closed-source, so you can't compile the library yourself: you use the precompiled library
files it ships with – include its headers, link `irrKlang.lib` (64-bit) and copy its DLL next to the program's
executable; loading MP3 files needs one more DLL, its MP3 plugin.

## Adding music

learnopengl made a small audio track so the game feels a bit more alive: it starts playing when the game starts and
loops until the player closes the game. In the course's structure – learnopengl's code, written as a global and the
free function `Init` – that is:

```cpp
#include <irrklang/irrKlang.h>
using namespace irrklang;

ISoundEngine* SoundEngine = createIrrKlangDevice();

void Init(Game& game)
{
    [...]
    SoundEngine->play2D("audio/music.mp3", true);
}
```

(The file names in this chapter are placeholders – your own files.) Here we create a `SoundEngine` that we use for all
audio-related code. Once the sound engine is initialized, all we need to do to play audio is call its `play2D`
function. Its first parameter is the file name, the second parameter whether we want the file to loop (play again once
it's finished). That is all there is to it: running the game now plays the music. At the end of the program
`SoundEngine->drop();` releases the engine – irrKlang counts references, and `drop` gives up the one
`createIrrKlangDevice` handed out.

## Adding sounds

We can take this a step further by adding sound effects. learnopengl plays a short sound whenever:

- the ball hits a non-solid block – and destroys it,
- the ball hits a solid block,
- the paddle catches a power-up,
- the ball bounces off the paddle.

Wherever such a collision occurs, we play the corresponding sound, without looping – all four places are in
`DoCollisions`. The blocks, for example:

```cpp
// destroy block if not solid
if (!box.IsSolid)
{
    box.Destroyed = true;
    SpawnPowerUps(game, box);
    SoundEngine->play2D("audio/block.wav", false);
}
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
    SoundEngine->play2D("audio/stone.wav", false);
}
```

The power-up's sound goes next to `ActivatePowerUp(powerUp);` in the power-up loop, the paddle's into the paddle
bounce. `play2D` returns immediately; the engine mixes the sounds in a thread of its own, so a new sound can start while
the last one is still playing. Putting it all together gives us a game that feels a lot more complete. irrKlang allows
for much more fine-grained control – advanced memory management, audio effects, or sound event callbacks; its C++
tutorials show them.

## Other libraries

irrKlang is learnopengl's choice, not the only one. Games written with any graphics API use one of these, and the calls
go in exactly the same places – the game's `Init`, `DoCollisions` and its cleanup –, never into the graphics code:

- **OpenAL** (and its open-source implementation **OpenAL Soft**): a cross-platform 3D audio API, designed after
  OpenGL's style – sources, buffers and a listener.
- **miniaudio**: a single-file C library (public domain or MIT-0) that plays and decodes WAV, FLAC and MP3 on every
  platform.
- **SDL_mixer**: SDL's library for music and sound effects.
- **XAudio2**: Microsoft's low-level audio API, part of Windows.

:::d3d12
On Windows, XAudio2 is the natural partner of Direct3D 12. A program creates the engine with `XAudio2Create`, one
**mastering voice** for the audio device (`CreateMasteringVoice`), and a **source voice** for each sound that plays
(`CreateSourceVoice`, with the sound's format). It submits the sound's samples in an `XAUDIO2_BUFFER` with
`SubmitSourceBuffer` and starts the voice with `Start`. For the music, the buffer's `LoopCount` is
`XAUDIO2_LOOP_INFINITE`; an effect is a buffer played once. Two things irrKlang does for you are left to the program:
XAudio2 plays uncompressed PCM samples (and a few Microsoft formats such as ADPCM), so an MP3 file has to be decoded
first – with Media Foundation or a library –, and one source voice plays one sound at a time, so overlapping effects
need several voices.
:::

```quiz
Why can't the game play its music with {{api}}?
- [ ] Because {{api}} only plays sounds in 3D
- [x] Because a graphics API only talks to the GPU: sound needs a separate library, which talks to the audio device
- [ ] Because the music file would have to be uploaded as a texture first
- [ ] Because {{api}} plays sound only in fullscreen mode
---
That is true of OpenGL, Vulkan and Direct3D 12 alike. The audio library's calls go into the game's logic – Init, DoCollisions – not into the rendering code.
```

```quiz
What does the second argument of `SoundEngine->play2D("audio/music.mp3", true)` do?
- [ ] It plays the file in 2D instead of 3D
- [ ] It waits until the file has finished
- [ ] It loads the file into memory before playing it
- [x] It makes the sound loop: play again from the start once it's finished – the music until the game is closed
---
The sound effects pass `false`: each plays once. `play2D` returns at once in both cases; the engine plays the sounds in the background.
```

```quiz
Where would you play the sound for the ball hitting a solid stone?
- [ ] In `Render`, when the stone is drawn
- [x] In `DoCollisions`, in the `else` branch for a solid block – next to the shake that the same hit starts
- [ ] In `Update`, where `ShakeTime` is counted down
- [ ] In the key callback
---
A sound belongs to the event that causes it. The countdown in Update runs in every frame of the shake; a sound there would start three times.
```

:::opengl
```quiz
What should you know about irrKlang's license before using it?
- [ ] It may only be used with OpenGL
- [ ] It is open source under the MIT license
- [x] It is free for non-commercial use only; a commercial game needs its paid pro version – and it is closed source, so you use its precompiled libraries
- [ ] It may only be used on Windows
---
For a commercial game, or one you want to build yourself on any platform, an open library such as OpenAL Soft or miniaudio avoids the question.
```
:::
:::vulkan
```quiz
A Vulkan game wants learnopengl's music and sound effects. Where do the audio calls go?
- [ ] Into `recordCommandBuffer`, so the sound is synchronised with the frame
- [ ] Into a Vulkan audio extension, enabled with the instance
- [ ] Into the fragment shader of the post-processing pass
- [x] Into the same places as learnopengl's: the audio library is set up in `Init`, the effects are played in `DoCollisions`, the engine is released in `cleanup()` – none of it touches Vulkan
---
Vulkan has no audio, and no extension adds it. irrKlang, OpenAL Soft, miniaudio or SDL_mixer work with any graphics API.
```
:::
:::d3d12
```quiz
With XAudio2, how is the music made to loop?
- [x] With the `XAUDIO2_BUFFER` submitted to its source voice: `LoopCount = XAUDIO2_LOOP_INFINITE`
- [ ] With a second argument `true` of `Start`
- [ ] By calling `SubmitSourceBuffer` again in every frame
- [ ] With a Direct3D 12 audio queue
---
An effect is submitted once, without a loop. Note that XAudio2 plays PCM samples: an MP3 file must be decoded first, with Media Foundation or a library.
```
:::

## Additional resources

- [Audio](https://learnopengl.com/In-Practice/2D-Game/Audio): learnopengl's chapter this chapter follows.

:::d3d12
- [How to: Initialize XAudio2](https://learn.microsoft.com/en-us/windows/win32/xaudio2/how-to--initialize-xaudio2) and
  [How to: Play a sound with XAudio2](https://learn.microsoft.com/en-us/windows/win32/xaudio2/how-to--play-a-sound-with-xaudio2):
  Microsoft's audio API.
:::
