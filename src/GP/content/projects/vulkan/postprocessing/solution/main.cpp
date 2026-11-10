#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>

// Vulkan's depth range is 0..1 (OpenGL's is -1..1): make glm's projections use it.
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
#include <map>
#include <string>
#include <sstream>
#include <tuple>

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

// One vertex of the sprite quad: learnopengl's vec4 <vec2 position, vec2 texCoords>.
struct Vertex {
    glm::vec4 vertex;

    static VkVertexInputBindingDescription getBindingDescription() {
        VkVertexInputBindingDescription bindingDescription{};
        bindingDescription.binding = 0;
        bindingDescription.stride = sizeof(Vertex);
        bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 1> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 1> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32A32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, vertex);

        return attributeDescriptions;
    }
};

// The same layout as the push constant block in the sprite shaders: what changes from sprite to sprite.
struct PushConstants {
    glm::mat4 model;
    glm::vec3 spriteColor;
};

// The same layout as the push constant block in the particle shaders: one particle's position and colour. In a push
// constant block a vec4 starts at a multiple of 16 bytes, so `color` is aligned to 16 (after 8 bytes of offset).
struct ParticleConstants {
    glm::vec2 offset;
    alignas(16) glm::vec4 color;
};

// The same layout as the push constant block in the postprocessing shaders: what changes every frame (learnopengl's
// uniforms time, chaos, confuse and shake; a bool in a shader block takes 4 bytes, so the flags are ints).
struct PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
};

// The same layout as the uniform block in the postprocessing fragment shader: learnopengl's offsets and kernels, set
// once. In a uniform block (std140) every element of an array starts at a multiple of 16 bytes, so each element is a
// vec4 / ivec4 of which only .xy (offsets) or .x (the kernels) is used.
struct PostProcessingUniforms {
    glm::vec4  offsets[9];
    glm::ivec4 edge_kernel[9];
    glm::vec4  blur_kernel[9];
};

// The same layout as the uniform block in the vertex shader: the orthographic projection.
struct UniformBufferObject {
    glm::mat4 projection;
};

// The game (learnopengl's Game, ResourceManager, Texture2D, SpriteRenderer, GameObject and GameLevel classes) as plain
// structs and free functions; what needs the Vulkan device (loading shaders and textures, the quad's buffer) is part
// of the application class below.

// Texture2D (learnopengl: texture.h): a texture is an image, its memory, a view and the descriptor set that binds it
// (with the uniform buffer) for a draw
// -------------------------------------------------------------------------------------------------------------------
struct Texture2D {
    VkImage         Image = VK_NULL_HANDLE;
    VkDeviceMemory  Memory = VK_NULL_HANDLE;
    VkImageView     View = VK_NULL_HANDLE;
    VkDescriptorSet DescriptorSet = VK_NULL_HANDLE;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
};

// ResourceManager (learnopengl: resource_manager.h): every shader (here: the graphics pipeline made from it) and
// texture by name
// ---------------------------------------------------------------------------------------------------------------
std::map<std::string, VkPipeline> Shaders;
std::map<std::string, Texture2D>  Textures;

// retrieves a stored shader (its pipeline)
VkPipeline& GetShader(std::string name) {
    return Shaders[name];
}

// retrieves a stored texture
Texture2D& GetTexture(std::string name) {
    return Textures[name];
}

// SpriteRenderer (learnopengl: sprite_renderer.h): renders textured quads (sprites) with one pipeline
// --------------------------------------------------------------------------------------------------
struct SpriteRenderer {
    // render state
    VkPipeline       pipeline = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};

// renders a defined quad textured with given sprite (the texture's descriptor set)
void DrawSprite(SpriteRenderer& renderer, VkDescriptorSet texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f)) {
    vkCmdBindPipeline(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipeline);

    // prepare transformations
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    PushConstants constants{};
    constants.model = model;

    // render textured quad
    constants.spriteColor = color;
    vkCmdPushConstants(renderer.commandBuffer, renderer.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);

    vkCmdBindDescriptorSets(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipelineLayout, 0, 1, &texture, 0, nullptr);

    VkBuffer vertexBuffers[] = {renderer.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(renderer.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(renderer.commandBuffer, 6, 1, 0, 0);
}

// GameObject (learnopengl: game_object.h)
// ---------------------------------------
// Container object for holding all state relevant for a single
// game object entity. Each object in the game likely needs the
// minimal of state as described within GameObject.
struct GameObject {
    // object state
    glm::vec2       Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3       Color = glm::vec3(1.0f);
    float           Rotation = 0.0f;
    bool            IsSolid = false;
    bool            Destroyed = false;
    // render state
    VkDescriptorSet Sprite = VK_NULL_HANDLE; // the texture's descriptor set
};

// creates a game object (learnopengl's GameObject constructor)
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, VkDescriptorSet sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f)) {
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer) {
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}

// GameLevel (learnopengl: game_level.h)
// -------------------------------------
/// GameLevel holds all Tiles as part of a level and
/// hosts functionality to Load/render levels from the harddisk.
struct GameLevel {
    // level state
    std::vector<GameObject> Bricks;
};

// initialize level from tile data
void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight) {
    // calculate dimensions
    unsigned int height = tileData.size();
    unsigned int width = tileData[0].size(); // note we can index vector at [0] since this function is only called if height > 0
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
    // initialize level tiles based on tileData
    for (unsigned int y = 0; y < height; ++y) {
        for (unsigned int x = 0; x < width; ++x) {
            // check block type from level data (2D level array)
            if (tileData[y][x] == 1) { // solid
                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").DescriptorSet, glm::vec3(0.8f, 0.8f, 0.7f));
                obj.IsSolid = true;
                level.Bricks.push_back(obj);
            } else if (tileData[y][x] > 1) { // non-solid; now determine its color based on level data
                glm::vec3 color = glm::vec3(1.0f); // original: white
                if (tileData[y][x] == 2)
                    color = glm::vec3(0.2f, 0.6f, 1.0f);
                else if (tileData[y][x] == 3)
                    color = glm::vec3(0.0f, 0.7f, 0.0f);
                else if (tileData[y][x] == 4)
                    color = glm::vec3(0.8f, 0.8f, 0.4f);
                else if (tileData[y][x] == 5)
                    color = glm::vec3(1.0f, 0.5f, 0.0f);

                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").DescriptorSet, color));
            }
        }
    }
}

// loads level from file
void LoadLevel(GameLevel& level, const char* file, unsigned int levelWidth, unsigned int levelHeight) {
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream) {
        while (std::getline(fstream, line)) { // read each line from level file
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}

// render level
void DrawLevel(GameLevel& level, SpriteRenderer& renderer) {
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}

// BallObject (learnopengl: ball_object.h)
// ---------------------------------------
// BallObject holds the state of the Ball object inheriting
// relevant state data from GameObject. Contains some extra
// functionality specific to the game's ball object that
// were too specific for within GameObject alone.
struct BallObject : GameObject {
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

// creates a ball (learnopengl's BallObject constructor): a GameObject of size 2 * radius
BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, VkDescriptorSet sprite) {
    BallObject ball;
    ball.Position = pos;
    ball.Size = glm::vec2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}

// moves the ball, keeping it constrained within the window bounds (except bottom edge)
void Move(BallObject& ball, float dt, unsigned int window_width) {
    // if not stuck to player board
    if (!ball.Stuck) {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        } else if (ball.Position.x + ball.Size.x >= window_width) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f) {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}

// resets the ball to initial Stuck Position (if ball is outside window bounds)
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity) {
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}

// ParticleGenerator (learnopengl: particle_generator.h)
// -----------------------------------------------------
// Represents a single particle and its state
struct Particle {
    glm::vec2 Position = glm::vec2(0.0f), Velocity = glm::vec2(0.0f);
    glm::vec4 Color = glm::vec4(1.0f);
    float     Life = 0.0f;
};

// ParticleGenerator acts as a container for rendering a large number of
// particles by repeatedly spawning and updating particles and killing
// them after a given amount of time.
struct ParticleGenerator {
    // state
    std::vector<Particle> particles;
    unsigned int          amount = 0;
    // render state
    VkPipeline       shader = VK_NULL_HANDLE;  // the particle pipeline (additive blending)
    VkDescriptorSet  texture = VK_NULL_HANDLE; // the particle texture's descriptor set
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE; // learnopengl's VAO: the particle quad
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};

// stores the index of the last particle used (for quick access to next dead particle)
unsigned int lastUsedParticle = 0;
// returns the first Particle index that's currently unused e.g. Life <= 0.0f or 0 if no particle is currently inactive
unsigned int firstUnusedParticle(ParticleGenerator& generator) {
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i) {
        if (generator.particles[i].Life <= 0.0f) {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i) {
        if (generator.particles[i].Life <= 0.0f) {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}

// respawns particle
void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = glm::vec2(0.0f, 0.0f)) {
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    particle.Position = object.Position + random + offset;
    particle.Color = glm::vec4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    particle.Velocity = object.Velocity * 0.1f;
}

// update all particles
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset = glm::vec2(0.0f, 0.0f)) {
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i) {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i) {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f) { // particle is alive, thus update
            p.Position -= p.Velocity * dt;
            p.Color.a -= dt * 2.5f;
        }
    }
}

// render all particles
void DrawParticles(ParticleGenerator& generator) {
    // use additive blending to give it a 'glow' effect: the particle pipeline adds (VK_BLEND_FACTOR_ONE)
    vkCmdBindPipeline(generator.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, generator.shader);
    for (Particle particle : generator.particles) {
        if (particle.Life > 0.0f) {
            ParticleConstants constants{};
            constants.offset = particle.Position;
            constants.color = particle.Color;
            vkCmdPushConstants(generator.commandBuffer, generator.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(ParticleConstants), &constants);
            vkCmdBindDescriptorSets(generator.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, generator.pipelineLayout, 0, 1, &generator.texture, 0, nullptr);
            VkBuffer vertexBuffers[] = {generator.quadBuffer};
            VkDeviceSize offsets[] = {0};
            vkCmdBindVertexBuffers(generator.commandBuffer, 0, 1, vertexBuffers, offsets);
            vkCmdDraw(generator.commandBuffer, 6, 1, 0, 0);
        }
    }
    // (no reset of the blending needed: every sprite draw binds the sprite pipeline again)
}

// PostProcessor (learnopengl: post_processor.h)
// ----------------------------------------------
// PostProcessor hosts all PostProcessing effects for the Hedgerow
// Game. It renders the game on a textured quad after which one can
// enable specific effects by enabling either the Confuse, Chaos or
// Shake boolean.
// It is required to call BeginRender() before rendering the game
// and EndRender() after rendering the game for the struct to work.
struct PostProcessor {
    // state
    VkPipeline       PostProcessingShader = VK_NULL_HANDLE; // the postprocessing pipeline
    Texture2D        Texture;   // the picture of the game the quad shows: the multisampled image resolved into it
    unsigned int     Width = 0, Height = 0;
    // options
    bool             Confuse = false, Chaos = false, Shake = false;
    // render state (learnopengl: the multisampled framebuffer MSFBO with its renderbuffer RBO, blitted into the
    // framebuffer FBO with the texture; Vulkan: one render pass whose multisampled colour attachment is resolved into
    // Texture at the end of the pass, and one framebuffer with both images)
    VkRenderPass     RenderPass = VK_NULL_HANDLE;
    VkFramebuffer    Framebuffer = VK_NULL_HANDLE;
    VkImage          MSImage = VK_NULL_HANDLE;       // the multisampled colour image (learnopengl's RBO)
    VkDeviceMemory   MSImageMemory = VK_NULL_HANDLE;
    VkImageView      MSImageView = VK_NULL_HANDLE;
    VkBuffer         UniformBuffer = VK_NULL_HANDLE; // the offsets and kernels (PostProcessingUniforms)
    VkDeviceMemory   UniformBufferMemory = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;    // learnopengl's VAO: the quad over the whole window
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE;     // the command buffer being recorded this frame
    VkRenderPass     WindowRenderPass = VK_NULL_HANDLE;  // learnopengl's default framebuffer: the window's render
    VkFramebuffer    WindowFramebuffer = VK_NULL_HANDLE; // pass and this frame's swap chain framebuffer
};

// prepares the postprocessor's framebuffer operations before rendering the game: the off-screen render pass begins
// (cleared to black)
void BeginRender(PostProcessor& effects) {
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.RenderPass;
    renderPassInfo.framebuffer = effects.Framebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

// should be called after rendering the game, so it stores all the rendered data into a texture object
void EndRender(PostProcessor& effects) {
    // the end of the off-screen pass resolves the multisampled image into Texture (learnopengl's glBlitFramebuffer)
    vkCmdEndRenderPass(effects.commandBuffer);
    // then the window's render pass begins (learnopengl binds the default framebuffer again)
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.WindowRenderPass;
    renderPassInfo.framebuffer = effects.WindowFramebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

// renders the PostProcessor texture quad (as a screen-encompassing large sprite)
void Render(PostProcessor& effects, float time) {
    vkCmdBindPipeline(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.PostProcessingShader);
    // set uniforms/options
    PostProcessingConstants constants{};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    vkCmdPushConstants(effects.commandBuffer, effects.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PostProcessingConstants), &constants);
    // render textured quad
    vkCmdBindDescriptorSets(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.pipelineLayout, 0, 1, &effects.Texture.DescriptorSet, 0, nullptr);
    VkBuffer vertexBuffers[] = {effects.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(effects.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(effects.commandBuffer, 6, 1, 0, 0);
}

// Game (learnopengl: game.h)
// --------------------------
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Represents the four possible (collision) directions
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, glm::vec2> Collision; // <collision?, what direction?, difference vector center - closest point>

// Initial size of the player paddle
const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
// Initial velocity of the Ball
const glm::vec2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game {
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = WIDTH, Height = HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};

// Game-related State data
Game           Hedgerow;
SpriteRenderer Renderer;
GameObject     Player;
BallObject     Ball;
ParticleGenerator Particles;
PostProcessor  Effects;

float ShakeTime = 0.0f;

// Collision detection (learnopengl: game.cpp)
// --------------------------------------------
bool CheckCollision(GameObject& one, GameObject& two) { // AABB - AABB collision
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}

// calculates which direction a vector is facing (N,E,S or W)
Direction VectorDirection(glm::vec2 target) {
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++) {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max) {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}

Collision CheckCollision(BallObject& one, GameObject& two) { // AABB - Circle collision
    // get center point circle first
    glm::vec2 center(one.Position + one.Radius);
    // calculate AABB info (center, half-extents)
    glm::vec2 aabb_half_extents(two.Size.x / 2.0f, two.Size.y / 2.0f);
    glm::vec2 aabb_center(two.Position.x + aabb_half_extents.x, two.Position.y + aabb_half_extents.y);
    // get difference vector between both centers
    glm::vec2 difference = center - aabb_center;
    glm::vec2 clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    glm::vec2 closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;

    if (glm::length(difference) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
        return std::make_tuple(true, VectorDirection(difference), difference);
    else
        return std::make_tuple(false, UP, glm::vec2(0.0f, 0.0f));
}

// destroys every brick the ball collides with (unless it is solid) and bounces the ball off bricks and the paddle
void DoCollisions(Game& game) {
    for (GameObject& box : game.Levels[game.Level].Bricks) {
        if (!box.Destroyed) {
            Collision collision = CheckCollision(Ball, box);
            if (std::get<0>(collision)) { // if collision is true
                // destroy block if not solid
                if (!box.IsSolid)
                    box.Destroyed = true;
                else { // if block is solid, enable shake effect
                    ShakeTime = 0.05f;
                    Effects.Shake = true;
                }
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) { // horizontal collision
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                } else { // vertical collision
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
            }
        }
    }
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result)) {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        glm::vec2 oldVelocity = Ball.Velocity;
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity); // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
}

// reloads the current level (every brick back in place)
void ResetLevel(Game& game) {
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

// puts the paddle back at the bottom centre and the ball back on it (stuck)
void ResetPlayer(Game& game) {
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
}

// game loop (Init, which loads the resources, is part of the application class)
void ProcessInput(Game& game, float dt) {
    if (game.State == GAME_ACTIVE) {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A]) {
            if (Player.Position.x >= 0.0f) {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D]) {
            if (Player.Position.x <= game.Width - Player.Size.x) {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}

void Update(Game& game, float dt) {
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // update particles
    Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));
    // reduce shake time
    if (ShakeTime > 0.0f) {
        ShakeTime -= dt;
        if (ShakeTime <= 0.0f)
            Effects.Shake = false;
    }
    // check loss condition
    if (Ball.Position.y >= game.Height) { // did ball reach bottom edge?
        ResetLevel(game);
        ResetPlayer(game);
    }
}

// records the frame's draws
void Render(Game& game) {
    if (game.State == GAME_ACTIVE) {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, static_cast<float>(glfwGetTime()));
    }
}

// glfw: the keyboard state goes into Hedgerow.Keys
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode) {
    // when a user presses the escape key, we set the WindowShouldClose property to true, closing the application
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
    if (key >= 0 && key < 1024) {
        if (action == GLFW_PRESS)
            Hedgerow.Keys[key] = true;
        else if (action == GLFW_RELEASE)
            Hedgerow.Keys[key] = false;
    }
}

// The descriptor pool has room for this many textures (one descriptor set each).
const uint32_t MAX_TEXTURES = 16;

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

    VkCommandPool commandPool;

    VkSampler textureSampler; // every texture's: learnopengl's Texture2D defaults (REPEAT, LINEAR)

    VkBuffer uniformBuffer;
    VkDeviceMemory uniformBufferMemory;
    void* uniformBufferMapped;

    VkDescriptorPool descriptorPool;

    VkCommandBuffer commandBuffer;

    VkSemaphore imageAvailableSemaphore;
    std::vector<VkSemaphore> renderFinishedSemaphores;
    VkFence inFlightFence;

    void initWindow() {
        glfwInit();

        glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
        glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

        window = glfwCreateWindow(WIDTH, HEIGHT, "Hedgerow", nullptr, nullptr);
        glfwSetKeyCallback(window, key_callback);
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
        createDescriptorSetLayout();
        createPipelineLayout();
        createFramebuffers();
        createCommandPool();
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, textureSampler);
        createUniformBuffers();
        createDescriptorPool();
        // initialize game
        Init(Hedgerow);
        createCommandBuffer();
        createSyncObjects();
    }

    void mainLoop() {
        // deltaTime variables
        float deltaTime = 0.0f;
        float lastFrame = 0.0f;

        while (!glfwWindowShouldClose(window)) {
            // calculate delta time
            float currentFrame = static_cast<float>(glfwGetTime());
            deltaTime = currentFrame - lastFrame;
            lastFrame = currentFrame;
            glfwPollEvents();

            // manage user input
            ProcessInput(Hedgerow, deltaTime);

            // update game state
            Update(Hedgerow, deltaTime);

            // render
            drawFrame();
        }

        vkDeviceWaitIdle(device);
    }

    // initialize game state (load all shaders/textures/levels)
    void Init(Game& game) {
        // load shaders
        LoadShader("shaders/post_processing.vert.spv", "shaders/post_processing.frag.spv", "postprocessing", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT); // the window's pass
        // set up the postprocessor (learnopengl's PostProcessor constructor): before the sprite and particle
        // pipelines, which are made for its off-screen render pass
        InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
        LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT);
        LoadShader("shaders/particle.vert.spv", "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT); // additive blending
        // set render-specific controls
        Renderer.pipeline = GetShader("sprite");
        Renderer.pipelineLayout = pipelineLayout;
        InitRenderData(Renderer);
        // load textures
        LoadTexture("textures/ball.png", "ball");
        LoadTexture("textures/background.png", "background");
        LoadTexture("textures/block.png", "block");
        LoadTexture("textures/block_solid.png", "block_solid");
        LoadTexture("textures/paddle.png", "paddle");
        LoadTexture("textures/particle.png", "particle");
        // set up the particle generator (learnopengl's ParticleGenerator constructor)
        Particles.shader = GetShader("particle");
        Particles.texture = GetTexture("particle").DescriptorSet;
        Particles.amount = 500;
        InitParticles(Particles);
        // load levels
        GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);
        GameLevel two; LoadLevel(two, "levels/two.lvl", game.Width, game.Height / 2);
        GameLevel three; LoadLevel(three, "levels/three.lvl", game.Width, game.Height / 2);
        GameLevel four; LoadLevel(four, "levels/four.lvl", game.Width, game.Height / 2);
        game.Levels.push_back(one);
        game.Levels.push_back(two);
        game.Levels.push_back(three);
        game.Levels.push_back(four);
        game.Level = 0;
        // configure game objects
        glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
        Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").DescriptorSet);
        glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
        Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").DescriptorSet);
    }

    // ResourceManager: loads a shader's two SPIR-V files and makes the graphics pipeline that runs them
    // (learnopengl sets the blend function with glBlendFunc before drawing; in Vulkan it is part of the pipeline: the
    // colour is src.rgb * src.a + dst.rgb * dstColorBlendFactor)
    // A pipeline is also made for one render pass and its number of samples per pixel: the sprites and particles are
    // drawn into the postprocessor's multisampled off-screen pass, the postprocessing quad into the window's.
    VkPipeline LoadShader(const char* vShaderFile, const char* fShaderFile, std::string name, VkBlendFactor dstColorBlendFactor, VkRenderPass pipelineRenderPass, VkSampleCountFlagBits rasterizationSamples) {
        createPipeline(vShaderFile, fShaderFile, dstColorBlendFactor, pipelineRenderPass, rasterizationSamples, Shaders[name]);
        return Shaders[name];
    }

    // ResourceManager: loads (and generates) a texture from file
    Texture2D LoadTexture(const char* file, std::string name) {
        Textures[name] = loadTextureFromFile(file);
        return Textures[name];
    }

    // ResourceManager: properly de-allocates all loaded resources
    void ClearResources() {
        // (properly) delete all shaders
        for (auto iter : Shaders)
            vkDestroyPipeline(device, iter.second, nullptr);
        // (properly) delete all textures (their descriptor sets go with the descriptor pool)
        for (auto iter : Textures) {
            vkDestroyImageView(device, iter.second.View, nullptr);
            vkDestroyImage(device, iter.second.Image, nullptr);
            vkFreeMemory(device, iter.second.Memory, nullptr);
        }
    }

    // SpriteRenderer: initializes and configures the quad's buffer (learnopengl's SpriteRenderer constructor calls it)
    void InitRenderData(SpriteRenderer& renderer) {
        // the quad: (0, 0) is the sprite's top-left corner, (1, 1) its bottom-right, in position and texture coordinates
        const std::vector<Vertex> vertices = {
            // pos      // tex
            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}},
            {{0.0f, 0.0f, 0.0f, 0.0f}},

            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 1.0f, 1.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}}
        };
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, renderer.quadBuffer, renderer.quadBufferMemory);

        void* data;
        vkMapMemory(device, renderer.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, renderer.quadBufferMemory);
    }

    // ParticleGenerator: initializes the particle quad's buffer and amount dead particles (learnopengl's init(), called
    // by its constructor)
    void InitParticles(ParticleGenerator& generator) {
        generator.pipelineLayout = pipelineLayout;
        // set up mesh and attribute properties
        const std::vector<Vertex> particle_quad = {
            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}},
            {{0.0f, 0.0f, 0.0f, 0.0f}},

            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 1.0f, 1.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}}
        };
        VkDeviceSize bufferSize = sizeof(particle_quad[0]) * particle_quad.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, generator.quadBuffer, generator.quadBufferMemory);

        void* data;
        vkMapMemory(device, generator.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, particle_quad.data(), (size_t) bufferSize);
        vkUnmapMemory(device, generator.quadBufferMemory);

        // create amount default particle instances
        for (unsigned int i = 0; i < generator.amount; ++i)
            generator.particles.push_back(Particle());
    }

    // PostProcessor: initialize quad for rendering postprocessing texture (learnopengl's initRenderData)
    void InitRenderData(PostProcessor& effects) {
        // the quad over the whole window: Vulkan's clip space y points down, so (-1, -1) is the top-left corner and
        // gets the texture's top-left texel (0, 0) - the picture shows the right way up, as in OpenGL
        const std::vector<Vertex> vertices = {
            // pos        // tex
            {{-1.0f, -1.0f, 0.0f, 0.0f}},
            {{ 1.0f,  1.0f, 1.0f, 1.0f}},
            {{-1.0f,  1.0f, 0.0f, 1.0f}},

            {{-1.0f, -1.0f, 0.0f, 0.0f}},
            {{ 1.0f, -1.0f, 1.0f, 0.0f}},
            {{ 1.0f,  1.0f, 1.0f, 1.0f}}
        };
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, effects.quadBuffer, effects.quadBufferMemory);

        void* data;
        vkMapMemory(device, effects.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, effects.quadBufferMemory);
    }

    // PostProcessor: the off-screen render pass (vulkan-tutorial's multisampled render pass, without a depth buffer):
    // a colour attachment with 4 samples per pixel, resolved into the texture at the end of the subpass
    void createPostProcessingRenderPass(PostProcessor& effects) {
        // the multisampled colour image: only its resolved pixels are kept
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
        colorAttachment.samples = VK_SAMPLE_COUNT_4_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        // the texture: each pixel's 4 samples are averaged ("resolved") into it, then it is ready to be sampled
        VkAttachmentDescription colorAttachmentResolve{};
        colorAttachmentResolve.format = VK_FORMAT_R8G8B8A8_UNORM;
        colorAttachmentResolve.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachmentResolve.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachmentResolve.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachmentResolve.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;

        VkAttachmentReference colorAttachmentRef{};
        colorAttachmentRef.attachment = 0;
        colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference colorAttachmentResolveRef{};
        colorAttachmentResolveRef.attachment = 1;
        colorAttachmentResolveRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 1;
        subpass.pColorAttachments = &colorAttachmentRef;
        subpass.pResolveAttachments = &colorAttachmentResolveRef;

        std::array<VkSubpassDependency, 2> dependencies{};
        // before the pass: wait until the last frame's postprocessing quad has read the texture
        dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[0].dstSubpass = 0;
        dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[0].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        // after the pass: the postprocessing shaders that sample the texture wait until the resolve has written it
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

        std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, colorAttachmentResolve};
        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        renderPassInfo.pAttachments = attachments.data();
        renderPassInfo.subpassCount = 1;
        renderPassInfo.pSubpasses = &subpass;
        renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());
        renderPassInfo.pDependencies = dependencies.data();

        if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &effects.RenderPass) != VK_SUCCESS) {
            throw std::runtime_error("failed to create postprocessing render pass!");
        }
    }

    // PostProcessor: the images, the off-screen render pass and framebuffer, the quad and the shader's kernels
    // (learnopengl's PostProcessor constructor)
    void InitPostProcessor(PostProcessor& effects, VkPipeline shader, unsigned int width, unsigned int height) {
        effects.PostProcessingShader = shader;
        effects.Width = width;
        effects.Height = height;
        effects.pipelineLayout = pipelineLayout;
        effects.WindowRenderPass = renderPass;
        // the multisampled colour image (learnopengl's renderbuffer with 4 samples; no depth/stencil buffer needed).
        // Every Vulkan device supports 4 samples for colour attachments.
        createImage(width, height, VK_SAMPLE_COUNT_4_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.MSImage, effects.MSImageMemory);
        effects.MSImageView = createImageView(effects.MSImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        // the texture the samples are resolved into and the quad samples (learnopengl's FBO texture)
        createImage(width, height, VK_SAMPLE_COUNT_1_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.Texture.Image, effects.Texture.Memory);
        effects.Texture.View = createImageView(effects.Texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        effects.Texture.Width = width;
        effects.Texture.Height = height;
        // the off-screen render pass and its framebuffer with both images
        createPostProcessingRenderPass(effects);
        std::array<VkImageView, 2> attachments = {effects.MSImageView, effects.Texture.View};
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = effects.RenderPass;
        framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        framebufferInfo.pAttachments = attachments.data();
        framebufferInfo.width = width;
        framebufferInfo.height = height;
        framebufferInfo.layers = 1;
        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &effects.Framebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create postprocessing framebuffer!");
        }
        // initialize render data and uniforms
        InitRenderData(effects);
        float offset = 1.0f / 300.0f;
        float offsets[9][2] = {
            { -offset,  offset  },  // top-left
            {  0.0f,    offset  },  // top-center
            {  offset,  offset  },  // top-right
            { -offset,  0.0f    },  // center-left
            {  0.0f,    0.0f    },  // center-center
            {  offset,  0.0f    },  // center - right
            { -offset, -offset  },  // bottom-left
            {  0.0f,   -offset  },  // bottom-center
            {  offset, -offset  }   // bottom-right
        };
        int edge_kernel[9] = {
            -1, -1, -1,
            -1,  8, -1,
            -1, -1, -1
        };
        float blur_kernel[9] = {
            1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
            2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
            1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
        };
        // (Vulkan's texture v points down, so "top" and "bottom" swap their names; both kernels are symmetric, so the
        // result is the same)
        PostProcessingUniforms kernels{};
        for (int i = 0; i < 9; i++) {
            kernels.offsets[i] = glm::vec4(offsets[i][0], offsets[i][1], 0.0f, 0.0f);
            kernels.edge_kernel[i] = glm::ivec4(edge_kernel[i], 0, 0, 0);
            kernels.blur_kernel[i] = glm::vec4(blur_kernel[i], 0.0f, 0.0f, 0.0f);
        }
        // learnopengl sets these uniforms once: a uniform buffer written once
        createBuffer(sizeof(PostProcessingUniforms), VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, effects.UniformBuffer, effects.UniformBufferMemory);
        void* data;
        vkMapMemory(device, effects.UniformBufferMemory, 0, sizeof(PostProcessingUniforms), 0, &data);
            memcpy(data, &kernels, sizeof(PostProcessingUniforms));
        vkUnmapMemory(device, effects.UniformBufferMemory);
        // the descriptor set of the quad: the kernels (binding 0) and the texture (binding 1, learnopengl's "scene")
        createDescriptorSet(effects.UniformBuffer, sizeof(PostProcessingUniforms), effects.Texture.View, textureSampler, effects.Texture.DescriptorSet);
    }

    void cleanup() {
        for (auto semaphore : renderFinishedSemaphores) {
            vkDestroySemaphore(device, semaphore, nullptr);
        }
        vkDestroySemaphore(device, imageAvailableSemaphore, nullptr);
        vkDestroyFence(device, inFlightFence, nullptr);

        // delete all resources as loaded using the resource manager
        ClearResources();
        vkDestroyBuffer(device, Renderer.quadBuffer, nullptr);
        vkFreeMemory(device, Renderer.quadBufferMemory, nullptr);
        vkDestroyBuffer(device, Particles.quadBuffer, nullptr);
        vkFreeMemory(device, Particles.quadBufferMemory, nullptr);
        vkDestroyBuffer(device, Effects.quadBuffer, nullptr);
        vkFreeMemory(device, Effects.quadBufferMemory, nullptr);
        vkDestroyBuffer(device, Effects.UniformBuffer, nullptr);
        vkFreeMemory(device, Effects.UniformBufferMemory, nullptr);
        vkDestroyFramebuffer(device, Effects.Framebuffer, nullptr);
        vkDestroyRenderPass(device, Effects.RenderPass, nullptr);
        vkDestroyImageView(device, Effects.MSImageView, nullptr);
        vkDestroyImage(device, Effects.MSImage, nullptr);
        vkFreeMemory(device, Effects.MSImageMemory, nullptr);
        vkDestroyImageView(device, Effects.Texture.View, nullptr);
        vkDestroyImage(device, Effects.Texture.Image, nullptr);
        vkFreeMemory(device, Effects.Texture.Memory, nullptr);

        vkDestroyBuffer(device, uniformBuffer, nullptr);
        vkFreeMemory(device, uniformBufferMemory, nullptr);

        vkDestroyDescriptorPool(device, descriptorPool, nullptr);

        vkDestroySampler(device, textureSampler, nullptr);

        vkDestroyCommandPool(device, commandPool, nullptr);

        for (auto framebuffer : swapChainFramebuffers) {
            vkDestroyFramebuffer(device, framebuffer, nullptr);
        }

        vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
        vkDestroyDescriptorSetLayout(device, descriptorSetLayout, nullptr);
        vkDestroyRenderPass(device, renderPass, nullptr);

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
        appInfo.pApplicationName = "Hedgerow";
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
            swapChainImageViews[i] = createImageView(swapChainImages[i], swapChainImageFormat, VK_IMAGE_ASPECT_COLOR_BIT);
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

        VkAttachmentReference colorAttachmentRef{};
        colorAttachmentRef.attachment = 0;
        colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 1;
        subpass.pColorAttachments = &colorAttachmentRef;

        VkSubpassDependency dependency{};
        dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
        dependency.dstSubpass = 0;
        dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependency.srcAccessMask = 0;
        dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;

        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = 1;
        renderPassInfo.pAttachments = &colorAttachment;
        renderPassInfo.subpassCount = 1;
        renderPassInfo.pSubpasses = &subpass;
        renderPassInfo.dependencyCount = 1;
        renderPassInfo.pDependencies = &dependency;

        if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &renderPass) != VK_SUCCESS) {
            throw std::runtime_error("failed to create render pass!");
        }
    }

    void createDescriptorSetLayout() {
        // like vulkan-tutorial: the uniform buffer at binding 0, the texture at binding 1
        VkDescriptorSetLayoutBinding uboLayoutBinding{};
        uboLayoutBinding.binding = 0;
        uboLayoutBinding.descriptorCount = 1;
        uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        uboLayoutBinding.pImmutableSamplers = nullptr;
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // the projection / the postprocessing kernels

        VkDescriptorSetLayoutBinding samplerLayoutBinding{};
        samplerLayoutBinding.binding = 1;
        samplerLayoutBinding.descriptorCount = 1;
        samplerLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        samplerLayoutBinding.pImmutableSamplers = nullptr;
        samplerLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 2> bindings = {uboLayoutBinding, samplerLayoutBinding};
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
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // model / spriteColor
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);

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
    // constants) and the fixed functions below.
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkBlendFactor dstColorBlendFactor, VkRenderPass pipelineRenderPass, VkSampleCountFlagBits rasterizationSamples, VkPipeline& pipeline) {
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
        inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST;
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
        rasterizer.cullMode = VK_CULL_MODE_NONE;
        rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;
        rasterizer.depthBiasEnable = VK_FALSE;

        VkPipelineMultisampleStateCreateInfo multisampling{};
        multisampling.sType = VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO;
        multisampling.sampleShadingEnable = VK_FALSE;
        multisampling.rasterizationSamples = rasterizationSamples; // must match the render pass's attachments

        VkPipelineColorBlendAttachmentState colorBlendAttachment{};
        colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
        // blending: colour = src.rgb * src.a + dst.rgb * (1 - src.a) for the sprites (alpha blending),
        // src.rgb * src.a + dst.rgb for the particles (additive blending)
        colorBlendAttachment.blendEnable = VK_TRUE;
        colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
        colorBlendAttachment.dstColorBlendFactor = dstColorBlendFactor;
        colorBlendAttachment.colorBlendOp = VK_BLEND_OP_ADD;
        colorBlendAttachment.srcAlphaBlendFactor = VK_BLEND_FACTOR_ONE;
        colorBlendAttachment.dstAlphaBlendFactor = VK_BLEND_FACTOR_ZERO;
        colorBlendAttachment.alphaBlendOp = VK_BLEND_OP_ADD;

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
        pipelineInfo.pColorBlendState = &colorBlending;
        pipelineInfo.pDynamicState = &dynamicState;
        pipelineInfo.layout = pipelineLayout;
        pipelineInfo.renderPass = pipelineRenderPass; // a pipeline is made for one render pass
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
            VkImageView attachments[] = {
                swapChainImageViews[i]
            };

            VkFramebufferCreateInfo framebufferInfo{};
            framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
            framebufferInfo.renderPass = renderPass;
            framebufferInfo.attachmentCount = 1;
            framebufferInfo.pAttachments = attachments;
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

    // ResourceManager: loads a single texture from file: an image (device local, ready for sampling), its view and
    // its descriptor set. Every texture is RGBA (VK_FORMAT_R8G8B8A8_UNORM): devices need not sample 3-channel images,
    // and stb_image gives the pixels of an RGB file an alpha of 255 (learnopengl's `alpha` flag picks GL_RGB or
    // GL_RGBA; here there is nothing to choose).
    Texture2D loadTextureFromFile(const char* file) {
        Texture2D texture;
        // load image
        int width, height, nrChannels;
        stbi_uc* data = stbi_load(file, &width, &height, &nrChannels, STBI_rgb_alpha);
        if (!data) {
            throw std::runtime_error("failed to load texture image!");
        }
        texture.Width = width;
        texture.Height = height;
        // now generate texture
        createTextureImage(data, width, height, texture.Image, texture.Memory);
        // and finally free image data
        stbi_image_free(data);

        texture.View = createImageView(texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        createDescriptorSet(uniformBuffer, sizeof(UniformBufferObject), texture.View, textureSampler, texture.DescriptorSet);
        return texture;
    }

    // A texture image (device local, ready for sampling) with the pixels of an image loaded by stb_image as RGBA,
    // copied through a staging buffer. The caller frees the pixels.
    void createTextureImage(stbi_uc* pixels, int texWidth, int texHeight, VkImage& image, VkDeviceMemory& imageMemory) {
        VkDeviceSize imageSize = texWidth * texHeight * 4;

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, imageSize, 0, &data);
            memcpy(data, pixels, static_cast<size_t>(imageSize));
        vkUnmapMemory(device, stagingBufferMemory);

        // UNORM like the swap chain: the shaders read the bytes of the file unchanged (0..255 -> 0.0..1.0).
        createImage(texWidth, texHeight, VK_SAMPLE_COUNT_1_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, image, imageMemory);

        transitionImageLayout(image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, image, static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight));
        transitionImageLayout(image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }

    // A sampler with the wrapping mode for texture coordinates outside 0..1 (REPEAT, CLAMP_TO_EDGE ...).
    void createTextureSampler(VkSamplerAddressMode addressMode, VkSampler& sampler) {
        VkSamplerCreateInfo samplerInfo{};
        samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
        samplerInfo.addressModeU = addressMode;
        samplerInfo.addressModeV = addressMode;
        samplerInfo.addressModeW = addressMode;
        samplerInfo.anisotropyEnable = VK_FALSE; // learnopengl's Texture2D: plain linear filtering
        samplerInfo.maxAnisotropy = 1.0f;
        samplerInfo.borderColor = VK_BORDER_COLOR_INT_OPAQUE_BLACK;
        samplerInfo.unnormalizedCoordinates = VK_FALSE;
        samplerInfo.compareEnable = VK_FALSE;
        samplerInfo.compareOp = VK_COMPARE_OP_ALWAYS;
        samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;

        if (vkCreateSampler(device, &samplerInfo, nullptr, &sampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
    }

    VkImageView createImageView(VkImage image, VkFormat format, VkImageAspectFlags aspectFlags) {
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
        viewInfo.format = format;
        viewInfo.subresourceRange.aspectMask = aspectFlags;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 1;

        VkImageView imageView;
        if (vkCreateImageView(device, &viewInfo, nullptr, &imageView) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image view!");
        }

        return imageView;
    }

    void createImage(uint32_t width, uint32_t height, VkSampleCountFlagBits numSamples, VkFormat format, VkImageTiling tiling, VkImageUsageFlags usage, VkMemoryPropertyFlags properties, VkImage& image, VkDeviceMemory& imageMemory) {
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = width;
        imageInfo.extent.height = height;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 1;
        imageInfo.format = format;
        imageInfo.tiling = tiling;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = usage;
        imageInfo.samples = numSamples;
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

    void createUniformBuffers() {
        VkDeviceSize bufferSize = sizeof(UniformBufferObject);

        createBuffer(bufferSize, VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, uniformBuffer, uniformBufferMemory);

        // "persistent mapping": the memory stays mapped while the program runs, we write to it every frame
        vkMapMemory(device, uniformBufferMemory, 0, bufferSize, 0, &uniformBufferMapped);
    }

    void createDescriptorPool() {
        // one descriptor set per texture, each with the uniform buffer and its texture
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = MAX_TEXTURES;
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = MAX_TEXTURES;

        VkDescriptorPoolCreateInfo poolInfo{};
        poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
        poolInfo.poolSizeCount = static_cast<uint32_t>(poolSizes.size());
        poolInfo.pPoolSizes = poolSizes.data();
        poolInfo.maxSets = MAX_TEXTURES;

        if (vkCreateDescriptorPool(device, &poolInfo, nullptr, &descriptorPool) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor pool!");
        }
    }

    // A descriptor set with a uniform buffer (binding 0: the projection for the sprites, the kernels for the
    // postprocessing quad) and one texture (binding 1). Binding it before a draw (vkCmdBindDescriptorSets) is
    // Vulkan's glBindTexture.
    void createDescriptorSet(VkBuffer buffer, VkDeviceSize range, VkImageView textureImageView, VkSampler sampler, VkDescriptorSet& descriptorSet) {
        VkDescriptorSetAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
        allocInfo.descriptorPool = descriptorPool;
        allocInfo.descriptorSetCount = 1;
        allocInfo.pSetLayouts = &descriptorSetLayout;

        if (vkAllocateDescriptorSets(device, &allocInfo, &descriptorSet) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate descriptor sets!");
        }

        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = buffer;
        bufferInfo.offset = 0;
        bufferInfo.range = range;

        VkDescriptorImageInfo imageInfo{};
        imageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        imageInfo.imageView = textureImageView;
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

        // the viewport and scissor (dynamic state) hold for both render passes of the frame
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

        // the game's draws go into this command buffer
        Renderer.commandBuffer = commandBuffer;
        Particles.commandBuffer = commandBuffer;
        Effects.commandBuffer = commandBuffer;
        Effects.WindowFramebuffer = swapChainFramebuffers[imageIndex];
        // the game's picture: the off-screen pass (BeginRender ... EndRender), then the window's render pass with the
        // postprocessing quad (EndRender begins it)
        Render(Hedgerow);

        vkCmdEndRenderPass(commandBuffer); // the window's render pass

        if (vkEndCommandBuffer(commandBuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to record command buffer!");
        }
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
        // the game's coordinates: pixels from the top-left corner, y down. learnopengl writes glm::ortho(0, width,
        // height, 0, -1, 1) because OpenGL's clip space y points up; Vulkan's points down already, so bottom = 0 and
        // top = height here.
        ubo.projection = glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f, static_cast<float>(Hedgerow.Height), -1.0f, 1.0f);

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
