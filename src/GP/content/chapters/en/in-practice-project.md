# Project: Hedgerow goes to the fair

The village's autumn fair is on Saturday, and Mrs Thistlewood – chair of the fair committee, three-time winner of the
giant pumpkin class – has heard that you wrote a game. "Hedgerow on the big screen in the village hall! But not the
same old game everyone has already seen. It should feel like *our* fair."

She has brought a list. It is written on the back of a seed catalogue, and it is not short: a level of the fair's own,
a score so that the visitors can boast to each other, some sparkle, a present for every visitor, and a proper opening
for the show. Everything on it can be built with what you learnt in *In Practice* – nothing here is new; the challenge
is to fit the pieces into the finished game yourself.

You start from the finished Hedgerow of *Render text*, plus one new file: `levels/five.lvl`, an empty field of zeros
waiting for your level.

## The assignment

1. **A level of the fair's own.** Design a fifth level in `levels/five.lvl` – a pumpkin, a hedgehog, the fair's
   initials: whatever you like, as long as it has some bricks the ball can break. Load it as the fifth level when the
   game starts, and let the game start on it.
2. **A full member of the menu.** W and S should cycle through all five levels (S from the first level goes to your
   level), and after a game over ResetLevel must be able to bring your level back.
3. **Keep score.** Give points for every brick the ball destroys – ten each, or whatever you like – and show `Score:`
   with the points at the top right of the window. A new game starts at zero.
4. **Sparks.** Give the sparks one of the fair's colours (gold, pink, lime – anything but grey), and put up a sparkler:
   a fixed point in the lower half of the window, away from the paddle, from which sparks keep rising.
5. **A gift from the sky.** Add a new power-up that gives an extra life. It spawns from destroyed bricks like the
   others (more rarely, it is a valuable thing). As the fair's welcome gift, one falls from the middle of the window
   (y = 300), straight above the paddle, when the program starts – so the visitors begin with four lives.
6. **The show opens.** Write a new post-processing effect: the picture fades in from black over the first two seconds.
   The text is drawn after the post-processing, so it stays readable from the start.

The milestones in the list next to this text are checked automatically when you click *Check my code*. The course's
simulator plays your game with a fixed input and never presses ENTER, so the game stays in the menu – which is exactly
where the visitors in the village hall will see it first. Update runs in the menu too, so the gift does fall there.

## Tips along the way

- A level file is a grid of numbers, one row per line: `0` is empty, `1` a solid stone, `2` blue, `3` green, `4`
  yellow and `5` orange. InitLevel spreads the grid over the top half of the window, so your level can have as many
  rows and columns as you like – the others have 15 columns and 8 rows. A level with only stones can never be won.
- The menu's level choice uses `% 4` and the number `3` today. `game.Levels.size()` would keep working if a sixth level
  ever turns up.
- RenderText's `x` and `y` are the text's top-left corner. At 24 pixels `Score:0` is about 90 pixels wide, so
  `game.Width - 120.0f` leaves room for a few more digits.
- `Update(Particles, dt, object, newParticles)` spawns particles at any GameObject: they appear at its `Position` and
  move *against* its `Velocity` (a tenth of it). A GameObject that is never drawn makes a fine sparkler – give it a
  large downward velocity and its sparks rise. The ball and the sparkler can share the 500 particles.
- ActivatePowerUp gets only the power-up; the lives belong to the game (the global `Hedgerow`). The powerups chapter's
  test power-ups were put into `game.PowerUps` in Init – the gift works the same way. Any of the six power-up textures
  will do, tinted with a colour of its own.
- A post-processing effect is a change to the post-processing shader, which runs once per pixel of the window.
:::opengl
  The shader already gets the time: `post_processing.vs` declares `uniform float time;`. Declare the same uniform in
  `post_processing.fs` and it is the same value – uniforms belong to the whole program.
:::
:::vulkan
  The shader already gets the time: `shaders/post_processing.frag` has the push constant block with `time`
  (`pc.time`). Remember to compile the shader to SPIR-V again.
:::
:::d3d12
  The shader already gets the time: `post_processing.hlsl` has `time` in its constant buffer, and the pixel shader can
  read it as well as the vertex shader.
:::
- Something missing on the screen? Draw order matters: the sparks are drawn after the paddle and before the ball, the
  text after everything else.

## Want to do more?

Once the milestones are done, the fair is yours. Keep a high score that survives a game over. Add a sixth level, or a
power-up of your own – slow motion for the ball, a second ball, a paddle that shrinks (a negative one, for balance).
Put a sparkler at both ends of the paddle, fade to black when the last life is lost, or show the level's name in the
menu. And then press ENTER and play it: Mrs Thistlewood will expect you to have beaten your own level at least once.
