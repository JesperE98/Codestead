#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include "shader_m.h"
#include "model.h"

#define STB_IMAGE_IMPLEMENTATION // the bodies of stb_image's functions (headers only include its declarations)
#include <stb_image.h>

#include <iostream>
#include <vector>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void processInput(GLFWwindow *window);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);

// settings
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

// camera: above and in front of the scene, looking down at it (yaw -90, pitch -25)
glm::vec3 cameraPos   = glm::vec3(3.0f, 6.0f, 12.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, -0.42262f, -0.90631f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);

bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch = -25.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
float fov   =  45.0f;

// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;

// an object's place in space: its local position, rotation and scale (relative to its parent)
// and its model matrix in world space (learnopengl's Transform class, written as a struct)
struct Transform
{
    // local space information
    glm::vec3 pos = { 0.0f, 0.0f, 0.0f };
    glm::vec3 eulerRot = { 0.0f, 0.0f, 0.0f }; // in degrees
    glm::vec3 scale = { 1.0f, 1.0f, 1.0f };

    // global space information concatenated in a matrix
    glm::mat4 modelMatrix = glm::mat4(1.0f);

    // dirty flag: the local values changed since the model matrix was last computed
    bool isDirty = true;
};

// the local model matrix: translation * rotation * scale (also known as a TRS matrix)
glm::mat4 getLocalModelMatrix(const Transform& transform)
{
    const glm::mat4 transformX = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f));
    const glm::mat4 transformY = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.y), glm::vec3(0.0f, 1.0f, 0.0f));
    const glm::mat4 transformZ = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.z), glm::vec3(0.0f, 0.0f, 1.0f));

    // Y * X * Z
    const glm::mat4 rotationMatrix = transformY * transformX * transformZ;

    // translation * rotation * scale (also known as TRS matrix)
    return glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale);
}

// the model matrix in world space: the parent's model matrix * the local one (the root's parent matrix is the identity)
void computeModelMatrix(Transform& transform, const glm::mat4& parentGlobalModelMatrix)
{
    transform.modelMatrix = parentGlobalModelMatrix * getLocalModelMatrix(transform);
    transform.isDirty = false;
}

void setLocalPosition(Transform& transform, const glm::vec3& newPosition)
{
    transform.pos = newPosition;
    transform.isDirty = true;
}

void setLocalRotation(Transform& transform, const glm::vec3& newRotation)
{
    transform.eulerRot = newRotation;
    transform.isDirty = true;
}

void setLocalScale(Transform& transform, const glm::vec3& newScale)
{
    transform.scale = newScale;
    transform.isDirty = true;
}

// TODO: the frustum - the Plane and Frustum structs and createFrustumFromCamera

// TODO: the bounding volume - a sphere around the model (generateSphereBV) and the tests against the frustum's planes

// a node of the scene graph: an object with its transform, the model it draws and its children
// (learnopengl's Entity class, written as a struct: the children are stored by value in a vector,
// and each function gets the parent's model matrix as a parameter instead of following a parent pointer)
struct Entity
{
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};

// add a child that draws the given model
void addChild(Entity& parent, Model& model)
{
    Entity child;
    child.pModel = &model;
    parent.children.push_back(child);
}

// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        forceUpdateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    if (entity.transform.isDirty)
    {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// draw an entity and all of its children
void drawSelfAndChild(Entity& entity, Shader& ourShader)
{
    ourShader.setMat4("model", entity.transform.modelMatrix);
    entity.pModel->Draw(ourShader);

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, ourShader);
    }
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

    // build and compile shaders
    // -------------------------
    Shader ourShader("model_loading.vs", "model_loading.fs");

    // load models
    // -----------
    // (no stbi_set_flip_vertically_on_load(true) here: aiProcess_FlipUVs in model.h already turns the texture
    // coordinates the right way up - doing both would turn the textures upside down)
    Model ourModel("models/planet.obj");

    // load entities
    // -------------
    Entity ourEntity;
    ourEntity.pModel = &ourModel;
    setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
    const float scale = 0.6f;

    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int i = 0; i < 10; ++i)
        {
            addChild(*lastEntity, ourModel);
            lastEntity = &lastEntity->children.back();

            // set transform values: beside its parent, 0.6 times its size
            setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f));
            setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
        }
    }
    updateSelfAndChild(ourEntity, glm::mat4(1.0f));

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

        // turn the root about its y axis (20 degrees per second): its children follow it
        setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));

        // render
        // ------
        glClearColor(0.05f, 0.05f, 0.05f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // don't forget to enable shader before setting uniforms
        ourShader.use();

        // view/projection transformations
        glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        ourShader.setMat4("projection", projection);
        ourShader.setMat4("view", view);

        // draw our scene graph
        // TODO: build the camera's frustum and draw only the entities whose bounding volume is inside it
        drawSelfAndChild(ourEntity, ourShader);

        // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

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

    float cameraSpeed = static_cast<float>(2.5 * deltaTime);
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
