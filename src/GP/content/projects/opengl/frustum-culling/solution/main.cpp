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
#include <limits>
#include <algorithm>
#include <string>

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

// a plane: a unit normal and the distance from the origin along it (the points p with dot(normal, p) = distance)
struct Plane
{
    glm::vec3 normal = { 0.0f, 1.0f, 0.0f }; // unit vector
    float distance = 0.0f;                    // distance with origin
};

// the plane through the point p1 with the normal norm
Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)
{
    Plane plane;
    plane.normal = glm::normalize(norm);
    plane.distance = glm::dot(plane.normal, p1);
    return plane;
}

// > 0: the point is on the side the normal points to, < 0: behind the plane
float getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)
{
    return glm::dot(plane.normal, point) - plane.distance;
}

// the six planes that bound what a camera sees, their normals pointing inwards
struct Frustum
{
    Plane topFace;
    Plane bottomFace;

    Plane rightFace;
    Plane leftFace;

    Plane farFace;
    Plane nearFace;
};

Frustum createFrustumFromCamera(const glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar)
{
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const glm::vec3 right = glm::normalize(glm::cross(front, worldUp));
    const glm::vec3 up = glm::normalize(glm::cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const glm::vec3 frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, glm::cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, glm::cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, glm::cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, glm::cross(frontMultFar + up * halfVSide, right));
    return frustum;
}

// a bounding volume: a sphere that encloses the model
struct Sphere
{
    glm::vec3 center = { 0.0f, 0.0f, 0.0f };
    float radius = 0.0f;
};

// the sphere around the box that encloses all the model's vertices
Sphere generateSphereBV(const Model& model)
{
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB.x = std::min(minAABB.x, vertex.Position.x);
            minAABB.y = std::min(minAABB.y, vertex.Position.y);
            minAABB.z = std::min(minAABB.z, vertex.Position.z);

            maxAABB.x = std::max(maxAABB.x, vertex.Position.x);
            maxAABB.y = std::max(maxAABB.y, vertex.Position.y);
            maxAABB.z = std::max(maxAABB.z, vertex.Position.z);
        }
    }

    Sphere sphere;
    sphere.center = (maxAABB + minAABB) * 0.5f;
    sphere.radius = glm::length(maxAABB - minAABB) * 0.5f; // half the box's diagonal
    return sphere;
}

// the sphere is (at least partly) on the side of the plane its normal points to
bool isOnOrForwardPlane(const Sphere& sphere, const Plane& plane)
{
    return getSignedDistanceToPlane(plane, sphere.center) > -sphere.radius;
}

// the sphere, moved and scaled by the entity's model matrix, is (at least partly) inside the frustum
bool isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)
{
    // get global scale thanks to our transform (the lengths of the model matrix's first three columns)
    const glm::vec3 globalScale = glm::vec3(glm::length(glm::vec3(transform.modelMatrix[0])),
                                            glm::length(glm::vec3(transform.modelMatrix[1])),
                                            glm::length(glm::vec3(transform.modelMatrix[2])));

    // get our global center with process it with the global model matrix of our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f));

    // to wrap correctly our shape, we need the maximum scale scalar
    const float maxScale = std::max(std::max(globalScale.x, globalScale.y), globalScale.z);

    Sphere globalSphere;
    globalSphere.center = globalCenter;
    globalSphere.radius = sphere.radius * maxScale;

    // check firstly the result that have the most chance to failure to avoid to call all functions
    return (isOnOrForwardPlane(globalSphere, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.farFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.topFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.bottomFace));
}

// a tighter bounding volume: an axis-aligned box, its center and its half sizes along x, y and z
struct AABB
{
    glm::vec3 center = { 0.0f, 0.0f, 0.0f };
    glm::vec3 extents = { 0.0f, 0.0f, 0.0f };
};

// the box that encloses all the model's vertices
AABB generateAABB(const Model& model)
{
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB.x = std::min(minAABB.x, vertex.Position.x);
            minAABB.y = std::min(minAABB.y, vertex.Position.y);
            minAABB.z = std::min(minAABB.z, vertex.Position.z);

            maxAABB.x = std::max(maxAABB.x, vertex.Position.x);
            maxAABB.y = std::max(maxAABB.y, vertex.Position.y);
            maxAABB.z = std::max(maxAABB.z, vertex.Position.z);
        }
    }

    AABB aabb;
    aabb.center = (maxAABB + minAABB) * 0.5f;
    aabb.extents = maxAABB - aabb.center;
    return aabb;
}

// see https://gdbooks.gitbooks.io/3dcollisions/content/Chapter2/static_aabb_plane.html
bool isOnOrForwardPlane(const AABB& aabb, const Plane& plane)
{
    // compute the projection interval radius of the box onto the plane's normal
    const float r = aabb.extents.x * std::abs(plane.normal.x) + aabb.extents.y * std::abs(plane.normal.y) +
        aabb.extents.z * std::abs(plane.normal.z);

    return -r <= getSignedDistanceToPlane(plane, aabb.center);
}

// the box, moved, turned and scaled by the entity's model matrix, is (at least partly) inside the frustum
bool isOnFrustum(const AABB& aabb, const Frustum& camFrustum, const Transform& transform)
{
    // get global center thanks to our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(aabb.center, 1.0f));

    // scaled orientation: the box's three half axes in world space
    const glm::vec3 right = glm::vec3(transform.modelMatrix[0]) * aabb.extents.x;
    const glm::vec3 up = glm::vec3(transform.modelMatrix[1]) * aabb.extents.y;
    const glm::vec3 forward = -glm::vec3(transform.modelMatrix[2]) * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const float newIi = std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), forward));

    const float newIj = std::abs(glm::dot(glm::vec3(0.0f, 1.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(0.0f, 1.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(0.0f, 1.0f, 0.0f), forward));

    const float newIk = std::abs(glm::dot(glm::vec3(0.0f, 0.0f, 1.0f), right)) +
        std::abs(glm::dot(glm::vec3(0.0f, 0.0f, 1.0f), up)) +
        std::abs(glm::dot(glm::vec3(0.0f, 0.0f, 1.0f), forward));

    AABB globalAABB;
    globalAABB.center = globalCenter;
    globalAABB.extents = glm::vec3(newIi, newIj, newIk);

    return (isOnOrForwardPlane(globalAABB, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalAABB, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalAABB, camFrustum.topFace) &&
        isOnOrForwardPlane(globalAABB, camFrustum.bottomFace) &&
        isOnOrForwardPlane(globalAABB, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalAABB, camFrustum.farFace));
}

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
    AABB boundingVolume;
};

// add a child that draws the given model
void addChild(Entity& parent, Model& model)
{
    Entity child;
    child.pModel = &model;
    child.boundingVolume = generateAABB(model);
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

// draw an entity and all of its children - only those inside the frustum; count the drawn (display) and all (total) entities
void drawSelfAndChild(Entity& entity, const Frustum& frustum, Shader& ourShader, unsigned int& display, unsigned int& total)
{
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform))
    {
        ourShader.setMat4("model", entity.transform.modelMatrix);
        entity.pModel->Draw(ourShader);
        display++;
    }
    total++;

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, frustum, ourShader, display, total);
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

    // load entities: the root planet and a 10 x 10 grid of smaller planets around it, all children of the root
    // -------------
    Entity ourEntity;
    ourEntity.pModel = &ourModel;
    ourEntity.boundingVolume = generateAABB(ourModel);
    setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
    const float scale = 0.5f;

    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int x = 0; x < 10; ++x)
        {
            for (unsigned int z = 0; z < 10; ++z)
            {
                addChild(ourEntity, ourModel);
                lastEntity = &ourEntity.children.back();

                // set transform values: 5 units apart, half the root's size
                setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
            }
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

        // the camera's frustum: the same field of view, aspect, near and far plane as the projection
        const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, (float)SCR_WIDTH / (float)SCR_HEIGHT, glm::radians(fov), 0.1f, 100.0f);

        // draw our scene graph: only the entities inside the frustum
        unsigned int total = 0, display = 0;
        drawSelfAndChild(ourEntity, camFrustum, ourShader, display, total);

        // show how many entities were drawn in the window's title
        std::string title = "LearnOpenGL - drawn: " + std::to_string(display) + " / " + std::to_string(total);
        glfwSetWindowTitle(window, title.c_str());

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
