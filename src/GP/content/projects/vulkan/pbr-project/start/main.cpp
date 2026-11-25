#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>

// Vulkan's depth range is 0..1 (OpenGL's is -1..1): make glm::perspective use it.
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <iostream>
#include <fstream>
#include <stdexcept>
#include <algorithm>
#include <vector>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <cstdint>
#include <limits>
#include <array>
#include <optional>
#include <set>

const uint32_t WIDTH = 800;
const uint32_t HEIGHT = 600;

const std::vector<const char*> validationLayers = {
    "VK_LAYER_KHRONOS_validation"
};

const std::vector<const char*> deviceExtensions = {
    VK_KHR_SWAPCHAIN_EXTENSION_NAME
};

#ifdef NDEBUG
const bool enableValidationLayers = false;
#else
const bool enableValidationLayers = true;
#endif

VkResult CreateDebugUtilsMessengerEXT(VkInstance instance, const VkDebugUtilsMessengerCreateInfoEXT* pCreateInfo, const VkAllocationCallbacks* pAllocator, VkDebugUtilsMessengerEXT* pDebugMessenger) {
    auto func = (PFN_vkCreateDebugUtilsMessengerEXT) vkGetInstanceProcAddr(instance, "vkCreateDebugUtilsMessengerEXT");
    if (func != nullptr) {
        return func(instance, pCreateInfo, pAllocator, pDebugMessenger);
    } else {
        return VK_ERROR_EXTENSION_NOT_PRESENT;
    }
}

void DestroyDebugUtilsMessengerEXT(VkInstance instance, VkDebugUtilsMessengerEXT debugMessenger, const VkAllocationCallbacks* pAllocator) {
    auto func = (PFN_vkDestroyDebugUtilsMessengerEXT) vkGetInstanceProcAddr(instance, "vkDestroyDebugUtilsMessengerEXT");
    if (func != nullptr) {
        func(instance, debugMessenger, pAllocator);
    }
}

struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;
    std::optional<uint32_t> presentFamily;

    bool isComplete() {
        return graphicsFamily.has_value() && presentFamily.has_value();
    }
};

struct SwapChainSupportDetails {
    VkSurfaceCapabilitiesKHR capabilities;
    std::vector<VkSurfaceFormatKHR> formats;
    std::vector<VkPresentModeKHR> presentModes;
};

struct Vertex {
    glm::vec3 pos;
    glm::vec3 normal;
    glm::vec2 texCoord;
    glm::vec3 tangent; // the direction in which u grows on the surface (for the normal map)

    static VkVertexInputBindingDescription getBindingDescription() {
        VkVertexInputBindingDescription bindingDescription{};
        bindingDescription.binding = 0;
        bindingDescription.stride = sizeof(Vertex);
        bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 4> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 4> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);

        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);

        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[3].offset = offsetof(Vertex, tangent);

        return attributeDescriptions;
    }
};

// lights
// ------
const std::vector<glm::vec3> lightPositions = {
    glm::vec3(-10.0f,  10.0f, 10.0f),
    glm::vec3( 10.0f,  10.0f, 10.0f),
    glm::vec3(-10.0f, -10.0f, 10.0f),
    glm::vec3( 10.0f, -10.0f, 10.0f)
};
const std::vector<glm::vec3> lightColors = {
    glm::vec3(300.0f, 300.0f, 300.0f),
    glm::vec3(300.0f, 300.0f, 300.0f),
    glm::vec3(300.0f, 300.0f, 300.0f),
    glm::vec3(300.0f, 300.0f, 300.0f)
};
// a few large spheres, so the material's details can be seen
int nrRows    = 3;
int nrColumns = 3;
float spacing = 6.0;

// The cube and the screen quad in one vertex buffer; each draw picks its part with firstVertex (vkCmdDraw).
// The cube (vertices 0..35, learnopengl's renderCube()): 2 x 2 x 2 around the origin, with normals and texture
// coordinates (the tangents stay zero: the cube's shaders only read the position). It is looked at from the inside:
// once for each face of a cube map, and as the background.
const std::vector<Vertex> vertices = {
    // positions            // normals             // texcoords
    // back face
    {{-1.0f, -1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {0.0f, 1.0f}}, // bottom-left
    {{ 1.0f,  1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {1.0f, 0.0f}}, // top-right
    {{ 1.0f, -1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {1.0f, 1.0f}}, // bottom-right
    {{ 1.0f,  1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {1.0f, 0.0f}}, // top-right
    {{-1.0f, -1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {0.0f, 1.0f}}, // bottom-left
    {{-1.0f,  1.0f, -1.0f}, { 0.0f,  0.0f, -1.0f}, {0.0f, 0.0f}}, // top-left

    // front face
    {{-1.0f, -1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}}, // bottom-left
    {{ 1.0f, -1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 1.0f}}, // bottom-right
    {{ 1.0f,  1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 0.0f}}, // top-right
    {{ 1.0f,  1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 0.0f}}, // top-right
    {{-1.0f,  1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 0.0f}}, // top-left
    {{-1.0f, -1.0f,  1.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}}, // bottom-left

    // left face
    {{-1.0f,  1.0f,  1.0f}, {-1.0f,  0.0f,  0.0f}, {1.0f, 1.0f}}, // top-right
    {{-1.0f,  1.0f, -1.0f}, {-1.0f,  0.0f,  0.0f}, {1.0f, 0.0f}}, // top-left
    {{-1.0f, -1.0f, -1.0f}, {-1.0f,  0.0f,  0.0f}, {0.0f, 0.0f}}, // bottom-left
    {{-1.0f, -1.0f, -1.0f}, {-1.0f,  0.0f,  0.0f}, {0.0f, 0.0f}}, // bottom-left
    {{-1.0f, -1.0f,  1.0f}, {-1.0f,  0.0f,  0.0f}, {0.0f, 1.0f}}, // bottom-right
    {{-1.0f,  1.0f,  1.0f}, {-1.0f,  0.0f,  0.0f}, {1.0f, 1.0f}}, // top-right

    // right face
    {{ 1.0f,  1.0f,  1.0f}, { 1.0f,  0.0f,  0.0f}, {1.0f, 1.0f}}, // top-left
    {{ 1.0f, -1.0f, -1.0f}, { 1.0f,  0.0f,  0.0f}, {0.0f, 0.0f}}, // bottom-right
    {{ 1.0f,  1.0f, -1.0f}, { 1.0f,  0.0f,  0.0f}, {1.0f, 0.0f}}, // top-right
    {{ 1.0f, -1.0f, -1.0f}, { 1.0f,  0.0f,  0.0f}, {0.0f, 0.0f}}, // bottom-right
    {{ 1.0f,  1.0f,  1.0f}, { 1.0f,  0.0f,  0.0f}, {1.0f, 1.0f}}, // top-left
    {{ 1.0f, -1.0f,  1.0f}, { 1.0f,  0.0f,  0.0f}, {0.0f, 1.0f}}, // bottom-left

    // bottom face
    {{-1.0f, -1.0f, -1.0f}, { 0.0f, -1.0f,  0.0f}, {0.0f, 0.0f}}, // top-right
    {{ 1.0f, -1.0f, -1.0f}, { 0.0f, -1.0f,  0.0f}, {1.0f, 0.0f}}, // top-left
    {{ 1.0f, -1.0f,  1.0f}, { 0.0f, -1.0f,  0.0f}, {1.0f, 1.0f}}, // bottom-left
    {{ 1.0f, -1.0f,  1.0f}, { 0.0f, -1.0f,  0.0f}, {1.0f, 1.0f}}, // bottom-left
    {{-1.0f, -1.0f,  1.0f}, { 0.0f, -1.0f,  0.0f}, {0.0f, 1.0f}}, // bottom-right
    {{-1.0f, -1.0f, -1.0f}, { 0.0f, -1.0f,  0.0f}, {0.0f, 0.0f}}, // top-right

    // top face
    {{-1.0f,  1.0f, -1.0f}, { 0.0f,  1.0f,  0.0f}, {0.0f, 0.0f}}, // top-left
    {{ 1.0f,  1.0f,  1.0f}, { 0.0f,  1.0f,  0.0f}, {1.0f, 1.0f}}, // bottom-right
    {{ 1.0f,  1.0f, -1.0f}, { 0.0f,  1.0f,  0.0f}, {1.0f, 0.0f}}, // top-right
    {{ 1.0f,  1.0f,  1.0f}, { 0.0f,  1.0f,  0.0f}, {1.0f, 1.0f}}, // bottom-right
    {{-1.0f,  1.0f, -1.0f}, { 0.0f,  1.0f,  0.0f}, {0.0f, 0.0f}}, // top-left
    {{-1.0f,  1.0f,  1.0f}, { 0.0f,  1.0f,  0.0f}, {0.0f, 1.0f}}, // bottom-left


    // screen quad (vertices 36..41): learnopengl's renderQuad() quad as two triangles - positions already in normalized
    // device coordinates (z = 0) and its texture coordinates
    {{-1.0f,  1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}},
    {{-1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 0.0f}},
    {{ 1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 0.0f}},

    {{-1.0f,  1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 0.0f}},
    {{ 1.0f,  1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 1.0f}}
};

// camera: at (0, 0, 22) looking down -z, far enough back to see the whole grid of spheres
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f, 22.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);

bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  WIDTH / 2.0f;
float lastY =  HEIGHT / 2.0f;
float fov   =  45.0f;

// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;

// glfw: whenever the mouse moves, this callback is called
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn) {
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse) {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since window y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f) {
        pitch = 89.0f;
    }
    if (pitch < -89.0f) {
        pitch = -89.0f;
    }

    glm::vec3 front;
    front.x = std::cos(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    front.y = std::sin(glm::radians(pitch));
    front.z = std::sin(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}

// glfw: whenever the mouse scroll wheel scrolls, this callback is called
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    fov -= static_cast<float>(yoffset);
    if (fov < 1.0f) {
        fov = 1.0f;
    }
    if (fov > 45.0f) {
        fov = 45.0f;
    }
}

// The same layout as the push constant block in pbr.vert: the model matrix of one draw.
struct PushConstants {
    glm::mat4 model;
};

// The push constants of the capture passes (the block in cubemap.vert): one face of a cube map is drawn with the
// capture's projection times the view towards that face. They use the same push constant range as PushConstants.
struct CapturePushConstants {
    glm::mat4 projectionView;
    float roughness; // prefilter.frag: the roughness the mip level is filtered for
};

// The same layout as the uniform block in the shaders: the values that stay the same for every draw of a frame.
// std140: the elements of an array are 16 bytes apart, so the light positions and colours are vec4s (only xyz is
// used), and a vec3 takes 16 bytes: a float fits into the 4 bytes after it, or they are padding.
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 camPos;
    float pad1;
};

class HelloTriangleApplication {
public:
    void run() {
        initWindow();
        initVulkan();
        mainLoop();
        cleanup();
    }

private:
    GLFWwindow* window;

    VkInstance instance;
    VkDebugUtilsMessengerEXT debugMessenger;
    VkSurfaceKHR surface;

    VkPhysicalDevice physicalDevice = VK_NULL_HANDLE;
    VkDevice device;

    VkQueue graphicsQueue;
    VkQueue presentQueue;

    VkSwapchainKHR swapChain;
    std::vector<VkImage> swapChainImages;
    VkFormat swapChainImageFormat;
    VkExtent2D swapChainExtent;
    std::vector<VkImageView> swapChainImageViews;
    std::vector<VkFramebuffer> swapChainFramebuffers;

    VkRenderPass renderPass;
    VkDescriptorSetLayout descriptorSetLayout;
    VkPipelineLayout pipelineLayout;
    VkPipeline pbrPipeline; // learnopengl's pbrShader: the spheres
    VkRenderPass captureRenderPass; // draws into one face of a floating point cube map (learnopengl's captureFBO)
    VkRenderPass brdfRenderPass; // the same for the two-channel lookup texture
    VkPipeline equirectangularToCubemapPipeline; // learnopengl's equirectangularToCubemapShader
    VkPipeline backgroundPipeline; // learnopengl's backgroundShader
    VkPipeline irradiancePipeline; // learnopengl's irradianceShader
    VkPipeline prefilterPipeline; // learnopengl's prefilterShader
    VkPipeline brdfPipeline; // learnopengl's brdfShader

    VkCommandPool commandPool;

    VkImage depthImage;
    VkDeviceMemory depthImageMemory;
    VkImageView depthImageView;

    // the equirectangular HDR image (learnopengl's hdrTexture)
    VkImage hdrImage;
    VkDeviceMemory hdrImageMemory;
    VkImageView hdrImageView;

    // the environment cube map it is converted to (learnopengl's envCubemap)
    VkImage envCubemapImage;
    VkDeviceMemory envCubemapImageMemory;
    VkImageView envCubemapImageView;

    // the irradiance cube map (learnopengl's irradianceMap)
    VkImage irradianceImage;
    VkDeviceMemory irradianceImageMemory;
    VkImageView irradianceImageView;

    // the pre-filtered environment map (learnopengl's prefilterMap): a cube map with 5 mip levels
    VkImage prefilterImage;
    VkDeviceMemory prefilterImageMemory;
    VkImageView prefilterImageView;

    // the BRDF lookup texture (learnopengl's brdfLUTTexture)
    VkImage brdfLUTImage;
    VkDeviceMemory brdfLUTImageMemory;
    VkImageView brdfLUTImageView;

    VkSampler clampSampler; // linear filtering, clamp to edge: for the HDR image, the cube maps and the lookup texture

    // the material's five maps (learnopengl's albedo, normal, metallic, roughness and ao textures)
    VkImage albedoImage;
    VkDeviceMemory albedoImageMemory;
    VkImageView albedoImageView;

    VkImage normalImage;
    VkDeviceMemory normalImageMemory;
    VkImageView normalImageView;

    VkImage metallicImage;
    VkDeviceMemory metallicImageMemory;
    VkImageView metallicImageView;

    VkImage roughnessImage;
    VkDeviceMemory roughnessImageMemory;
    VkImageView roughnessImageView;

    VkImage aoImage;
    VkDeviceMemory aoImageMemory;
    VkImageView aoImageView;

    VkSampler textureSampler; // linear filtering, repeat: for the material's maps

    // the sphere (learnopengl's renderSphere()): its vertices and the indices of one long triangle strip
    std::vector<Vertex> sphereVertices;
    std::vector<uint32_t> sphereIndices;
    VkBuffer sphereVertexBuffer;
    VkDeviceMemory sphereVertexBufferMemory;
    VkBuffer sphereIndexBuffer;
    VkDeviceMemory sphereIndexBufferMemory;

    // the cube and the screen quad (learnopengl's renderCube() and renderQuad())
    VkBuffer vertexBuffer;
    VkDeviceMemory vertexBufferMemory;

    VkBuffer uniformBuffer;
    VkDeviceMemory uniformBufferMemory;
    void* uniformBufferMapped;

    VkDescriptorPool descriptorPool;
    VkDescriptorSet hdrDescriptorSet; // the uniform buffer and the equirectangular HDR image
    VkDescriptorSet envDescriptorSet; // the uniform buffer and the environment cube map
    VkDescriptorSet irradianceDescriptorSet; // the uniform buffer and the irradiance cube map
    VkDescriptorSet prefilterDescriptorSet; // the uniform buffer and the pre-filtered environment map
    VkDescriptorSet descriptorSet; // the spheres': the uniform buffer, the three IBL images and the material's five maps

    VkCommandBuffer commandBuffer;

    VkSemaphore imageAvailableSemaphore;
    std::vector<VkSemaphore> renderFinishedSemaphores;
    VkFence inFlightFence;

    void initWindow() {
        glfwInit();

        glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
        glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

        window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
        glfwSetCursorPosCallback(window, mouse_callback);
        glfwSetScrollCallback(window, scroll_callback);

        // tell GLFW to capture our mouse
        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
    }

    void initVulkan() {
        createInstance();
        setupDebugMessenger();
        createSurface();
        pickPhysicalDevice();
        createLogicalDevice();
        createSwapChain();
        createImageViews();
        createRenderPass();
        // the capture's render pass: one face of a 16-bit float cube map (learnopengl: a GL_RGB16F face attached to captureFBO)
        createCaptureRenderPass(VK_FORMAT_R16G16B16A16_SFLOAT, captureRenderPass);
        // the lookup texture's render pass: two 16-bit float channels (learnopengl: GL_RG16F)
        createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass);
        createDescriptorSetLayout();
        createPipelineLayout();
        // a pipeline is made for one render pass and one kind of primitive: the spheres are a triangle strip in the window's pass
        createPipeline("shaders/pbr.vert.spv", "shaders/pbr.frag.spv", renderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP, pbrPipeline);
        // the cube is a triangle list: drawn into a face of a cube map (the conversion) and into the window (the background)
        createPipeline("shaders/cubemap.vert.spv", "shaders/equirectangular_to_cubemap.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, equirectangularToCubemapPipeline);
        createPipeline("shaders/background.vert.spv", "shaders/background.frag.spv", renderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, backgroundPipeline);
        createPipeline("shaders/cubemap.vert.spv", "shaders/irradiance_convolution.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, irradiancePipeline);
        createPipeline("shaders/cubemap.vert.spv", "shaders/prefilter.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, prefilterPipeline);
        // the screen quad (a triangle list) into the lookup texture
        createPipeline("shaders/brdf.vert.spv", "shaders/brdf.frag.spv", brdfRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, brdfPipeline);
        createDepthResources();
        createFramebuffers();
        createCommandPool();
        createSphere();
        createVertexBuffer(sphereVertices.data(), sizeof(sphereVertices[0]) * sphereVertices.size(), sphereVertexBuffer, sphereVertexBufferMemory);
        createIndexBuffer(sphereIndices, sphereIndexBuffer, sphereIndexBufferMemory);
        createVertexBuffer(vertices.data(), sizeof(vertices[0]) * vertices.size(), vertexBuffer, vertexBufferMemory);
        // pbr: load the HDR environment map
        loadHdrTexture("textures/environment.hdr", hdrImage, hdrImageMemory, hdrImageView);
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, VK_FALSE, clampSampler);
        // pbr: setup cubemap to render to, with all its mip levels (128, 64 ... 1: 8 levels) - enable pre-filter mipmap
        // sampling (combatting visible dots artifact)
        createCubemap(128, 8, envCubemapImage, envCubemapImageMemory, envCubemapImageView);
        // pbr: create an irradiance cubemap
        createCubemap(32, 1, irradianceImage, irradianceImageMemory, irradianceImageView);
        // pbr: create a pre-filter cubemap with 5 mip levels (64, 32, 16, 8, 4)
        createCubemap(64, 5, prefilterImage, prefilterImageMemory, prefilterImageView);
        // pbr: the 2D LUT: an image to draw into and to sample, with two 16-bit float channels
        createImage(128, 128, 1, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, brdfLUTImage, brdfLUTImageMemory);
        brdfLUTImageView = createImageView(brdfLUTImage, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT, 1);
        // load PBR material textures: all five as they are (UNORM, "linear") - the shader converts the albedo's colours itself
        loadTexture("textures/albedo.png", VK_FORMAT_R8G8B8A8_UNORM, albedoImage, albedoImageMemory, albedoImageView);
        loadTexture("textures/normal.png", VK_FORMAT_R8G8B8A8_UNORM, normalImage, normalImageMemory, normalImageView);
        loadTexture("textures/metallic.png", VK_FORMAT_R8G8B8A8_UNORM, metallicImage, metallicImageMemory, metallicImageView);
        loadTexture("textures/roughness.png", VK_FORMAT_R8G8B8A8_UNORM, roughnessImage, roughnessImageMemory, roughnessImageView);
        loadTexture("textures/ao.png", VK_FORMAT_R8G8B8A8_UNORM, aoImage, aoImageMemory, aoImageView);
        // linear filtering with mipmaps, repeat, no anisotropic filtering - like learnopengl's loadTexture (VK_TRUE sharpens the
        // maps where a surface is seen at a slant)
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE, textureSampler);
        createUniformBuffers();
        createDescriptorPool();
        createDescriptorSet();
        createTextureDescriptorSet(hdrImageView, clampSampler, hdrDescriptorSet);
        createTextureDescriptorSet(envCubemapImageView, clampSampler, envDescriptorSet);
        createTextureDescriptorSet(irradianceImageView, clampSampler, irradianceDescriptorSet);
        createTextureDescriptorSet(prefilterImageView, clampSampler, prefilterDescriptorSet);
        // pbr: convert HDR equirectangular environment map to cubemap equivalent
        renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 0, 128, 0.0f);
        // then generate mipmaps from first mip face (combatting visible dots artifact) - learnopengl: glGenerateMipmap(GL_TEXTURE_CUBE_MAP)
        generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6);
        // pbr: solve diffuse integral by convolution to create an irradiance (cube)map.
        renderToCubemap(irradiancePipeline, envDescriptorSet, irradianceImage, 0, 32, 0.0f);
        // pbr: run a quasi monte-carlo simulation on the environment lighting to create a prefilter (cube)map.
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip) {
            // the size of the mip level: each one half the one before
            unsigned int mipWidth = static_cast<unsigned int>(64 * std::pow(0.5, mip));

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            renderToCubemap(prefilterPipeline, envDescriptorSet, prefilterImage, mip, mipWidth, roughness);
        }
        // pbr: generate a 2D LUT from the BRDF equations used.
        renderBrdfLUT();
        createCommandBuffer();
        createSyncObjects();
    }

    void mainLoop() {
        while (!glfwWindowShouldClose(window)) {
            // per-frame time logic
            float currentFrame = static_cast<float>(glfwGetTime());
            deltaTime = currentFrame - lastFrame;
            lastFrame = currentFrame;

            glfwPollEvents();
            processInput();
            drawFrame();
        }

        vkDeviceWaitIdle(device);
    }

    void processInput() {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        float cameraSpeed = 2.5f * deltaTime; // units per second, the same speed at any frame rate
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
            cameraPos += cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
            cameraPos -= cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
            cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
            cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
    }

    void cleanup() {
        for (auto semaphore : renderFinishedSemaphores) {
            vkDestroySemaphore(device, semaphore, nullptr);
        }
        vkDestroySemaphore(device, imageAvailableSemaphore, nullptr);
        vkDestroyFence(device, inFlightFence, nullptr);

        vkDestroyBuffer(device, sphereIndexBuffer, nullptr);
        vkFreeMemory(device, sphereIndexBufferMemory, nullptr);

        vkDestroyBuffer(device, sphereVertexBuffer, nullptr);
        vkFreeMemory(device, sphereVertexBufferMemory, nullptr);

        vkDestroyBuffer(device, vertexBuffer, nullptr);
        vkFreeMemory(device, vertexBufferMemory, nullptr);

        vkDestroyBuffer(device, uniformBuffer, nullptr);
        vkFreeMemory(device, uniformBufferMemory, nullptr);

        vkDestroyDescriptorPool(device, descriptorPool, nullptr);

        vkDestroySampler(device, clampSampler, nullptr);

        vkDestroyImageView(device, hdrImageView, nullptr);
        vkDestroyImage(device, hdrImage, nullptr);
        vkFreeMemory(device, hdrImageMemory, nullptr);

        vkDestroyImageView(device, envCubemapImageView, nullptr);
        vkDestroyImage(device, envCubemapImage, nullptr);
        vkFreeMemory(device, envCubemapImageMemory, nullptr);

        vkDestroyImageView(device, irradianceImageView, nullptr);
        vkDestroyImage(device, irradianceImage, nullptr);
        vkFreeMemory(device, irradianceImageMemory, nullptr);

        vkDestroyImageView(device, prefilterImageView, nullptr);
        vkDestroyImage(device, prefilterImage, nullptr);
        vkFreeMemory(device, prefilterImageMemory, nullptr);

        vkDestroyImageView(device, brdfLUTImageView, nullptr);
        vkDestroyImage(device, brdfLUTImage, nullptr);
        vkFreeMemory(device, brdfLUTImageMemory, nullptr);

        vkDestroySampler(device, textureSampler, nullptr);

        vkDestroyImageView(device, albedoImageView, nullptr);
        vkDestroyImage(device, albedoImage, nullptr);
        vkFreeMemory(device, albedoImageMemory, nullptr);

        vkDestroyImageView(device, normalImageView, nullptr);
        vkDestroyImage(device, normalImage, nullptr);
        vkFreeMemory(device, normalImageMemory, nullptr);

        vkDestroyImageView(device, metallicImageView, nullptr);
        vkDestroyImage(device, metallicImage, nullptr);
        vkFreeMemory(device, metallicImageMemory, nullptr);

        vkDestroyImageView(device, roughnessImageView, nullptr);
        vkDestroyImage(device, roughnessImage, nullptr);
        vkFreeMemory(device, roughnessImageMemory, nullptr);

        vkDestroyImageView(device, aoImageView, nullptr);
        vkDestroyImage(device, aoImage, nullptr);
        vkFreeMemory(device, aoImageMemory, nullptr);

        vkDestroyCommandPool(device, commandPool, nullptr);

        vkDestroyImageView(device, depthImageView, nullptr);
        vkDestroyImage(device, depthImage, nullptr);
        vkFreeMemory(device, depthImageMemory, nullptr);

        for (auto framebuffer : swapChainFramebuffers) {
            vkDestroyFramebuffer(device, framebuffer, nullptr);
        }

        vkDestroyPipeline(device, pbrPipeline, nullptr);
        vkDestroyPipeline(device, equirectangularToCubemapPipeline, nullptr);
        vkDestroyPipeline(device, backgroundPipeline, nullptr);
        vkDestroyPipeline(device, irradiancePipeline, nullptr);
        vkDestroyPipeline(device, prefilterPipeline, nullptr);
        vkDestroyPipeline(device, brdfPipeline, nullptr);
        vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
        vkDestroyDescriptorSetLayout(device, descriptorSetLayout, nullptr);
        vkDestroyRenderPass(device, renderPass, nullptr);
        vkDestroyRenderPass(device, captureRenderPass, nullptr);
        vkDestroyRenderPass(device, brdfRenderPass, nullptr);

        for (auto imageView : swapChainImageViews) {
            vkDestroyImageView(device, imageView, nullptr);
        }

        vkDestroySwapchainKHR(device, swapChain, nullptr);

        vkDestroyDevice(device, nullptr);

        if (enableValidationLayers) {
            DestroyDebugUtilsMessengerEXT(instance, debugMessenger, nullptr);
        }

        vkDestroySurfaceKHR(instance, surface, nullptr);

        vkDestroyInstance(instance, nullptr);

        glfwDestroyWindow(window);

        glfwTerminate();
    }

    void createInstance() {
        if (enableValidationLayers && !checkValidationLayerSupport()) {
            throw std::runtime_error("validation layers requested, but not available!");
        }

        VkApplicationInfo appInfo{};
        appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
        appInfo.pApplicationName = "Hello Triangle";
        appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
        appInfo.pEngineName = "No Engine";
        appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
        appInfo.apiVersion = VK_API_VERSION_1_0;

        VkInstanceCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
        createInfo.pApplicationInfo = &appInfo;

        auto extensions = getRequiredExtensions();
        createInfo.enabledExtensionCount = static_cast<uint32_t>(extensions.size());
        createInfo.ppEnabledExtensionNames = extensions.data();

        VkDebugUtilsMessengerCreateInfoEXT debugCreateInfo{};
        if (enableValidationLayers) {
            createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
            createInfo.ppEnabledLayerNames = validationLayers.data();

            populateDebugMessengerCreateInfo(debugCreateInfo);
            createInfo.pNext = (VkDebugUtilsMessengerCreateInfoEXT*) &debugCreateInfo;
        } else {
            createInfo.enabledLayerCount = 0;

            createInfo.pNext = nullptr;
        }

        if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS) {
            throw std::runtime_error("failed to create instance!");
        }
    }

    void populateDebugMessengerCreateInfo(VkDebugUtilsMessengerCreateInfoEXT& createInfo) {
        createInfo = {};
        createInfo.sType = VK_STRUCTURE_TYPE_DEBUG_UTILS_MESSENGER_CREATE_INFO_EXT;
        createInfo.messageSeverity = VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT;
        createInfo.messageType = VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT;
        createInfo.pfnUserCallback = debugCallback;
    }

    void setupDebugMessenger() {
        if (!enableValidationLayers) return;

        VkDebugUtilsMessengerCreateInfoEXT createInfo;
        populateDebugMessengerCreateInfo(createInfo);

        if (CreateDebugUtilsMessengerEXT(instance, &createInfo, nullptr, &debugMessenger) != VK_SUCCESS) {
            throw std::runtime_error("failed to set up debug messenger!");
        }
    }

    void createSurface() {
        if (glfwCreateWindowSurface(instance, window, nullptr, &surface) != VK_SUCCESS) {
            throw std::runtime_error("failed to create window surface!");
        }
    }

    void pickPhysicalDevice() {
        uint32_t deviceCount = 0;
        vkEnumeratePhysicalDevices(instance, &deviceCount, nullptr);

        if (deviceCount == 0) {
            throw std::runtime_error("failed to find GPUs with Vulkan support!");
        }

        std::vector<VkPhysicalDevice> devices(deviceCount);
        vkEnumeratePhysicalDevices(instance, &deviceCount, devices.data());

        for (const auto& device : devices) {
            if (isDeviceSuitable(device)) {
                physicalDevice = device;
                break;
            }
        }

        if (physicalDevice == VK_NULL_HANDLE) {
            throw std::runtime_error("failed to find a suitable GPU!");
        }
    }

    void createLogicalDevice() {
        QueueFamilyIndices indices = findQueueFamilies(physicalDevice);

        std::vector<VkDeviceQueueCreateInfo> queueCreateInfos;
        std::set<uint32_t> uniqueQueueFamilies = {indices.graphicsFamily.value(), indices.presentFamily.value()};

        float queuePriority = 1.0f;
        for (uint32_t queueFamily : uniqueQueueFamilies) {
            VkDeviceQueueCreateInfo queueCreateInfo{};
            queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
            queueCreateInfo.queueFamilyIndex = queueFamily;
            queueCreateInfo.queueCount = 1;
            queueCreateInfo.pQueuePriorities = &queuePriority;
            queueCreateInfos.push_back(queueCreateInfo);
        }

        VkPhysicalDeviceFeatures deviceFeatures{};
        deviceFeatures.samplerAnisotropy = VK_TRUE;

        VkDeviceCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;

        createInfo.queueCreateInfoCount = static_cast<uint32_t>(queueCreateInfos.size());
        createInfo.pQueueCreateInfos = queueCreateInfos.data();

        createInfo.pEnabledFeatures = &deviceFeatures;

        createInfo.enabledExtensionCount = static_cast<uint32_t>(deviceExtensions.size());
        createInfo.ppEnabledExtensionNames = deviceExtensions.data();

        if (enableValidationLayers) {
            createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
            createInfo.ppEnabledLayerNames = validationLayers.data();
        } else {
            createInfo.enabledLayerCount = 0;
        }

        if (vkCreateDevice(physicalDevice, &createInfo, nullptr, &device) != VK_SUCCESS) {
            throw std::runtime_error("failed to create logical device!");
        }

        vkGetDeviceQueue(device, indices.graphicsFamily.value(), 0, &graphicsQueue);
        vkGetDeviceQueue(device, indices.presentFamily.value(), 0, &presentQueue);
    }

    void createSwapChain() {
        SwapChainSupportDetails swapChainSupport = querySwapChainSupport(physicalDevice);

        VkSurfaceFormatKHR surfaceFormat = chooseSwapSurfaceFormat(swapChainSupport.formats);
        VkPresentModeKHR presentMode = chooseSwapPresentMode(swapChainSupport.presentModes);
        VkExtent2D extent = chooseSwapExtent(swapChainSupport.capabilities);

        uint32_t imageCount = swapChainSupport.capabilities.minImageCount + 1;
        if (swapChainSupport.capabilities.maxImageCount > 0 && imageCount > swapChainSupport.capabilities.maxImageCount) {
            imageCount = swapChainSupport.capabilities.maxImageCount;
        }

        VkSwapchainCreateInfoKHR createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR;
        createInfo.surface = surface;

        createInfo.minImageCount = imageCount;
        createInfo.imageFormat = surfaceFormat.format;
        createInfo.imageColorSpace = surfaceFormat.colorSpace;
        createInfo.imageExtent = extent;
        createInfo.imageArrayLayers = 1;
        createInfo.imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;

        QueueFamilyIndices indices = findQueueFamilies(physicalDevice);
        uint32_t queueFamilyIndices[] = {indices.graphicsFamily.value(), indices.presentFamily.value()};

        if (indices.graphicsFamily != indices.presentFamily) {
            createInfo.imageSharingMode = VK_SHARING_MODE_CONCURRENT;
            createInfo.queueFamilyIndexCount = 2;
            createInfo.pQueueFamilyIndices = queueFamilyIndices;
        } else {
            createInfo.imageSharingMode = VK_SHARING_MODE_EXCLUSIVE;
        }

        createInfo.preTransform = swapChainSupport.capabilities.currentTransform;
        createInfo.compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
        createInfo.presentMode = presentMode;
        createInfo.clipped = VK_TRUE;

        createInfo.oldSwapchain = VK_NULL_HANDLE;

        if (vkCreateSwapchainKHR(device, &createInfo, nullptr, &swapChain) != VK_SUCCESS) {
            throw std::runtime_error("failed to create swap chain!");
        }

        vkGetSwapchainImagesKHR(device, swapChain, &imageCount, nullptr);
        swapChainImages.resize(imageCount);
        vkGetSwapchainImagesKHR(device, swapChain, &imageCount, swapChainImages.data());

        swapChainImageFormat = surfaceFormat.format;
        swapChainExtent = extent;
    }

    void createImageViews() {
        swapChainImageViews.resize(swapChainImages.size());

        for (size_t i = 0; i < swapChainImages.size(); i++) {
            swapChainImageViews[i] = createImageView(swapChainImages[i], swapChainImageFormat, VK_IMAGE_ASPECT_COLOR_BIT, 1);
        }
    }

    void createRenderPass() {
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = swapChainImageFormat;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;

        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

        VkAttachmentReference colorAttachmentRef{};
        colorAttachmentRef.attachment = 0;
        colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 1;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 1;
        subpass.pColorAttachments = &colorAttachmentRef;
        subpass.pDepthStencilAttachment = &depthAttachmentRef;

        VkSubpassDependency dependency{};
        dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
        dependency.dstSubpass = 0;
        dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependency.srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT;
        dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;

        std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, depthAttachment};
        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        renderPassInfo.pAttachments = attachments.data();
        renderPassInfo.subpassCount = 1;
        renderPassInfo.pSubpasses = &subpass;
        renderPassInfo.dependencyCount = 1;
        renderPassInfo.pDependencies = &dependency;

        if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &renderPass) != VK_SUCCESS) {
            throw std::runtime_error("failed to create render pass!");
        }
    }

    // The render pass of a capture: one colour attachment - a face of a cube map (or any image of this format) -, no
    // depth: the cube is looked at from the inside, nothing can hide anything. The cube covers every pixel, so the
    // attachment need not be cleared; at the end it is left ready to be sampled.
    void createCaptureRenderPass(VkFormat format, VkRenderPass& captureRenderPass) {
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = format;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass

        VkAttachmentReference colorAttachmentRef{};
        colorAttachmentRef.attachment = 0;
        colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 1;
        subpass.pColorAttachments = &colorAttachmentRef;

        std::array<VkSubpassDependency, 2> dependencies{};
        // before the pass: wait for whatever read the image before (it is written now)
        dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[0].dstSubpass = 0;
        dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[0].srcAccessMask = 0;
        dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        // after the pass: the fragment shaders that sample the image wait until it has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = 1;
        renderPassInfo.pAttachments = &colorAttachment;
        renderPassInfo.subpassCount = 1;
        renderPassInfo.pSubpasses = &subpass;
        renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());
        renderPassInfo.pDependencies = dependencies.data();

        if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &captureRenderPass) != VK_SUCCESS) {
            throw std::runtime_error("failed to create capture render pass!");
        }
    }

    void createDescriptorSetLayout() {
        // like vulkan-tutorial: the uniform buffer at binding 0
        VkDescriptorSetLayoutBinding uboLayoutBinding{};
        uboLayoutBinding.binding = 0;
        uboLayoutBinding.descriptorCount = 1;
        uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        uboLayoutBinding.pImmutableSamplers = nullptr;
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // the matrices, the lights, the material and camPos

        // then the images: one at binding 1 (the HDR image, or a cube map), or the spheres' eight - irradianceMap,
        // prefilterMap and brdfLUT at bindings 1, 2 and 3, the material's five maps at bindings 4..8
        std::array<VkDescriptorSetLayoutBinding, 9> bindings{};
        bindings[0] = uboLayoutBinding;
        for (uint32_t i = 1; i < bindings.size(); i++) {
            bindings[i].binding = i;
            bindings[i].descriptorCount = 1;
            bindings[i].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
            bindings[i].pImmutableSamplers = nullptr;
            bindings[i].stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        }

        VkDescriptorSetLayoutCreateInfo layoutInfo{};
        layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
        layoutInfo.bindingCount = static_cast<uint32_t>(bindings.size());
        layoutInfo.pBindings = bindings.data();

        if (vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &descriptorSetLayout) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor set layout!");
        }
    }

    void createPipelineLayout() {
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // model: vertex, the material: fragment
        pushConstantRange.offset = 0;
        pushConstantRange.size = std::max(sizeof(PushConstants), sizeof(CapturePushConstants)); // one range for both structs

        VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
        pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
        pipelineLayoutInfo.setLayoutCount = 1;
        pipelineLayoutInfo.pSetLayouts = &descriptorSetLayout;
        pipelineLayoutInfo.pushConstantRangeCount = 1;
        pipelineLayoutInfo.pPushConstantRanges = &pushConstantRange;

        if (vkCreatePipelineLayout(device, &pipelineLayoutInfo, nullptr, &pipelineLayout) != VK_SUCCESS) {
            throw std::runtime_error("failed to create pipeline layout!");
        }
    }

    // One graphics pipeline from a vertex and a fragment shader, with the pipeline layout (descriptor set + push
    // constants) and the fixed functions below, for one render pass (a pipeline can only be used in the render pass it
    // was made for, or one with the same attachment formats) and one kind of primitive (a triangle strip or list).
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkRenderPass pipelineRenderPass, VkPrimitiveTopology topology, VkPipeline& pipeline) {
        auto vertShaderCode = readFile(vertShaderFile);
        auto fragShaderCode = readFile(fragShaderFile);

        VkShaderModule vertShaderModule = createShaderModule(vertShaderCode);
        VkShaderModule fragShaderModule = createShaderModule(fragShaderCode);

        VkPipelineShaderStageCreateInfo vertShaderStageInfo{};
        vertShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
        vertShaderStageInfo.stage = VK_SHADER_STAGE_VERTEX_BIT;
        vertShaderStageInfo.module = vertShaderModule;
        vertShaderStageInfo.pName = "main";

        VkPipelineShaderStageCreateInfo fragShaderStageInfo{};
        fragShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
        fragShaderStageInfo.stage = VK_SHADER_STAGE_FRAGMENT_BIT;
        fragShaderStageInfo.module = fragShaderModule;
        fragShaderStageInfo.pName = "main";

        VkPipelineShaderStageCreateInfo shaderStages[] = {vertShaderStageInfo, fragShaderStageInfo};

        VkPipelineVertexInputStateCreateInfo vertexInputInfo{};
        vertexInputInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO;

        auto bindingDescription = Vertex::getBindingDescription();
        auto attributeDescriptions = Vertex::getAttributeDescriptions();

        vertexInputInfo.vertexBindingDescriptionCount = 1;
        vertexInputInfo.vertexAttributeDescriptionCount = static_cast<uint32_t>(attributeDescriptions.size());
        vertexInputInfo.pVertexBindingDescriptions = &bindingDescription;
        vertexInputInfo.pVertexAttributeDescriptions = attributeDescriptions.data();

        VkPipelineInputAssemblyStateCreateInfo inputAssembly{};
        inputAssembly.sType = VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO;
        inputAssembly.topology = topology; // the sphere is one long strip (learnopengl: GL_TRIANGLE_STRIP), the cube a list of triangles
        inputAssembly.primitiveRestartEnable = VK_FALSE;

        VkPipelineViewportStateCreateInfo viewportState{};
        viewportState.sType = VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO;
        viewportState.viewportCount = 1;
        viewportState.scissorCount = 1;

        VkPipelineRasterizationStateCreateInfo rasterizer{};
        rasterizer.sType = VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO;
        rasterizer.depthClampEnable = VK_FALSE;
        rasterizer.rasterizerDiscardEnable = VK_FALSE;
        rasterizer.polygonMode = VK_POLYGON_MODE_FILL;
        rasterizer.lineWidth = 1.0f;
        rasterizer.cullMode = VK_CULL_MODE_NONE; // no culling, as in learnopengl's PBR demos
        rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;
        rasterizer.depthBiasEnable = VK_FALSE;

        VkPipelineMultisampleStateCreateInfo multisampling{};
        multisampling.sType = VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO;
        multisampling.sampleShadingEnable = VK_FALSE;
        multisampling.rasterizationSamples = VK_SAMPLE_COUNT_1_BIT;

        VkPipelineDepthStencilStateCreateInfo depthStencil{};
        depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
        depthStencil.depthTestEnable = VK_TRUE;
        depthStencil.depthWriteEnable = VK_TRUE;
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS_OR_EQUAL; // set depth function to less than AND equal for skybox depth trick.
        depthStencil.depthBoundsTestEnable = VK_FALSE;
        depthStencil.stencilTestEnable = VK_FALSE;

        VkPipelineColorBlendAttachmentState colorBlendAttachment{};
        colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
        colorBlendAttachment.blendEnable = VK_FALSE;

        VkPipelineColorBlendStateCreateInfo colorBlending{};
        colorBlending.sType = VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO;
        colorBlending.logicOpEnable = VK_FALSE;
        colorBlending.logicOp = VK_LOGIC_OP_COPY;
        colorBlending.attachmentCount = 1;
        colorBlending.pAttachments = &colorBlendAttachment;
        colorBlending.blendConstants[0] = 0.0f;
        colorBlending.blendConstants[1] = 0.0f;
        colorBlending.blendConstants[2] = 0.0f;
        colorBlending.blendConstants[3] = 0.0f;

        std::vector<VkDynamicState> dynamicStates = {
            VK_DYNAMIC_STATE_VIEWPORT,
            VK_DYNAMIC_STATE_SCISSOR
        };
        VkPipelineDynamicStateCreateInfo dynamicState{};
        dynamicState.sType = VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO;
        dynamicState.dynamicStateCount = static_cast<uint32_t>(dynamicStates.size());
        dynamicState.pDynamicStates = dynamicStates.data();

        VkGraphicsPipelineCreateInfo pipelineInfo{};
        pipelineInfo.sType = VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO;
        pipelineInfo.stageCount = 2;
        pipelineInfo.pStages = shaderStages;
        pipelineInfo.pVertexInputState = &vertexInputInfo;
        pipelineInfo.pInputAssemblyState = &inputAssembly;
        pipelineInfo.pViewportState = &viewportState;
        pipelineInfo.pRasterizationState = &rasterizer;
        pipelineInfo.pMultisampleState = &multisampling;
        pipelineInfo.pDepthStencilState = &depthStencil;
        pipelineInfo.pColorBlendState = &colorBlending;
        pipelineInfo.pDynamicState = &dynamicState;
        pipelineInfo.layout = pipelineLayout;
        pipelineInfo.renderPass = pipelineRenderPass;
        pipelineInfo.subpass = 0;
        pipelineInfo.basePipelineHandle = VK_NULL_HANDLE;

        if (vkCreateGraphicsPipelines(device, VK_NULL_HANDLE, 1, &pipelineInfo, nullptr, &pipeline) != VK_SUCCESS) {
            throw std::runtime_error("failed to create graphics pipeline!");
        }

        vkDestroyShaderModule(device, fragShaderModule, nullptr);
        vkDestroyShaderModule(device, vertShaderModule, nullptr);
    }

    void createFramebuffers() {
        swapChainFramebuffers.resize(swapChainImageViews.size());

        for (size_t i = 0; i < swapChainImageViews.size(); i++) {
            std::array<VkImageView, 2> attachments = {
                swapChainImageViews[i],
                depthImageView
            };

            VkFramebufferCreateInfo framebufferInfo{};
            framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
            framebufferInfo.renderPass = renderPass;
            framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
            framebufferInfo.pAttachments = attachments.data();
            framebufferInfo.width = swapChainExtent.width;
            framebufferInfo.height = swapChainExtent.height;
            framebufferInfo.layers = 1;

            if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &swapChainFramebuffers[i]) != VK_SUCCESS) {
                throw std::runtime_error("failed to create framebuffer!");
            }
        }
    }

    void createCommandPool() {
        QueueFamilyIndices queueFamilyIndices = findQueueFamilies(physicalDevice);

        VkCommandPoolCreateInfo poolInfo{};
        poolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
        poolInfo.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
        poolInfo.queueFamilyIndex = queueFamilyIndices.graphicsFamily.value();

        if (vkCreateCommandPool(device, &poolInfo, nullptr, &commandPool) != VK_SUCCESS) {
            throw std::runtime_error("failed to create command pool!");
        }
    }

    void createDepthResources() {
        VkFormat depthFormat = findDepthFormat();

        createImage(swapChainExtent.width, swapChainExtent.height, 1, depthFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, depthImage, depthImageMemory);
        depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT, 1);
    }

    VkFormat findSupportedFormat(const std::vector<VkFormat>& candidates, VkImageTiling tiling, VkFormatFeatureFlags features) {
        for (VkFormat format : candidates) {
            VkFormatProperties props;
            vkGetPhysicalDeviceFormatProperties(physicalDevice, format, &props);

            if (tiling == VK_IMAGE_TILING_LINEAR && (props.linearTilingFeatures & features) == features) {
                return format;
            } else if (tiling == VK_IMAGE_TILING_OPTIMAL && (props.optimalTilingFeatures & features) == features) {
                return format;
            }
        }

        throw std::runtime_error("failed to find supported format!");
    }

    VkFormat findDepthFormat() {
        return findSupportedFormat(
            {VK_FORMAT_D32_SFLOAT, VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT
        );
    }

    // learnopengl's loadTexture: an image file -> a texture image with all its mip levels (device local, ready for
    // sampling) and its view. The format says how the shaders read the bytes: _UNORM as they are, _SRGB decoded from
    // sRGB to linear colours.
    void loadTexture(const char* path, VkFormat format, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        // tell stb_image.h to flip loaded textures on the y-axis: v = 0 is then the image's bottom row, as in OpenGL (the
        // sphere's texture coordinates and the normal map expect that)
        stbi_set_flip_vertically_on_load(true);
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load(path, &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        // the number of mip levels: how often the larger side can be halved, plus the image itself (vulkan-tutorial's
        // "Generating Mipmaps")
        uint32_t mipLevels = static_cast<uint32_t>(std::floor(std::log2(std::max(texWidth, texHeight)))) + 1;

        VkDeviceSize imageSize = texWidth * texHeight * 4;
        createTextureImage(pixels, imageSize, texWidth, texHeight, mipLevels, format, image, imageMemory);
        stbi_image_free(pixels);

        // learnopengl: glGenerateMipmap(GL_TEXTURE_2D)
        generateMipmaps(image, format, texWidth, texHeight, mipLevels, 1);

        imageView = createImageView(image, format, VK_IMAGE_ASPECT_COLOR_BIT, mipLevels);
    }

    // pbr: load the HDR environment map. stbi_loadf returns floats - here four per pixel (RGBA), the image format
    // VK_FORMAT_R32G32B32A32_SFLOAT (learnopengl: GL_RGB16F from GL_FLOAT data).
    void loadHdrTexture(const char* path, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        stbi_set_flip_vertically_on_load(true);
        int width, height, nrComponents;
        float* data = stbi_loadf(path, &width, &height, &nrComponents, STBI_rgb_alpha);

        if (!data) {
            throw std::runtime_error("failed to load HDR image!");
        }

        // linear filtering of 32-bit float images is optional in Vulkan (desktop GPUs have it): check before relying on it
        VkFormat format = findSupportedFormat(
            {VK_FORMAT_R32G32B32A32_SFLOAT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT
        );

        VkDeviceSize imageSize = width * height * 4 * sizeof(float);
        createTextureImage(data, imageSize, width, height, 1, format, image, imageMemory);
        stbi_image_free(data);

        imageView = createImageView(image, format, VK_IMAGE_ASPECT_COLOR_BIT, 1);
    }

    // pbr: setup cubemap to render to. A 16-bit float cube map (learnopengl: six glTexImage2D(
    // GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, size, size, ...)): one image with six array layers - the faces
    // +X, -X, +Y, -Y, +Z, -Z -, drawn into one face at a time (colour attachment) and sampled with a direction afterwards,
    // and the cube view of its six layers.
    void createCubemap(uint32_t size, uint32_t mipLevels, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT; // its six layers can be viewed as a cube map
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = size;
        imageInfo.extent.height = size;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = mipLevels;
        imageInfo.arrayLayers = 6; // one layer per face
        imageInfo.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        // TRANSFER_SRC and TRANSFER_DST: generateMipmaps() blits one mip level into the next
        imageInfo.usage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT | VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateImage(device, &imageInfo, nullptr, &image) != VK_SUCCESS) {
            throw std::runtime_error("failed to create cube map image!");
        }

        VkMemoryRequirements memRequirements;
        vkGetImageMemoryRequirements(device, image, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &imageMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate cube map image memory!");
        }

        vkBindImageMemory(device, image, imageMemory, 0);

        // all six layers as a cube map (sampled with a direction: samplerCube)
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
        viewInfo.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = mipLevels;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 6;

        if (vkCreateImageView(device, &viewInfo, nullptr, &imageView) != VK_SUCCESS) {
            throw std::runtime_error("failed to create cube map image view!");
        }
    }

    // A texture image (device local, ready for sampling) whose mip level 0 holds the given pixels - imageSize bytes:
    // 4 bytes per pixel from stbi_load, 4 floats per pixel from stbi_loadf -, copied through a staging buffer. The other
    // mip levels are left for generateMipmaps(). The caller frees the pixels.
    void createTextureImage(const void* pixels, VkDeviceSize imageSize, int texWidth, int texHeight, uint32_t mipLevels, VkFormat format, VkImage& image, VkDeviceMemory& imageMemory) {
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, imageSize, 0, &data);
            memcpy(data, pixels, static_cast<size_t>(imageSize));
        vkUnmapMemory(device, stagingBufferMemory);

        // TRANSFER_SRC too: a mip level is the source of the blit that fills the next one
        createImage(texWidth, texHeight, mipLevels, format, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, image, imageMemory);

        transitionImageLayout(image, format, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, image, static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight));
        transitionImageLayout(image, format, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }

    // vulkan-tutorial's generateMipmaps ("Generating Mipmaps") - Vulkan's glGenerateMipmap: every mip level is filled
    // with a blit (a scaled copy with linear filtering) of the level above it, half its size. Level 0 holds the picture
    // and is in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL, the other levels are still undefined; at the end all levels are
    // ready for sampling. layerCount: 1 for a 2D image, 6 for a cube map (all six faces are blitted at once).
    void generateMipmaps(VkImage image, VkFormat imageFormat, int32_t texWidth, int32_t texHeight, uint32_t mipLevels, uint32_t layerCount) {
        // Check if image format supports linear blitting
        VkFormatProperties formatProperties;
        vkGetPhysicalDeviceFormatProperties(physicalDevice, imageFormat, &formatProperties);

        if (!(formatProperties.optimalTilingFeatures & VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT)) {
            throw std::runtime_error("texture image format does not support linear blitting!");
        }

        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        // two barriers per step: [0] for the level that is read (i - 1), [1] for the level that is written (i)
        std::array<VkImageMemoryBarrier, 2> barriers{};
        for (auto& barrier : barriers) {
            barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
            barrier.image = image;
            barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
            barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
            barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            barrier.subresourceRange.baseArrayLayer = 0;
            barrier.subresourceRange.layerCount = layerCount;
            barrier.subresourceRange.levelCount = 1;
        }

        int32_t mipWidth = texWidth;
        int32_t mipHeight = texHeight;

        for (uint32_t i = 1; i < mipLevels; i++) {
            // before the blit: level i - 1 becomes the source, level i the destination
            barriers[0].subresourceRange.baseMipLevel = i - 1;
            barriers[0].oldLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            barriers[0].newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
            barriers[0].srcAccessMask = VK_ACCESS_SHADER_READ_BIT;
            barriers[0].dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;

            barriers[1].subresourceRange.baseMipLevel = i;
            barriers[1].oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
            barriers[1].newLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
            barriers[1].srcAccessMask = 0;
            barriers[1].dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;

            vkCmdPipelineBarrier(commandBuffer,
                VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0,
                0, nullptr,
                0, nullptr,
                static_cast<uint32_t>(barriers.size()), barriers.data());

            VkImageBlit blit{};
            blit.srcOffsets[0] = {0, 0, 0};
            blit.srcOffsets[1] = {mipWidth, mipHeight, 1};
            blit.srcSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            blit.srcSubresource.mipLevel = i - 1;
            blit.srcSubresource.baseArrayLayer = 0;
            blit.srcSubresource.layerCount = layerCount;
            blit.dstOffsets[0] = {0, 0, 0};
            blit.dstOffsets[1] = { mipWidth > 1 ? mipWidth / 2 : 1, mipHeight > 1 ? mipHeight / 2 : 1, 1 };
            blit.dstSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            blit.dstSubresource.mipLevel = i;
            blit.dstSubresource.baseArrayLayer = 0;
            blit.dstSubresource.layerCount = layerCount;

            vkCmdBlitImage(commandBuffer,
                image, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
                image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
                1, &blit,
                VK_FILTER_LINEAR);

            // after the blit: both levels are ready for sampling (level i is the source of the next step)
            barriers[0].oldLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
            barriers[0].newLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            barriers[0].srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
            barriers[0].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

            barriers[1].oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
            barriers[1].newLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            barriers[1].srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
            barriers[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

            vkCmdPipelineBarrier(commandBuffer,
                VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, 0,
                0, nullptr,
                0, nullptr,
                static_cast<uint32_t>(barriers.size()), barriers.data());

            if (mipWidth > 1) mipWidth /= 2;
            if (mipHeight > 1) mipHeight /= 2;
        }

        endSingleTimeCommands(commandBuffer);
    }

    // A sampler: linear filtering - inside a mip level and between the mip levels, if the image has more than one -,
    // the wrapping mode for texture coordinates outside 0..1 (REPEAT, CLAMP_TO_EDGE ...), and anisotropic filtering
    // on or off.
    void createTextureSampler(VkSamplerAddressMode addressMode, VkBool32 anisotropyEnable, VkSampler& sampler) {
        VkPhysicalDeviceProperties properties{};
        vkGetPhysicalDeviceProperties(physicalDevice, &properties);

        VkSamplerCreateInfo samplerInfo{};
        samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
        samplerInfo.addressModeU = addressMode;
        samplerInfo.addressModeV = addressMode;
        samplerInfo.addressModeW = addressMode;
        samplerInfo.anisotropyEnable = anisotropyEnable;
        samplerInfo.maxAnisotropy = anisotropyEnable ? properties.limits.maxSamplerAnisotropy : 1.0f;
        samplerInfo.borderColor = VK_BORDER_COLOR_INT_OPAQUE_BLACK;
        samplerInfo.unnormalizedCoordinates = VK_FALSE;
        samplerInfo.compareEnable = VK_FALSE;
        samplerInfo.compareOp = VK_COMPARE_OP_ALWAYS;
        samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
        samplerInfo.minLod = 0.0f;
        samplerInfo.maxLod = VK_LOD_CLAMP_NONE; // use all the mip levels the image has

        if (vkCreateSampler(device, &samplerInfo, nullptr, &sampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
    }

    VkImageView createImageView(VkImage image, VkFormat format, VkImageAspectFlags aspectFlags, uint32_t mipLevels) {
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
        viewInfo.format = format;
        viewInfo.subresourceRange.aspectMask = aspectFlags;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = mipLevels;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 1;

        VkImageView imageView;
        if (vkCreateImageView(device, &viewInfo, nullptr, &imageView) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image view!");
        }

        return imageView;
    }

    void createImage(uint32_t width, uint32_t height, uint32_t mipLevels, VkFormat format, VkImageTiling tiling, VkImageUsageFlags usage, VkMemoryPropertyFlags properties, VkImage& image, VkDeviceMemory& imageMemory) {
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = width;
        imageInfo.extent.height = height;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = mipLevels;
        imageInfo.arrayLayers = 1;
        imageInfo.format = format;
        imageInfo.tiling = tiling;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = usage;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateImage(device, &imageInfo, nullptr, &image) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image!");
        }

        VkMemoryRequirements memRequirements;
        vkGetImageMemoryRequirements(device, image, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &imageMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate image memory!");
        }

        vkBindImageMemory(device, image, imageMemory, 0);
    }

    void transitionImageLayout(VkImage image, VkFormat format, VkImageLayout oldLayout, VkImageLayout newLayout) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkImageMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
        barrier.oldLayout = oldLayout;
        barrier.newLayout = newLayout;
        barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.image = image;
        barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        barrier.subresourceRange.baseMipLevel = 0;
        barrier.subresourceRange.levelCount = 1;
        barrier.subresourceRange.baseArrayLayer = 0;
        barrier.subresourceRange.layerCount = 1;

        VkPipelineStageFlags sourceStage;
        VkPipelineStageFlags destinationStage;

        if (oldLayout == VK_IMAGE_LAYOUT_UNDEFINED && newLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL) {
            barrier.srcAccessMask = 0;
            barrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;

            sourceStage = VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT;
            destinationStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
        } else if (oldLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL && newLayout == VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL) {
            barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
            barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

            sourceStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
            destinationStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        } else {
            throw std::invalid_argument("unsupported layout transition!");
        }

        vkCmdPipelineBarrier(
            commandBuffer,
            sourceStage, destinationStage,
            0,
            0, nullptr,
            0, nullptr,
            1, &barrier
        );

        endSingleTimeCommands(commandBuffer);
    }

    void copyBufferToImage(VkBuffer buffer, VkImage image, uint32_t width, uint32_t height) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferImageCopy region{};
        region.bufferOffset = 0;
        region.bufferRowLength = 0;
        region.bufferImageHeight = 0;
        region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        region.imageSubresource.mipLevel = 0;
        region.imageSubresource.baseArrayLayer = 0;
        region.imageSubresource.layerCount = 1;
        region.imageOffset = {0, 0, 0};
        region.imageExtent = {
            width,
            height,
            1
        };

        vkCmdCopyBufferToImage(commandBuffer, buffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);

        endSingleTimeCommands(commandBuffer);
    }

    // learnopengl's renderSphere(), the part that builds the sphere on first use: a UV sphere of radius 1 with
    // 24 x 24 segments (learnopengl: 64 x 64), drawn as one indexed triangle strip.
    void createSphere() {
        const unsigned int X_SEGMENTS = 24;
        const unsigned int Y_SEGMENTS = 24;
        const float PI = 3.14159265359f;
        for (unsigned int x = 0; x <= X_SEGMENTS; ++x) {
            for (unsigned int y = 0; y <= Y_SEGMENTS; ++y) {
                float xSegment = (float)x / (float)X_SEGMENTS;
                float ySegment = (float)y / (float)Y_SEGMENTS;
                float xPos = std::cos(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
                float yPos = std::cos(ySegment * PI);
                float zPos = std::sin(xSegment * 2.0f * PI) * std::sin(ySegment * PI);

                Vertex vertex{};
                vertex.pos = glm::vec3(xPos, yPos, zPos);
                vertex.normal = glm::vec3(xPos, yPos, zPos);
                vertex.texCoord = glm::vec2(xSegment, ySegment);
                // the tangent: the direction in which the texture's u grows on the surface (the position's derivative by u, normalised)
                vertex.tangent = glm::vec3(-std::sin(xSegment * 2.0f * PI), 0.0f, std::cos(xSegment * 2.0f * PI));
                sphereVertices.push_back(vertex);
            }
        }

        bool oddRow = false;
        for (unsigned int y = 0; y < Y_SEGMENTS; ++y) {
            if (!oddRow) { // even rows: y == 0, y == 2; and so on
                for (unsigned int x = 0; x <= X_SEGMENTS; ++x) {
                    sphereIndices.push_back(y       * (X_SEGMENTS + 1) + x);
                    sphereIndices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                }
            } else {
                for (int x = X_SEGMENTS; x >= 0; --x) {
                    sphereIndices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                    sphereIndices.push_back(y       * (X_SEGMENTS + 1) + x);
                }
            }
            oddRow = !oddRow;
        }
    }

    // A vertex buffer in the GPU's own memory with a copy of the vertices (through a staging buffer, as in
    // vulkan-tutorial's "Staging buffer").
    void createVertexBuffer(const void* vertexData, VkDeviceSize bufferSize, VkBuffer& buffer, VkDeviceMemory& bufferMemory) {
        // a staging buffer the CPU can write to
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertexData, (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        // the vertex buffer in the GPU's own (device local) memory, filled with a copy of the staging buffer
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, buffer, bufferMemory);

        copyBuffer(stagingBuffer, buffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }

    // An index buffer in the GPU's own memory with a copy of the indices (through a staging buffer).
    void createIndexBuffer(const std::vector<uint32_t>& indices, VkBuffer& buffer, VkDeviceMemory& bufferMemory) {
        VkDeviceSize bufferSize = sizeof(indices[0]) * indices.size();

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, indices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_INDEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, buffer, bufferMemory);

        copyBuffer(stagingBuffer, buffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }

    void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferCopy copyRegion{};
        copyRegion.size = size;
        vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

        endSingleTimeCommands(commandBuffer);
    }

    void createUniformBuffers() {
        VkDeviceSize bufferSize = sizeof(UniformBufferObject);

        createBuffer(bufferSize, VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, uniformBuffer, uniformBufferMemory);

        // "persistent mapping": the memory stays mapped while the program runs, we write to it every frame
        vkMapMemory(device, uniformBufferMemory, 0, bufferSize, 0, &uniformBufferMapped);
    }

    void createDescriptorPool() {
        // five descriptor sets (the spheres', the HDR image's, the environment cube map's, the irradiance map's, the
        // pre-filter map's): each takes what the layout has - one uniform buffer and eight images -, even when images
        // stay empty
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 5;
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 5 * 8;

        VkDescriptorPoolCreateInfo poolInfo{};
        poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
        poolInfo.poolSizeCount = static_cast<uint32_t>(poolSizes.size());
        poolInfo.pPoolSizes = poolSizes.data();
        poolInfo.maxSets = 5;

        if (vkCreateDescriptorPool(device, &poolInfo, nullptr, &descriptorPool) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor pool!");
        }
    }

    // The spheres' descriptor set: the uniform buffer (binding 0), the pre-computed IBL data (bindings 1, 2 and 3 -
    // learnopengl's texture units 0, 1 and 2: irradianceMap, prefilterMap, brdfLUT) and the material's five maps
    // (bindings 4..8 - texture units 3..7: albedoMap, normalMap, metallicMap, roughnessMap, aoMap).
    void createDescriptorSet() {
        VkDescriptorSetAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
        allocInfo.descriptorPool = descriptorPool;
        allocInfo.descriptorSetCount = 1;
        allocInfo.pSetLayouts = &descriptorSetLayout;

        if (vkAllocateDescriptorSets(device, &allocInfo, &descriptorSet) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate descriptor sets!");
        }

        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);

        // the images in the order of their bindings (1..8) and the sampler of each: clamp to edge for the IBL data, repeat
        // for the material's maps
        std::array<VkImageView, 8> imageViews = {irradianceImageView, prefilterImageView, brdfLUTImageView, albedoImageView, normalImageView, metallicImageView, roughnessImageView, aoImageView};
        std::array<VkSampler, 8> samplers = {clampSampler, clampSampler, clampSampler, textureSampler, textureSampler, textureSampler, textureSampler, textureSampler};
        std::array<VkDescriptorImageInfo, 8> imageInfos{};

        std::array<VkWriteDescriptorSet, 9> descriptorWrites{};

        descriptorWrites[0].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[0].dstSet = descriptorSet;
        descriptorWrites[0].dstBinding = 0;
        descriptorWrites[0].dstArrayElement = 0;
        descriptorWrites[0].descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        descriptorWrites[0].descriptorCount = 1;
        descriptorWrites[0].pBufferInfo = &bufferInfo;

        for (uint32_t i = 0; i < imageViews.size(); i++) {
            imageInfos[i].imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            imageInfos[i].imageView = imageViews[i];
            imageInfos[i].sampler = samplers[i];

            descriptorWrites[i + 1].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
            descriptorWrites[i + 1].dstSet = descriptorSet;
            descriptorWrites[i + 1].dstBinding = i + 1;
            descriptorWrites[i + 1].dstArrayElement = 0;
            descriptorWrites[i + 1].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
            descriptorWrites[i + 1].descriptorCount = 1;
            descriptorWrites[i + 1].pImageInfo = &imageInfos[i];
        }

        vkUpdateDescriptorSets(device, static_cast<uint32_t>(descriptorWrites.size()), descriptorWrites.data(), 0, nullptr);
    }

    // A descriptor set with the uniform buffer (binding 0) and one image (binding 1): the HDR image or a cube map.
    // Binding it before a draw (vkCmdBindDescriptorSets) is Vulkan's glBindTexture.
    void createTextureDescriptorSet(VkImageView imageView, VkSampler sampler, VkDescriptorSet& descriptorSet) {
        VkDescriptorSetAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
        allocInfo.descriptorPool = descriptorPool;
        allocInfo.descriptorSetCount = 1;
        allocInfo.pSetLayouts = &descriptorSetLayout;

        if (vkAllocateDescriptorSets(device, &allocInfo, &descriptorSet) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate descriptor sets!");
        }

        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);

        VkDescriptorImageInfo imageInfo{};
        imageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        imageInfo.imageView = imageView;
        imageInfo.sampler = sampler;

        std::array<VkWriteDescriptorSet, 2> descriptorWrites{};

        descriptorWrites[0].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[0].dstSet = descriptorSet;
        descriptorWrites[0].dstBinding = 0;
        descriptorWrites[0].dstArrayElement = 0;
        descriptorWrites[0].descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        descriptorWrites[0].descriptorCount = 1;
        descriptorWrites[0].pBufferInfo = &bufferInfo;

        descriptorWrites[1].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[1].dstSet = descriptorSet;
        descriptorWrites[1].dstBinding = 1;
        descriptorWrites[1].dstArrayElement = 0;
        descriptorWrites[1].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        descriptorWrites[1].descriptorCount = 1;
        descriptorWrites[1].pImageInfo = &imageInfo;

        vkUpdateDescriptorSets(device, static_cast<uint32_t>(descriptorWrites.size()), descriptorWrites.data(), 0, nullptr);
    }

    void createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& bufferMemory) {
        VkBufferCreateInfo bufferInfo{};
        bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
        bufferInfo.size = size;
        bufferInfo.usage = usage;
        bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateBuffer(device, &bufferInfo, nullptr, &buffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create buffer!");
        }

        VkMemoryRequirements memRequirements;
        vkGetBufferMemoryRequirements(device, buffer, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &bufferMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate buffer memory!");
        }

        vkBindBufferMemory(device, buffer, bufferMemory, 0);
    }

    VkCommandBuffer beginSingleTimeCommands() {
        VkCommandBufferAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
        allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
        allocInfo.commandPool = commandPool;
        allocInfo.commandBufferCount = 1;

        VkCommandBuffer commandBuffer;
        vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

        VkCommandBufferBeginInfo beginInfo{};
        beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
        beginInfo.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;

        vkBeginCommandBuffer(commandBuffer, &beginInfo);

        return commandBuffer;
    }

    void endSingleTimeCommands(VkCommandBuffer commandBuffer) {
        vkEndCommandBuffer(commandBuffer);

        VkSubmitInfo submitInfo{};
        submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
        submitInfo.commandBufferCount = 1;
        submitInfo.pCommandBuffers = &commandBuffer;

        vkQueueSubmit(graphicsQueue, 1, &submitInfo, VK_NULL_HANDLE);
        vkQueueWaitIdle(graphicsQueue);

        vkFreeCommandBuffers(device, commandPool, 1, &commandBuffer);
    }

    uint32_t findMemoryType(uint32_t typeFilter, VkMemoryPropertyFlags properties) {
        VkPhysicalDeviceMemoryProperties memProperties;
        vkGetPhysicalDeviceMemoryProperties(physicalDevice, &memProperties);

        for (uint32_t i = 0; i < memProperties.memoryTypeCount; i++) {
            if ((typeFilter & (1 << i)) && (memProperties.memoryTypes[i].propertyFlags & properties) == properties) {
                return i;
            }
        }

        throw std::runtime_error("failed to find suitable memory type!");
    }

    void createCommandBuffer() {
        VkCommandBufferAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
        allocInfo.commandPool = commandPool;
        allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
        allocInfo.commandBufferCount = 1;

        if (vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate command buffers!");
        }
    }

    void recordCommandBuffer(VkCommandBuffer commandBuffer, uint32_t imageIndex) {
        VkCommandBufferBeginInfo beginInfo{};
        beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;

        if (vkBeginCommandBuffer(commandBuffer, &beginInfo) != VK_SUCCESS) {
            throw std::runtime_error("failed to begin recording command buffer!");
        }

        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = renderPass;
        renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = swapChainExtent;

        // one clear value per attachment: the colour, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 2> clearValues{};
        clearValues[0].color = {{0.1f, 0.1f, 0.1f, 1.0f}};
        clearValues[1].depthStencil = {1.0f, 0};

        renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
        renderPassInfo.pClearValues = clearValues.data();

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        VkViewport viewport{};
        viewport.x = 0.0f;
        viewport.y = 0.0f;
        viewport.width = static_cast<float>(swapChainExtent.width);
        viewport.height = static_cast<float>(swapChainExtent.height);
        viewport.minDepth = 0.0f;
        viewport.maxDepth = 1.0f;
        vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

        VkRect2D scissor{};
        scissor.offset = {0, 0};
        scissor.extent = swapChainExtent;
        vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

        // render scene, supplying the convoluted irradiance map to the final shader.
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pbrPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

        // render rows*column number of spheres with material properties defined by textures (they all have the same material properties)
        PushConstants constants{};
        glm::mat4 model = glm::mat4(1.0f);
        for (int row = 0; row < nrRows; ++row) {
            for (int col = 0; col < nrColumns; ++col) {
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(
                    (float)(col - (nrColumns / 2)) * spacing,
                    (float)(row - (nrRows / 2)) * spacing,
                    0.0f
                ));
                model = glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f)); // turn the middle of the textures towards the camera
                model = glm::scale(model, glm::vec3(2.4f));
                constants.model = model;
                vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
                renderSphere(commandBuffer);
            }
        }

        // render skybox (render as last to prevent overdraw)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, backgroundPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &envDescriptorSet, 0, nullptr);
        //vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &irradianceDescriptorSet, 0, nullptr); // display irradiance map
        //vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &prefilterDescriptorSet, 0, nullptr); // display prefilter map
        renderCube(commandBuffer);

        vkCmdEndRenderPass(commandBuffer);

        if (vkEndCommandBuffer(commandBuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to record command buffer!");
        }
    }

    // learnopengl's renderSphere(), the part that draws: the sphere's vertex and index buffer, and one indexed draw of
    // the whole triangle strip (learnopengl: glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)).
    void renderSphere(VkCommandBuffer commandBuffer) {
        VkBuffer vertexBuffers[] = {sphereVertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
        vkCmdBindIndexBuffer(commandBuffer, sphereIndexBuffer, 0, VK_INDEX_TYPE_UINT32);
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(sphereIndices.size()), 1, 0, 0, 0);
    }

    // learnopengl's renderCube(): the vertex buffer and a draw of the cube's 36 vertices.
    void renderCube(VkCommandBuffer commandBuffer) {
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
    }

    // learnopengl's renderQuad(): the screen quad's 6 vertices, after the cube's 36 in the same vertex buffer.
    void renderQuad(VkCommandBuffer commandBuffer) {
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0);
    }

    // learnopengl's capture loop: the cube drawn six times with one of the capture pipelines, each time into another
    // face of a cube map - into its mip level mipLevel, size x size pixels -, seen from the centre of the cube towards
    // that face. descriptorSet holds the image the pipeline's fragment shader reads, roughness is for prefilter.frag.
    // Recorded into a one-time command buffer and run at once.
    void renderToCubemap(VkPipeline pipeline, VkDescriptorSet descriptorSet, VkImage cubemapImage, uint32_t mipLevel, uint32_t size, float roughness) {
        // pbr: set up projection and view matrices for capturing data onto the 6 cubemap face directions (no y flip: see
        // the note on the cube map faces)
        glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
        glm::mat4 captureViews[] = {
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
        };

        // a view of each face alone (one layer and one mip level as a 2D image) and a framebuffer with it as the colour
        // attachment - learnopengl: glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
        // GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, prefilterMap, mip)
        std::array<VkImageView, 6> faceViews{};
        std::array<VkFramebuffer, 6> framebuffers{};
        for (uint32_t i = 0; i < 6; ++i) {
            VkImageViewCreateInfo viewInfo{};
            viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
            viewInfo.image = cubemapImage;
            viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
            viewInfo.format = VK_FORMAT_R16G16B16A16_SFLOAT;
            viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            viewInfo.subresourceRange.baseMipLevel = mipLevel;
            viewInfo.subresourceRange.levelCount = 1;
            viewInfo.subresourceRange.baseArrayLayer = i; // face i
            viewInfo.subresourceRange.layerCount = 1;

            if (vkCreateImageView(device, &viewInfo, nullptr, &faceViews[i]) != VK_SUCCESS) {
                throw std::runtime_error("failed to create cube map face view!");
            }

            VkFramebufferCreateInfo framebufferInfo{};
            framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
            framebufferInfo.renderPass = captureRenderPass;
            framebufferInfo.attachmentCount = 1;
            framebufferInfo.pAttachments = &faceViews[i];
            framebufferInfo.width = size;
            framebufferInfo.height = size;
            framebufferInfo.layers = 1;

            if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &framebuffers[i]) != VK_SUCCESS) {
                throw std::runtime_error("failed to create capture framebuffer!");
            }
        }

        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        // don't forget to configure the viewport to the capture dimensions.
        VkViewport viewport{};
        viewport.x = 0.0f;
        viewport.y = 0.0f;
        viewport.width = static_cast<float>(size);
        viewport.height = static_cast<float>(size);
        viewport.minDepth = 0.0f;
        viewport.maxDepth = 1.0f;
        vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

        VkRect2D scissor{};
        scissor.offset = {0, 0};
        scissor.extent = {size, size};
        vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

        for (uint32_t i = 0; i < 6; ++i) {
            VkRenderPassBeginInfo renderPassInfo{};
            renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
            renderPassInfo.renderPass = captureRenderPass;
            renderPassInfo.framebuffer = framebuffers[i];
            renderPassInfo.renderArea.offset = {0, 0};
            renderPassInfo.renderArea.extent = {size, size};
            renderPassInfo.clearValueCount = 0; // loadOp DONT_CARE: nothing to clear

            vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

            vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipeline);
            vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

            CapturePushConstants constants{};
            constants.projectionView = captureProjection * captureViews[i];
            constants.roughness = roughness;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(CapturePushConstants), &constants);

            renderCube(commandBuffer);

            vkCmdEndRenderPass(commandBuffer); // face i is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
        }

        endSingleTimeCommands(commandBuffer); // submits the command buffer and waits until it has run

        // the faces' views and framebuffers were only needed for these passes
        for (uint32_t i = 0; i < 6; ++i) {
            vkDestroyFramebuffer(device, framebuffers[i], nullptr);
            vkDestroyImageView(device, faceViews[i], nullptr);
        }
    }

    // pbr: generate a 2D LUT from the BRDF equations used: the screen quad drawn with brdfPipeline into the lookup
    // texture - once, in a one-time command buffer (learnopengl: the capture framebuffer with brdfLUTTexture attached,
    // brdfShader, renderQuad()).
    void renderBrdfLUT() {
        VkFramebuffer framebuffer;
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = brdfRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &brdfLUTImageView;
        framebufferInfo.width = 128;
        framebufferInfo.height = 128;
        framebufferInfo.layers = 1;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &framebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create BRDF framebuffer!");
        }

        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkViewport viewport{};
        viewport.x = 0.0f;
        viewport.y = 0.0f;
        viewport.width = 128.0f;
        viewport.height = 128.0f;
        viewport.minDepth = 0.0f;
        viewport.maxDepth = 1.0f;
        vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

        VkRect2D scissor{};
        scissor.offset = {0, 0};
        scissor.extent = {128, 128};
        vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = brdfRenderPass;
        renderPassInfo.framebuffer = framebuffer;
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = {128, 128};
        renderPassInfo.clearValueCount = 0; // loadOp DONT_CARE: the quad covers every pixel

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // brdf.vert and brdf.frag read no uniform buffer, no image and no push constants: nothing else to bind
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, brdfPipeline);
        renderQuad(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the lookup texture is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL

        endSingleTimeCommands(commandBuffer);

        vkDestroyFramebuffer(device, framebuffer, nullptr);
    }

    void createSyncObjects() {
        // One "render finished" semaphore per swap chain image: the presentation engine may still
        // be waiting on it after the fence of the frame has signaled.
        renderFinishedSemaphores.resize(swapChainImages.size());

        VkSemaphoreCreateInfo semaphoreInfo{};
        semaphoreInfo.sType = VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;

        VkFenceCreateInfo fenceInfo{};
        fenceInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
        fenceInfo.flags = VK_FENCE_CREATE_SIGNALED_BIT;

        if (vkCreateSemaphore(device, &semaphoreInfo, nullptr, &imageAvailableSemaphore) != VK_SUCCESS ||
            vkCreateFence(device, &fenceInfo, nullptr, &inFlightFence) != VK_SUCCESS) {
            throw std::runtime_error("failed to create synchronization objects for a frame!");
        }

        for (size_t i = 0; i < renderFinishedSemaphores.size(); i++) {
            if (vkCreateSemaphore(device, &semaphoreInfo, nullptr, &renderFinishedSemaphores[i]) != VK_SUCCESS) {
                throw std::runtime_error("failed to create synchronization objects for a frame!");
            }
        }
    }

    void updateUniformBuffer() {
        UniformBufferObject ubo{};
        // camera/view transformation: look from cameraPos in the direction of cameraFront
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        ubo.proj = glm::perspective(glm::radians(fov), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan (this replaces the flip in the shader)
        ubo.proj[1][1] *= -1;
        // the lights
        for (unsigned int i = 0; i < lightPositions.size(); ++i) {
            ubo.lightPositions[i] = glm::vec4(lightPositions[i], 1.0f);
            ubo.lightColors[i] = glm::vec4(lightColors[i], 1.0f);
        }
        ubo.camPos = cameraPos;

        memcpy(uniformBufferMapped, &ubo, sizeof(ubo));
    }

    void drawFrame() {
        vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
        vkResetFences(device, 1, &inFlightFence);

        uint32_t imageIndex;
        vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);

        updateUniformBuffer();

        vkResetCommandBuffer(commandBuffer, /*VkCommandBufferResetFlagBits*/ 0);
        recordCommandBuffer(commandBuffer, imageIndex);

        VkSubmitInfo submitInfo{};
        submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;

        VkSemaphore waitSemaphores[] = {imageAvailableSemaphore};
        VkPipelineStageFlags waitStages[] = {VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT};
        submitInfo.waitSemaphoreCount = 1;
        submitInfo.pWaitSemaphores = waitSemaphores;
        submitInfo.pWaitDstStageMask = waitStages;

        submitInfo.commandBufferCount = 1;
        submitInfo.pCommandBuffers = &commandBuffer;

        VkSemaphore signalSemaphores[] = {renderFinishedSemaphores[imageIndex]};
        submitInfo.signalSemaphoreCount = 1;
        submitInfo.pSignalSemaphores = signalSemaphores;

        if (vkQueueSubmit(graphicsQueue, 1, &submitInfo, inFlightFence) != VK_SUCCESS) {
            throw std::runtime_error("failed to submit draw command buffer!");
        }

        VkPresentInfoKHR presentInfo{};
        presentInfo.sType = VK_STRUCTURE_TYPE_PRESENT_INFO_KHR;

        presentInfo.waitSemaphoreCount = 1;
        presentInfo.pWaitSemaphores = signalSemaphores;

        VkSwapchainKHR swapChains[] = {swapChain};
        presentInfo.swapchainCount = 1;
        presentInfo.pSwapchains = swapChains;

        presentInfo.pImageIndices = &imageIndex;

        vkQueuePresentKHR(presentQueue, &presentInfo);
    }

    VkShaderModule createShaderModule(const std::vector<char>& code) {
        VkShaderModuleCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
        createInfo.codeSize = code.size();
        createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

        VkShaderModule shaderModule;
        if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
            throw std::runtime_error("failed to create shader module!");
        }

        return shaderModule;
    }

    VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& availableFormats) {
        // A UNORM format shows the colours we write unchanged (like OpenGL's default framebuffer).
        for (const auto& availableFormat : availableFormats) {
            if (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
                return availableFormat;
            }
        }

        return availableFormats[0];
    }

    VkPresentModeKHR chooseSwapPresentMode(const std::vector<VkPresentModeKHR>& availablePresentModes) {
        for (const auto& availablePresentMode : availablePresentModes) {
            if (availablePresentMode == VK_PRESENT_MODE_MAILBOX_KHR) {
                return availablePresentMode;
            }
        }

        return VK_PRESENT_MODE_FIFO_KHR;
    }

    VkExtent2D chooseSwapExtent(const VkSurfaceCapabilitiesKHR& capabilities) {
        if (capabilities.currentExtent.width != std::numeric_limits<uint32_t>::max()) {
            return capabilities.currentExtent;
        } else {
            int width, height;
            glfwGetFramebufferSize(window, &width, &height);

            VkExtent2D actualExtent = {
                static_cast<uint32_t>(width),
                static_cast<uint32_t>(height)
            };

            actualExtent.width = std::clamp(actualExtent.width, capabilities.minImageExtent.width, capabilities.maxImageExtent.width);
            actualExtent.height = std::clamp(actualExtent.height, capabilities.minImageExtent.height, capabilities.maxImageExtent.height);

            return actualExtent;
        }
    }

    SwapChainSupportDetails querySwapChainSupport(VkPhysicalDevice device) {
        SwapChainSupportDetails details;

        vkGetPhysicalDeviceSurfaceCapabilitiesKHR(device, surface, &details.capabilities);

        uint32_t formatCount;
        vkGetPhysicalDeviceSurfaceFormatsKHR(device, surface, &formatCount, nullptr);

        if (formatCount != 0) {
            details.formats.resize(formatCount);
            vkGetPhysicalDeviceSurfaceFormatsKHR(device, surface, &formatCount, details.formats.data());
        }

        uint32_t presentModeCount;
        vkGetPhysicalDeviceSurfacePresentModesKHR(device, surface, &presentModeCount, nullptr);

        if (presentModeCount != 0) {
            details.presentModes.resize(presentModeCount);
            vkGetPhysicalDeviceSurfacePresentModesKHR(device, surface, &presentModeCount, details.presentModes.data());
        }

        return details;
    }

    bool isDeviceSuitable(VkPhysicalDevice device) {
        QueueFamilyIndices indices = findQueueFamilies(device);

        bool extensionsSupported = checkDeviceExtensionSupport(device);

        bool swapChainAdequate = false;
        if (extensionsSupported) {
            SwapChainSupportDetails swapChainSupport = querySwapChainSupport(device);
            swapChainAdequate = !swapChainSupport.formats.empty() && !swapChainSupport.presentModes.empty();
        }

        VkPhysicalDeviceFeatures supportedFeatures;
        vkGetPhysicalDeviceFeatures(device, &supportedFeatures);

        return indices.isComplete() && extensionsSupported && swapChainAdequate && supportedFeatures.samplerAnisotropy;
    }

    bool checkDeviceExtensionSupport(VkPhysicalDevice device) {
        uint32_t extensionCount;
        vkEnumerateDeviceExtensionProperties(device, nullptr, &extensionCount, nullptr);

        std::vector<VkExtensionProperties> availableExtensions(extensionCount);
        vkEnumerateDeviceExtensionProperties(device, nullptr, &extensionCount, availableExtensions.data());

        std::set<std::string> requiredExtensions(deviceExtensions.begin(), deviceExtensions.end());

        for (const auto& extension : availableExtensions) {
            requiredExtensions.erase(extension.extensionName);
        }

        return requiredExtensions.empty();
    }

    QueueFamilyIndices findQueueFamilies(VkPhysicalDevice device) {
        QueueFamilyIndices indices;

        uint32_t queueFamilyCount = 0;
        vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, nullptr);

        std::vector<VkQueueFamilyProperties> queueFamilies(queueFamilyCount);
        vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, queueFamilies.data());

        int i = 0;
        for (const auto& queueFamily : queueFamilies) {
            if (queueFamily.queueFlags & VK_QUEUE_GRAPHICS_BIT) {
                indices.graphicsFamily = i;
            }

            VkBool32 presentSupport = false;
            vkGetPhysicalDeviceSurfaceSupportKHR(device, i, surface, &presentSupport);

            if (presentSupport) {
                indices.presentFamily = i;
            }

            if (indices.isComplete()) {
                break;
            }

            i++;
        }

        return indices;
    }

    std::vector<const char*> getRequiredExtensions() {
        uint32_t glfwExtensionCount = 0;
        const char** glfwExtensions;
        glfwExtensions = glfwGetRequiredInstanceExtensions(&glfwExtensionCount);

        std::vector<const char*> extensions(glfwExtensions, glfwExtensions + glfwExtensionCount);

        if (enableValidationLayers) {
            extensions.push_back(VK_EXT_DEBUG_UTILS_EXTENSION_NAME);
        }

        return extensions;
    }

    bool checkValidationLayerSupport() {
        uint32_t layerCount;
        vkEnumerateInstanceLayerProperties(&layerCount, nullptr);

        std::vector<VkLayerProperties> availableLayers(layerCount);
        vkEnumerateInstanceLayerProperties(&layerCount, availableLayers.data());

        for (const char* layerName : validationLayers) {
            bool layerFound = false;

            for (const auto& layerProperties : availableLayers) {
                if (strcmp(layerName, layerProperties.layerName) == 0) {
                    layerFound = true;
                    break;
                }
            }

            if (!layerFound) {
                return false;
            }
        }

        return true;
    }

    static std::vector<char> readFile(const std::string& filename) {
        std::ifstream file(filename, std::ios::ate | std::ios::binary);

        if (!file.is_open()) {
            throw std::runtime_error("failed to open file!");
        }

        size_t fileSize = (size_t) file.tellg();
        std::vector<char> buffer(fileSize);

        file.seekg(0);
        file.read(buffer.data(), fileSize);

        file.close();

        return buffer;
    }

    static VKAPI_ATTR VkBool32 VKAPI_CALL debugCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData) {
        std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;

        return VK_FALSE;
    }
};

int main() {
    HelloTriangleApplication app;

    try {
        app.run();
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
