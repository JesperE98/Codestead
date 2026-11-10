# Hello Window – tasks (OpenGL)

learnopengl "Hello Window". Start = `creating-a-window/solution` plus TODO comments: two declarations at the top,
the callback registration after `glfwMakeContextCurrent`, the render loop, and the two function definitions at the
bottom of the file. The start runs like the previous chapter (window opens and closes at once). Solution =
learnopengl's `hello_window_clear.cpp`.

## `render-loop`
- **Task:** Add the render loop: `while (!glfwWindowShouldClose(window))` that calls `glfwSwapBuffers(window)` and `glfwPollEvents()` every frame.
- **Hint:** Without a loop `main` ends straight away. `glfwPollEvents` processes window events (including the close button), `glfwSwapBuffers` shows the frame that was drawn.
- **When done:** the loop `while (!glfwWindowShouldClose(window)) { … glfwSwapBuffers(window); glfwPollEvents(); }`
  sits before `glfwTerminate();`. The window now **stays open** until it is closed with the close button. Its content
  is not cleared yet, so it is undefined (black under Mesa). The replacement also puts two placeholder TODO comments
  inside the loop (`// TODO: process the input (processInput)` and `// TODO: clear the screen with a colour`) for
  the next tasks.

## `viewport`
- **Task:** Make the viewport follow the window size: write `framebuffer_size_callback` (calls `glViewport(0, 0, width, height)`), declare it at the top, and register it with `glfwSetFramebufferSizeCallback`.
- **Hint:** The callback has the signature `void framebuffer_size_callback(GLFWwindow* window, int width, int height)`. Register it right after `glfwMakeContextCurrent(window);`.
- **When done:** declaration `void framebuffer_size_callback(GLFWwindow* window, int width, int height);` at the top,
  `glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);` after `glfwMakeContextCurrent(window);`, and the
  definition at the bottom with `glViewport(0, 0, width, height);`. Nothing changes visibly yet (nothing is drawn);
  resizing the window calls the callback.

## `input`
- **Task:** Close the window with Escape: write `processInput` (`glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS` → `glfwSetWindowShouldClose(window, true)`), declare it, and call it at the start of every frame.
- **Hint:** Call `processInput(window);` as the first thing inside the render loop (it replaces the input TODO).
- **When done:** declaration `void processInput(GLFWwindow *window);` at the top, `processInput(window);` first in the
  loop, the definition at the bottom with the Escape check. Pressing **Escape** closes the window; otherwise the same
  as before.

## `clear`
- **Task:** Clear the screen every frame: `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` then `glClear(GL_COLOR_BUFFER_BIT);`.
- **Hint:** `glClearColor` only sets the colour (state); `glClear` does the clearing. Put both in the render section of the loop, before `glfwSwapBuffers`.
- **When done:** both calls are in the loop (replacing the clear TODO). The whole window is dark teal
  `(0.2, 0.3, 0.3, 1.0)` (sRGB 51,76,76). Final state of the chapter.
