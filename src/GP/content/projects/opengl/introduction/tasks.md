# Introduction – tasks (OpenGL)

Start and solution: learnopengl's `hello_triangle.cpp` (one file, `main.cpp`, shaders as embedded strings).
The program opens an 800×600 window titled "LearnOpenGL", clears it to `(0.2, 0.3, 0.3, 1.0)` (dark teal,
sRGB 51,76,76) and draws an orange triangle `(1.0, 0.5, 0.2, 1.0)` (255,128,51) with the corners
(-0.5, -0.5), (0.5, -0.5), (0.0, 0.5) in normalized device coordinates = window pixels (200,450), (600,450),
(400,150). Escape closes the window.

## `build-run`
- **Task:** Press **Build & run** and look at the result: an orange triangle on a dark teal background.
- **Hint:** You don't have to change anything yet – the code is the program you will write yourself in the next chapters.
- **When done:** no code change (edits.txt has no edits for this task). Done when the project was built and run once:
  the window shows the orange triangle on teal (centre pixel 400,300 is orange 255,128,51; corners are teal).

## `color`
- **Task:** Make the triangle green: in the fragment shader (`fragmentShaderSource`) change the colour to `vec4(0.2f, 0.8f, 0.3f, 1.0f)`.
- **Hint:** The fragment shader's `FragColor = vec4(r, g, b, a);` line sets the colour of every pixel of the triangle; the values go from 0.0 to 1.0.
- **When done:** the line in `fragmentShaderSource` reads `"   FragColor = vec4(0.2f, 0.8f, 0.3f, 1.0f);\n"`.
  The triangle is green `(0.2, 0.8, 0.3, 1.0)` (sRGB 51,204,76), same shape and position; background still teal.
