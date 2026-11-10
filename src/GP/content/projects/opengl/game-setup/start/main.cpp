#include <glad/glad.h>
#include <GLFW/glfw3.h>
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <map>
#include <vector>

// Hedgerow: a ball, a paddle and a wall of blocks.
// learnopengl splits its game into classes and files (Game, ResourceManager, Shader, Texture2D, SpriteRenderer ...);
// here each class is a plain struct with free functions, in one file, in the order of learnopengl's files.

// The width of the screen
const unsigned int SCREEN_WIDTH = 800;
// The height of the screen
const unsigned int SCREEN_HEIGHT = 600;

// Shader (learnopengl: shader.h, shader.cpp)
// ------------------------------------------
// TODO: struct Shader (the program's ID) and the functions Use, checkCompileErrors, Compile, SetInteger, SetVector3f, SetMatrix4

// Texture2D (learnopengl: texture.h, texture.cpp)
// -----------------------------------------------
// TODO: struct Texture2D (ID, size, formats, wrap and filter modes) and the function Generate

// ResourceManager (learnopengl: resource_manager.h, resource_manager.cpp)
// -----------------------------------------------------------------------
// TODO: the maps Shaders and Textures and the functions LoadShader, GetShader, LoadTexture, GetTexture, ClearResources

// Game (learnopengl: game.h, game.cpp)
// ------------------------------------
// TODO: enum GameState, struct Game (State, Keys, Width, Height), the global Game Hedgerow and the functions Init, ProcessInput, Update, Render

// Program (learnopengl: program.cpp)
// ----------------------------------
// GLFW function declarations
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
// TODO: declare key_callback(window, key, scancode, action, mode)

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
    glfwWindowHint(GLFW_RESIZABLE, false);

    GLFWwindow* window = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Hedgerow", nullptr, nullptr);
    if (window == nullptr)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    // glad: load all OpenGL function pointers
    // ---------------------------------------
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    // TODO: register key_callback
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    // OpenGL configuration
    // --------------------
    glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    // TODO: initialize game

    // TODO: deltaTime variables

    while (!glfwWindowShouldClose(window))
    {
        // TODO: calculate delta time
        glfwPollEvents();

        // TODO: manage user input and update game state

        // render
        // ------
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        // TODO: render the game

        glfwSwapBuffers(window);
    }

    // TODO: delete all resources as loaded using the resource manager

    glfwTerminate();
    return 0;
}

// TODO: key_callback(): Escape closes the window; every key press and release is stored in Hedgerow.Keys

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
