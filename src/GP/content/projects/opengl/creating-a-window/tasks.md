# Creating a window – tasks (OpenGL)

learnopengl "Creating a window" + the first half of "Hello Window". Start: includes (`glad/glad.h` before
`GLFW/glfw3.h`, `iostream`), the `SCR_WIDTH`/`SCR_HEIGHT` settings (800, 600) and a `main()` made of TODO comments
that returns 0. There is no render loop in this chapter: once a window exists it opens and closes again at once
(the screenshot of the run is black). Every step builds and runs without errors.

## `glfw-init`
- **Task:** Initialize GLFW with `glfwInit()` and ask for an OpenGL 3.3 core profile context with `glfwWindowHint`.
- **Hint:** Three hints: `GLFW_CONTEXT_VERSION_MAJOR` 3, `GLFW_CONTEXT_VERSION_MINOR` 3 and `GLFW_OPENGL_PROFILE` = `GLFW_OPENGL_CORE_PROFILE`. macOS also needs `GLFW_OPENGL_FORWARD_COMPAT` (inside `#ifdef __APPLE__`).
- **When done:** `main` starts with `glfwInit();`, then `glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);`,
  `glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);`, `glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);`
  and `#ifdef __APPLE__ glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE); #endif`. Nothing visible yet: no window,
  the program exits with 0.

## `create-window`
- **Task:** Create an 800×600 window titled "LearnOpenGL" with `glfwCreateWindow`, check it, and make its context current.
- **Hint:** `glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL)` returns `NULL` on failure: then print an error, call `glfwTerminate()` and `return -1`. Then `glfwMakeContextCurrent(window)`.
- **When done:** `GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);`, an
  `if (window == NULL)` block that prints `Failed to create GLFW window`, calls `glfwTerminate()` and returns -1, and
  `glfwMakeContextCurrent(window);`. A window 800×600 titled "LearnOpenGL" is created and disappears immediately
  (the program ends right away; nothing is drawn into it).

## `glad`
- **Task:** Load the OpenGL function pointers with GLAD: `gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)`, and stop if it fails.
- **Hint:** It must come after `glfwMakeContextCurrent` – GLAD asks the current context for the function addresses. On failure print `Failed to initialize GLAD` and `return -1`.
- **When done:** `if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) { std::cout << "Failed to initialize GLAD" << std::endl; return -1; }`
  after `glfwMakeContextCurrent(window);`. Same visible result as before (window flashes and closes), no error printed.

## `terminate`
- **Task:** Clean up GLFW at the end of `main` with `glfwTerminate()`.
- **Hint:** It destroys the window and frees everything GLFW allocated; put it right before `return 0;`.
- **When done:** `glfwTerminate();` before `return 0;` at the end of `main`. Same visible result; the program exits
  cleanly with 0. This is the final state of the chapter (`solution/`).
