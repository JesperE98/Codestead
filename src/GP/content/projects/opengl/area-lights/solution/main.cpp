// Area lights with Linearly Transformed Cosines (LTC):
// Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt, "Real-Time Polygonal-Light Shading with Linearly
// Transformed Cosines", SIGGRAPH 2016 - https://eheitzresearch.wordpress.com/415-2/
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#define STB_IMAGE_IMPLEMENTATION // the bodies of stb_image's functions (headers only include its declarations)
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include "shader_m.h"
#include "ltc_matrix.hpp" // the LTC tables LTC1 and LTC2 (64 x 64 x RGBA floats each)

#include <iostream>
#include <string>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void processInput(GLFWwindow *window);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
unsigned int loadTexture(const char *path, bool gammaCorrection);

// settings
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

// camera: high above the floor behind the lights, looking down at them (yaw 89.4, pitch -34.3)
glm::vec3 cameraPos   = glm::vec3(-0.224556f, 10.4038f, -18.9259f);
glm::vec3 cameraFront = glm::vec3(0.00865f, -0.56356f, 0.82605f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f, 0.0f);

bool firstMouse = true;
float yaw   = 89.3999f;
float pitch = -34.3001f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
float fov   =  45.0f;

// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;

// the floor and the light's rectangle: position, normal, texture coordinates
struct VertexAL {
    glm::vec3 position;
    glm::vec3 normal;
    glm::vec2 texcoord;
};

//
// 2---3-5
// |  / /|
// | / / |
// |/ /  |
// 1-4---6
//
const float psize = 10.0f;
VertexAL planeVertices[6] = {
    { {-psize, 0.0f, -psize}, {0.0f, 1.0f, 0.0f}, {0.0f, 0.0f} },
    { {-psize, 0.0f,  psize}, {0.0f, 1.0f, 0.0f}, {0.0f, 1.0f} },
    { { psize, 0.0f,  psize}, {0.0f, 1.0f, 0.0f}, {1.0f, 1.0f} },
    { {-psize, 0.0f, -psize}, {0.0f, 1.0f, 0.0f}, {0.0f, 0.0f} },
    { { psize, 0.0f,  psize}, {0.0f, 1.0f, 0.0f}, {1.0f, 1.0f} },
    { { psize, 0.0f, -psize}, {0.0f, 1.0f, 0.0f}, {1.0f, 0.0f} }
};
VertexAL areaLightVertices[6] = {
    { {-8.0f, 2.4f, -1.0f}, {1.0f, 0.0f, 0.0f}, {0.0f, 0.0f} }, // 0 1 5 4
    { {-8.0f, 2.4f,  1.0f}, {1.0f, 0.0f, 0.0f}, {0.0f, 1.0f} },
    { {-8.0f, 0.4f,  1.0f}, {1.0f, 0.0f, 0.0f}, {1.0f, 1.0f} },
    { {-8.0f, 2.4f, -1.0f}, {1.0f, 0.0f, 0.0f}, {0.0f, 0.0f} },
    { {-8.0f, 0.4f,  1.0f}, {1.0f, 0.0f, 0.0f}, {1.0f, 1.0f} },
    { {-8.0f, 0.4f, -1.0f}, {1.0f, 0.0f, 0.0f}, {1.0f, 0.0f} }
};

// the material: a grey colour (not used by the shader) and the roughness
const glm::vec3 SLATE_GRAY = glm::vec3(0.439216f, 0.501961f, 0.564706f);
const float ROUGHNESS = 0.5f;

// several area lights: each one the rectangle above, turned about the y axis (and moved by an offset)
struct AreaLight {
    glm::vec3 offset;
    float yRotation;

    glm::vec3 color;
    float intensity = 2.0f;
    bool twoSided = true;
};

// eight lights on a ring of radius 8 around the middle of the floor, every one turned to face the middle
const int NUM_AREA_LIGHTS = 8;
AreaLight areaLights[NUM_AREA_LIGHTS] = {
    { glm::vec3(0.0f), glm::radians(  0.0f), glm::vec3(1.0f, 0.55f, 0.25f) },
    { glm::vec3(0.0f), glm::radians( 45.0f), glm::vec3(1.0f, 0.85f, 0.3f) },
    { glm::vec3(0.0f), glm::radians( 90.0f), glm::vec3(0.55f, 1.0f, 0.35f) },
    { glm::vec3(0.0f), glm::radians(135.0f), glm::vec3(0.3f, 1.0f, 0.75f) },
    { glm::vec3(0.0f), glm::radians(180.0f), glm::vec3(0.3f, 0.75f, 1.0f) },
    { glm::vec3(0.0f), glm::radians(225.0f), glm::vec3(0.4f, 0.45f, 1.0f) },
    { glm::vec3(0.0f), glm::radians(270.0f), glm::vec3(0.8f, 0.4f, 1.0f) },
    { glm::vec3(0.0f), glm::radians(315.0f), glm::vec3(1.0f, 0.4f, 0.65f) }
};

unsigned int planeVBO, planeVAO;
unsigned int areaLightVBO, areaLightVAO;

void configureMockupData()
{
    // PLANE
    glGenVertexArrays(1, &planeVAO);
    glGenBuffers(1, &planeVBO);

    glBindVertexArray(planeVAO);
    glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);

    // position
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // normal
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    // texcoord
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
    glBindVertexArray(0);

    // AREA LIGHT
    glGenVertexArrays(1, &areaLightVAO);
    glBindVertexArray(areaLightVAO);

    glGenBuffers(1, &areaLightVBO);
    glBindBuffer(GL_ARRAY_BUFFER, areaLightVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(areaLightVertices), areaLightVertices, GL_STATIC_DRAW);

    // position
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // normal
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    // texcoord
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
    glBindVertexArray(0);
}

void renderPlane()
{
    glBindVertexArray(planeVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

void renderAreaLight()
{
    glBindVertexArray(areaLightVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

// the two LTC lookup textures
struct LTC_matrices {
    unsigned int mat1;
    unsigned int mat2;
};

// LTC1: the inverse matrices M^-1 (4 numbers per texel), as a 64 x 64 float texture
unsigned int loadMTexture()
{
    unsigned int texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);

    // GL_RGBA32F: four 32-bit floats per texel (the numbers are outside 0..1, an 8-bit format would clamp them)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 64, 64, 0, GL_RGBA, GL_FLOAT, LTC1);

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    glBindTexture(GL_TEXTURE_2D, 0);
    return texture;
}

// LTC2: the BRDF's norm and Fresnel terms and the horizon-clipping sphere, as a 64 x 64 float texture
unsigned int loadLUTTexture()
{
    unsigned int texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);

    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 64, 64, 0, GL_RGBA, GL_FLOAT, LTC2);

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    glBindTexture(GL_TEXTURE_2D, 0);
    return texture;
}

int main()
{
    // glfw: initialize and configure
    // ------------------------------
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif

    // glfw window creation
    // --------------------
    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetScrollCallback(window, scroll_callback);

    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    // glad: load all OpenGL function pointers
    // ---------------------------------------
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    // configure global opengl state
    // -----------------------------
    glEnable(GL_DEPTH_TEST);

    // LUT textures
    // ------------
    LTC_matrices mLTC;
    mLTC.mat1 = loadMTexture();
    mLTC.mat2 = loadLUTTexture();

    // build and compile shaders
    // -------------------------
    Shader shaderLTC("area_light.vs", "area_light.fs");
    Shader shaderLightPlane("light_plane.vs", "light_plane.fs");

    // load textures
    // -------------
    unsigned int floorTexture = loadTexture("wood.png", true); // the image's colours are sRGB (gamma-encoded)

    // shader configuration
    // --------------------
    shaderLTC.use();
    for (int i = 0; i < NUM_AREA_LIGHTS; i++)
    {
        // the light's model matrix: turned about y, then moved by its offset
        glm::mat4 model(1.0f);
        model = glm::translate(model, areaLights[i].offset);
        model = glm::rotate(model, areaLights[i].yRotation, glm::vec3(0.0f, 1.0f, 0.0f));

        // its four corners in world space (vertices 0, 1, 4, 5 of the rectangle)
        glm::vec3 p0 = glm::vec3(model * glm::vec4(areaLightVertices[0].position, 1.0f));
        glm::vec3 p1 = glm::vec3(model * glm::vec4(areaLightVertices[1].position, 1.0f));
        glm::vec3 p2 = glm::vec3(model * glm::vec4(areaLightVertices[4].position, 1.0f));
        glm::vec3 p3 = glm::vec3(model * glm::vec4(areaLightVertices[5].position, 1.0f));

        std::string str_pos = "areaLights[" + std::to_string(i) + "].points";
        std::string str_col = "areaLights[" + std::to_string(i) + "].color";
        std::string str_int = "areaLights[" + std::to_string(i) + "].intensity";
        std::string str_two = "areaLights[" + std::to_string(i) + "].twoSided";
        shaderLTC.setVec3(str_pos + "[0]", p0);
        shaderLTC.setVec3(str_pos + "[1]", p1);
        shaderLTC.setVec3(str_pos + "[2]", p2);
        shaderLTC.setVec3(str_pos + "[3]", p3);
        shaderLTC.setVec3(str_col, areaLights[i].color);
        shaderLTC.setFloat(str_int, areaLights[i].intensity);
        shaderLTC.setBool(str_two, areaLights[i].twoSided);
    }
    shaderLTC.setInt("numAreaLights", NUM_AREA_LIGHTS);
    shaderLTC.setInt("LTC1", 0);
    shaderLTC.setInt("LTC2", 1);
    shaderLTC.setInt("material.diffuse", 2);
    shaderLTC.setVec4("material.albedoRoughness", glm::vec4(SLATE_GRAY, ROUGHNESS));
    glUseProgram(0);

    // 3D OBJECTS
    // ----------
    configureMockupData();

    // render loop
    // -----------
    while (!glfwWindowShouldClose(window))
    {
        // per-frame time logic
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        // input
        // -----
        processInput(window);

        // render
        // ------
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // the floor, lit by the area light(s)
        shaderLTC.use();
        glm::mat4 model(1.0f);
        glm::mat3 normalMatrix = glm::mat3(model);
        shaderLTC.setMat4("model", model);
        shaderLTC.setMat3("normalMatrix", normalMatrix);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        shaderLTC.setMat4("view", view);
        glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        shaderLTC.setMat4("projection", projection);
        shaderLTC.setVec3("viewPosition", cameraPos);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mLTC.mat1);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, mLTC.mat2);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        renderPlane();

        // the lights' rectangles, each in its colour
        shaderLightPlane.use();
        shaderLightPlane.setMat4("view", view);
        shaderLightPlane.setMat4("projection", projection);
        for (int i = 0; i < NUM_AREA_LIGHTS; i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, areaLights[i].offset);
            model = glm::rotate(model, areaLights[i].yRotation, glm::vec3(0.0f, 1.0f, 0.0f));
            shaderLightPlane.setMat4("model", model);
            shaderLightPlane.setVec3("lightColor", areaLights[i].color);
            renderAreaLight();
        }

        // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // optional: de-allocate all resources once they've outlived their purpose:
    // ------------------------------------------------------------------------
    glDeleteVertexArrays(1, &planeVAO);
    glDeleteBuffers(1, &planeVBO);
    glDeleteVertexArrays(1, &areaLightVAO);
    glDeleteBuffers(1, &areaLightVBO);
    glDeleteTextures(1, &mLTC.mat1);
    glDeleteTextures(1, &mLTC.mat2);
    glDeleteTextures(1, &floorTexture);

    // glfw: terminate, clearing all previously allocated GLFW resources.
    // ------------------------------------------------------------------
    glfwTerminate();
    return 0;
}

// process all input: query GLFW whether relevant keys are pressed/released this frame and react accordingly
// ---------------------------------------------------------------------------------------------------------
void processInput(GLFWwindow *window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    float cameraSpeed = static_cast<float>(3.0 * deltaTime);
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        cameraPos += cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        cameraPos -= cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
}

// glfw: whenever the window size changed (by OS or user resize) this callback function executes
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}

// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    glm::vec3 front;
    front.x = cos(glm::radians(yaw)) * cos(glm::radians(pitch));
    front.y = sin(glm::radians(pitch));
    front.z = sin(glm::radians(yaw)) * cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}

// glfw: whenever the mouse scroll wheel scrolls, this callback is called
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    fov -= (float)yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}

// utility function for loading a 2D texture from file
// ---------------------------------------------------
unsigned int loadTexture(char const * path, bool gammaCorrection)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded textures on the y-axis (the image's first row is its top, OpenGL's v = 0 is the bottom)
    unsigned char *data = stbi_load(path, &width, &height, &nrComponents, 0);
    if (data)
    {
        // an sRGB internal format: OpenGL converts the texels to linear colours when the shader samples them
        GLenum internalFormat = GL_RGB;
        GLenum dataFormat = GL_RGB;
        if (nrComponents == 1)
        {
            internalFormat = dataFormat = GL_RED;
        }
        else if (nrComponents == 3)
        {
            internalFormat = gammaCorrection ? GL_SRGB : GL_RGB;
            dataFormat = GL_RGB;
        }
        else if (nrComponents == 4)
        {
            internalFormat = gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA;
            dataFormat = GL_RGBA;
        }

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
