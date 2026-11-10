# Powerups (Hedgerow) – tasks (OpenGL)

**Screenshot time: t = 3.0 s (frame 180); second check time t = 1.5 s (frame 90).** With the course's fixed input
no brick is destroyed (the ball bounces off a solid stone and is lost), so no power-up ever spawns from a brick. The
task `try-powerups` therefore spawns one power-up of each kind in Init, in a row in the empty row 4 (y = 160) at
x = 40, 150, 260, 370, 480, 590 (speed, sticky, pass-through, pad-size-increase, confuse, chaos): at 1.5 s they fall
past the middle of the window; the pad-size-increase one (x 370, over the paddle) is caught in frame 160, after the
ball was lost and reset (frame 151), so at 3.0 s the paddle is 150 pixels wide. (Work in progress: values follow.)
