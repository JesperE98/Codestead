# OIT Introduction – no tasks (Vulkan)

learnopengl "Guest Articles / OIT / Introduction" has no code: the chapter explains why ordinary alpha blending depends
on the drawing order (the "over" operator is not commutative, and depth writes from a near transparent object hide the
objects behind it), why sorting by distance is not always possible (intersecting and cyclically overlapping objects,
sorting per object vs. per fragment) and the families of order-independent transparency (depth peeling, per-pixel
linked lists / A-buffers, weighted blended OIT). **No tasks**; `edits.txt` is empty.

start/ = solution/ = the start of the next chapter (`weighted-blended/start`), so the learner can build and run the
problem the chapter describes: `main.cpp` (the camera at (0, 0, 5); everything drawn into the window's render pass) and
in `shaders/`: `solid.vert/.frag`, `transparent.vert/.frag` (ordinary blending: `frag = pc.color`), and
`composite.vert/.frag`, `screen.vert/.frag` (used from the next chapter on; `composite.frag`'s `main` is still a TODO).
In Vulkan the blending is part of the pipeline: the transparent pipeline is created with `blendEnable = VK_TRUE`,
`srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA` and depth
writes on (`createPipeline("shaders/transparent.vert.spv", …, renderPass, 1, VK_TRUE, VK_TRUE, VK_TRUE,
VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, …)`). See `../weighted-blended/tasks.md` for the fixed
choices.

Picture (lavapipe, 800×600, nothing depends on time – the same as OpenGL's): on black, an opaque red quad (x 309..671,
y 155..516), a half transparent green quad in front of everything (x 86..568, y 203..599) and a half transparent blue
quad at the back (x 168..457, y 83..371), partly behind the red quad. The quads are blended with SRC_ALPHA /
ONE_MINUS_SRC_ALPHA with depth writes on, in the order green (near), blue (far) – the wrong order: where the green quad
covers the blue one (x 168..308, y 203..371) the blue quad is missing (pixel (230,300) = 0,128,0, only green over
black) – the blue quad's lower left corner is cut off along the green quad's top edge. Other points: (620,300) =
255,0,0 (red), (450,400) = 127,128,0 (green over red), (200,450) = 0,128,0, (250,120) = 0,0,128, (400,180) = 255,0,0
(red in front of blue), (700,80) = 0,0,0.
