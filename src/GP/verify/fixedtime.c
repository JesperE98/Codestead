/* fixedtime.c – deterministic time and input for verify.sh (LD_PRELOAD shim for GLFW programs).
 *
 * The course's game chapters (and any project run with VERIFY_FIXEDTIME=1) must show the same picture on every
 * driver and in the app's simulator, so verify.sh preloads this library into the program:
 *
 *   - Time: glfwGetTime() returns frames / 60, where `frames` counts the program's glfwPollEvents() calls so far.
 *     Frame n of the render loop (n = 0, 1, 2 …) therefore sees glfwGetTime() = n / 60 and learnopengl's deltaTime
 *     is exactly 1/60 – whether the loop polls at its start (learnopengl's game) or at its end. The time stops
 *     advancing at VERIFY_T seconds (default 1.0): after that deltaTime is 0, the program keeps running and the
 *     screenshot (taken after VERIFY_WAIT seconds of real time) shows the state at VERIFY_T.
 *   - Input: no real key is pressed. The space bar is pressed at t = 0.5 s and released at t = 0.55 s: the
 *     glfwPollEvents() call made when glfwGetTime() reads 30/60 calls the program's key callback (the function
 *     given to glfwSetKeyCallback) with (GLFW_KEY_SPACE, scancode, GLFW_PRESS, 0) after the real events, and the
 *     call made at 33/60 calls it with GLFW_RELEASE. Events after VERIFY_T are not sent.
 *
 * Build: gcc -shared -fPIC -o fixedtime.so fixedtime.c -ldl   (verify.sh does this when a project needs it)
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
#include <GLFW/glfw3.h>

#define PRESS_FRAME   30 /* 0.5 s  */
#define RELEASE_FRAME 33 /* 0.55 s */

static long frames = 0;
static GLFWwindow* key_window = NULL;
static GLFWkeyfun key_callback = NULL;

/* The last frame whose time is still shown: VERIFY_T * 60 (default 60 = 1 s). */
static long last_frame(void)
{
    const char* t = getenv("VERIFY_T");
    double seconds = t ? atof(t) : 1.0;
    return (long)(seconds * 60.0 + 0.5);
}

double glfwGetTime(void)
{
    long f = frames < last_frame() ? frames : last_frame();
    return (double)f / 60.0;
}

GLFWkeyfun glfwSetKeyCallback(GLFWwindow* window, GLFWkeyfun callback)
{
    GLFWkeyfun (*real)(GLFWwindow*, GLFWkeyfun) = (GLFWkeyfun (*)(GLFWwindow*, GLFWkeyfun))dlsym(RTLD_NEXT, "glfwSetKeyCallback");
    key_window = window;
    key_callback = callback;
    return real(window, callback);
}

void glfwPollEvents(void)
{
    void (*real)(void) = (void (*)(void))dlsym(RTLD_NEXT, "glfwPollEvents");
    real();
    if (key_callback && key_window && frames <= last_frame())
    {
        int (*scancode)(int) = (int (*)(int))dlsym(RTLD_NEXT, "glfwGetKeyScancode");
        int sc = scancode ? scancode(GLFW_KEY_SPACE) : 0;
        if (frames == PRESS_FRAME)
            key_callback(key_window, GLFW_KEY_SPACE, sc, GLFW_PRESS, 0);
        else if (frames == RELEASE_FRAME)
            key_callback(key_window, GLFW_KEY_SPACE, sc, GLFW_RELEASE, 0);
    }
    frames++;
}
