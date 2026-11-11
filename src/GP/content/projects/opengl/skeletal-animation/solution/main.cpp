#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#define GLM_ENABLE_EXPERIMENTAL
#include <glm/gtx/quaternion.hpp>

#include <assimp/Importer.hpp>
#include <assimp/scene.h>

#include "shader_m.h"
#include "model.h"
#include "assimp_glm_helpers.h"

#define STB_IMAGE_IMPLEMENTATION // the bodies of stb_image's functions (headers only include its declarations)
#include <stb_image.h>

#include <cmath>
#include <iostream>
#include <map>
#include <string>
#include <vector>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void processInput(GLFWwindow *window);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);

// settings
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

// camera
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);

bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
float fov   =  45.0f;

// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;

// ---------------------------------------------------------------------------------------------------------------------
// Bone: one bone's keyframes, and its local transform at the animation's current time
// (learnopengl's Bone class, written as a struct with free functions)
// ---------------------------------------------------------------------------------------------------------------------
struct KeyPosition
{
    glm::vec3 position;
    float timeStamp;
};

struct KeyRotation
{
    glm::quat orientation;
    float timeStamp;
};

struct KeyScale
{
    glm::vec3 scale;
    float timeStamp;
};

struct Bone
{
    std::vector<KeyPosition> m_Positions;
    std::vector<KeyRotation> m_Rotations;
    std::vector<KeyScale> m_Scales;
    int m_NumPositions;
    int m_NumRotations;
    int m_NumScalings;

    glm::mat4 m_LocalTransform;
    std::string m_Name;
    int m_ID;
};

// reads the keyframes of one animation channel (aiNodeAnim) into a Bone
Bone CreateBone(const std::string& name, int ID, const aiNodeAnim* channel)
{
    Bone bone;
    bone.m_Name = name;
    bone.m_ID = ID;
    bone.m_LocalTransform = glm::mat4(1.0f);

    bone.m_NumPositions = channel->mNumPositionKeys;
    for (int positionIndex = 0; positionIndex < bone.m_NumPositions; ++positionIndex)
    {
        aiVector3D aiPosition = channel->mPositionKeys[positionIndex].mValue;
        float timeStamp = channel->mPositionKeys[positionIndex].mTime;
        KeyPosition data;
        data.position = GetGLMVec(aiPosition);
        data.timeStamp = timeStamp;
        bone.m_Positions.push_back(data);
    }

    bone.m_NumRotations = channel->mNumRotationKeys;
    for (int rotationIndex = 0; rotationIndex < bone.m_NumRotations; ++rotationIndex)
    {
        aiQuaternion aiOrientation = channel->mRotationKeys[rotationIndex].mValue;
        float timeStamp = channel->mRotationKeys[rotationIndex].mTime;
        KeyRotation data;
        data.orientation = GetGLMQuat(aiOrientation);
        data.timeStamp = timeStamp;
        bone.m_Rotations.push_back(data);
    }

    bone.m_NumScalings = channel->mNumScalingKeys;
    for (int keyIndex = 0; keyIndex < bone.m_NumScalings; ++keyIndex)
    {
        aiVector3D scale = channel->mScalingKeys[keyIndex].mValue;
        float timeStamp = channel->mScalingKeys[keyIndex].mTime;
        KeyScale data;
        data.scale = GetGLMVec(scale);
        data.timeStamp = timeStamp;
        bone.m_Scales.push_back(data);
    }
    return bone;
}

// the index of the key before animationTime (the key after it is index + 1)
int GetPositionIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumPositions - 1; ++index)
    {
        if (animationTime < bone.m_Positions[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumPositions - 2; // not reached: the animation's time stays below its duration
}

int GetRotationIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumRotations - 1; ++index)
    {
        if (animationTime < bone.m_Rotations[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumRotations - 2;
}

int GetScaleIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumScalings - 1; ++index)
    {
        if (animationTime < bone.m_Scales[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumScalings - 2;
}

// how far animationTime is from the last key to the next one: 0 at the last key, 1 at the next
float GetScaleFactor(float lastTimeStamp, float nextTimeStamp, float animationTime)
{
    float scaleFactor = 0.0f;
    float midWayLength = animationTime - lastTimeStamp;
    float framesDiff = nextTimeStamp - lastTimeStamp;
    scaleFactor = midWayLength / framesDiff;
    return scaleFactor;
}

// positions: linear interpolation (mix) between the two keys around animationTime
glm::mat4 InterpolatePosition(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumPositions)
        return glm::translate(glm::mat4(1.0f), bone.m_Positions[0].position);

    int p0Index = GetPositionIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Positions[p0Index].timeStamp,
        bone.m_Positions[p1Index].timeStamp, animationTime);
    glm::vec3 finalPosition = glm::mix(bone.m_Positions[p0Index].position, bone.m_Positions[p1Index].position,
        scaleFactor);
    return glm::translate(glm::mat4(1.0f), finalPosition);
}

// rotations: spherical linear interpolation (slerp) between the two quaternions
glm::mat4 InterpolateRotation(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumRotations)
    {
        auto rotation = glm::normalize(bone.m_Rotations[0].orientation);
        return glm::toMat4(rotation);
    }

    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    glm::quat finalRotation = glm::slerp(bone.m_Rotations[p0Index].orientation, bone.m_Rotations[p1Index].orientation,
        scaleFactor);
    finalRotation = glm::normalize(finalRotation);
    return glm::toMat4(finalRotation);
}

// scales: linear interpolation like the positions
glm::mat4 InterpolateScaling(const Bone& bone, float animationTime)
{
    if (1 == bone.m_NumScalings)
        return glm::scale(glm::mat4(1.0f), bone.m_Scales[0].scale);

    int p0Index = GetScaleIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Scales[p0Index].timeStamp,
        bone.m_Scales[p1Index].timeStamp, animationTime);
    glm::vec3 finalScale = glm::mix(bone.m_Scales[p0Index].scale, bone.m_Scales[p1Index].scale,
        scaleFactor);
    return glm::scale(glm::mat4(1.0f), finalScale);
}

// the bone's local transform at animationTime: translation * rotation * scale
void UpdateBone(Bone& bone, float animationTime)
{
    glm::mat4 translation = InterpolatePosition(bone, animationTime);
    glm::mat4 rotation = InterpolateRotation(bone, animationTime);
    glm::mat4 scale = InterpolateScaling(bone, animationTime);
    bone.m_LocalTransform = translation * rotation * scale;
}

// ---------------------------------------------------------------------------------------------------------------------
// Animation: the bones' keyframes and the node hierarchy of the file (learnopengl's Animation class)
// ---------------------------------------------------------------------------------------------------------------------
struct AssimpNodeData
{
    glm::mat4 transformation;
    std::string name;
    int childrenCount;
    std::vector<AssimpNodeData> children;
};

struct Animation
{
    float m_Duration;
    int m_TicksPerSecond;
    std::vector<Bone> m_Bones;
    AssimpNodeData m_RootNode;
    std::map<std::string, BoneInfo> m_BoneInfoMap;
};

// copies assimp's node tree (names, transformations, children) into our own AssimpNodeData tree
void ReadHierarchyData(AssimpNodeData& dest, const aiNode* src)
{
    dest.name = src->mName.data;
    dest.transformation = ConvertMatrixToGLMFormat(src->mTransformation);
    dest.childrenCount = src->mNumChildren;

    for (unsigned int i = 0; i < src->mNumChildren; i++)
    {
        AssimpNodeData newData;
        ReadHierarchyData(newData, src->mChildren[i]);
        dest.children.push_back(newData);
    }
}

// one Bone per animation channel; a bone the mesh does not use (no weights) gets a new id too
void ReadMissingBones(Animation& animation, const aiAnimation* aiAnim, Model& model)
{
    int size = aiAnim->mNumChannels;

    auto& boneInfoMap = model.GetBoneInfoMap(); // getting m_BoneInfoMap from Model class
    int& boneCount = model.GetBoneCount();      // getting the m_BoneCounter from Model class

    // reading channels (bones engaged in an animation and their keyframes)
    for (int i = 0; i < size; i++)
    {
        auto channel = aiAnim->mChannels[i];
        std::string boneName = channel->mNodeName.data;

        if (boneInfoMap.find(boneName) == boneInfoMap.end())
        {
            boneInfoMap[boneName].id = boneCount;
            boneCount++;
        }
        animation.m_Bones.push_back(CreateBone(channel->mNodeName.data,
            boneInfoMap[channel->mNodeName.data].id, channel));
    }

    animation.m_BoneInfoMap = boneInfoMap;
}

// loads the file's first animation (the same file as the model)
void LoadAnimation(Animation& animation, const std::string& animationPath, Model& model)
{
    Assimp::Importer importer;
    const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);
    if (!scene || !scene->mRootNode || scene->mNumAnimations == 0)
    {
        std::cout << "ERROR::ASSIMP:: no animation in " << animationPath << std::endl;
        return;
    }
    auto aiAnim = scene->mAnimations[0];
    animation.m_Duration = aiAnim->mDuration;
    animation.m_TicksPerSecond = aiAnim->mTicksPerSecond;
    ReadHierarchyData(animation.m_RootNode, scene->mRootNode);
    ReadMissingBones(animation, aiAnim, model);
}

// the animated bone with this name, or nullptr when the node is not animated
Bone* FindBone(Animation& animation, const std::string& name)
{
    for (Bone& bone : animation.m_Bones)
    {
        if (bone.m_Name == name)
            return &bone;
    }
    return nullptr;
}

// ---------------------------------------------------------------------------------------------------------------------
// Animator: plays an animation and computes the final bone matrices (learnopengl's Animator class)
// ---------------------------------------------------------------------------------------------------------------------
struct Animator
{
    std::vector<glm::mat4> m_FinalBoneMatrices;
    Animation* m_CurrentAnimation;
    float m_CurrentTime;
    float m_DeltaTime;
};

void InitAnimator(Animator& animator, Animation* animation)
{
    animator.m_CurrentTime = 0.0f;
    animator.m_CurrentAnimation = animation;

    animator.m_FinalBoneMatrices.reserve(100);

    for (int i = 0; i < 100; i++)
        animator.m_FinalBoneMatrices.push_back(glm::mat4(1.0f));
}

// walks the node tree from the root: every node's global transform is its parent's times its own (the bone's
// interpolated transform when the node is animated); a bone's final matrix = global transform * offset matrix
void CalculateBoneTransform(Animator& animator, const AssimpNodeData* node, glm::mat4 parentTransform)
{
    std::string nodeName = node->name;
    glm::mat4 nodeTransform = node->transformation;

    Bone* bone = FindBone(*animator.m_CurrentAnimation, nodeName);

    if (bone)
    {
        UpdateBone(*bone, animator.m_CurrentTime);
        nodeTransform = bone->m_LocalTransform;
    }

    glm::mat4 globalTransformation = parentTransform * nodeTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        glm::mat4 offset = boneInfoMap[nodeName].offset;
        animator.m_FinalBoneMatrices[index] = globalTransformation * offset;
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
}

// advances the animation by dt seconds (in the file's ticks, looping) and recomputes the bone matrices
void UpdateAnimation(Animator& animator, float dt)
{
    animator.m_DeltaTime = dt;
    if (animator.m_CurrentAnimation)
    {
        animator.m_CurrentTime += animator.m_CurrentAnimation->m_TicksPerSecond * dt;
        animator.m_CurrentTime = fmod(animator.m_CurrentTime, animator.m_CurrentAnimation->m_Duration);
        CalculateBoneTransform(animator, &animator.m_CurrentAnimation->m_RootNode, glm::mat4(1.0f));
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

    // tell stb_image.h to flip loaded texture's on the y-axis (before loading model).
    stbi_set_flip_vertically_on_load(true);

    // configure global opengl state
    // -----------------------------
    glEnable(GL_DEPTH_TEST);

    // build and compile shaders
    // -------------------------
    Shader ourShader("anim_model.vs", "anim_model.fs");

    // load models
    // -----------
    Model ourModel("models/tentacle.gltf");
    Animation swayAnimation;
    LoadAnimation(swayAnimation, "models/tentacle.gltf", ourModel);
    Animator animator;
    InitAnimator(animator, &swayAnimation);

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
        UpdateAnimation(animator, deltaTime);

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

        // the bones' final matrices
        auto transforms = animator.m_FinalBoneMatrices;
        for (int i = 0; i < (int)transforms.size(); ++i)
            ourShader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i]);

        // render the loaded model
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -1.0f, 0.0f)); // translate it down so it stands in the middle of the window
        model = glm::scale(model, glm::vec3(0.9f, 0.9f, 0.9f));      // a little smaller
        ourShader.setMat4("model", model);
        ourModel.Draw(ourShader);

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
