#include <glad/glad.h>
#include <GLFW/glfw3.h>
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <ft2build.h>
#include FT_FREETYPE_H

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <map>
#include <vector>
#include <tuple>
#include <cstdlib>
#include <algorithm>

// Hedgerow: a ball, a paddle and a wall of blocks.
// learnopengl splits its game into classes and files (Game, ResourceManager, Shader, Texture2D, SpriteRenderer ...);
// here each class is a plain struct with free functions, in one file, in the order of learnopengl's files.

// The width of the screen
const unsigned int SCREEN_WIDTH = 800;
// The height of the screen
const unsigned int SCREEN_HEIGHT = 600;

// Shader (learnopengl: shader.h, shader.cpp)
// ------------------------------------------
// a compiled and linked shader program
struct Shader
{
    unsigned int ID = 0;
};

// sets the current shader as active
void Use(Shader& shader)
{
    glUseProgram(shader.ID);
}

// checks if compilation or linking failed and if so, print the error logs
void checkCompileErrors(unsigned int object, std::string type)
{
    int success;
    char infoLog[1024];
    if (type != "PROGRAM")
    {
        glGetShaderiv(object, GL_COMPILE_STATUS, &success);
        if (!success)
        {
            glGetShaderInfoLog(object, 1024, NULL, infoLog);
            std::cout << "| ERROR::SHADER: Compile-time error: Type: " << type << "\n"
                << infoLog << "\n -- --------------------------------------------------- -- "
                << std::endl;
        }
    }
    else
    {
        glGetProgramiv(object, GL_LINK_STATUS, &success);
        if (!success)
        {
            glGetProgramInfoLog(object, 1024, NULL, infoLog);
            std::cout << "| ERROR::Shader: Link-time error: Type: " << type << "\n"
                << infoLog << "\n -- --------------------------------------------------- -- "
                << std::endl;
        }
    }
}

// compiles the shader from given source code (the geometry shader source code is optional)
void Compile(Shader& shader, const char* vertexSource, const char* fragmentSource, const char* geometrySource = nullptr)
{
    unsigned int sVertex, sFragment, gShader = 0;
    // vertex Shader
    sVertex = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(sVertex, 1, &vertexSource, NULL);
    glCompileShader(sVertex);
    checkCompileErrors(sVertex, "VERTEX");
    // fragment Shader
    sFragment = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(sFragment, 1, &fragmentSource, NULL);
    glCompileShader(sFragment);
    checkCompileErrors(sFragment, "FRAGMENT");
    // if geometry shader source code is given, also compile geometry shader
    if (geometrySource != nullptr)
    {
        gShader = glCreateShader(GL_GEOMETRY_SHADER);
        glShaderSource(gShader, 1, &geometrySource, NULL);
        glCompileShader(gShader);
        checkCompileErrors(gShader, "GEOMETRY");
    }
    // shader program
    shader.ID = glCreateProgram();
    glAttachShader(shader.ID, sVertex);
    glAttachShader(shader.ID, sFragment);
    if (geometrySource != nullptr)
        glAttachShader(shader.ID, gShader);
    glLinkProgram(shader.ID);
    checkCompileErrors(shader.ID, "PROGRAM");
    // delete the shaders as they're linked into our program now and no longer necessary
    glDeleteShader(sVertex);
    glDeleteShader(sFragment);
    if (geometrySource != nullptr)
        glDeleteShader(gShader);
}

// utility functions: set a uniform of the shader (useShader: make it the active shader first)
void SetFloat(Shader& shader, const char* name, float value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform1f(glGetUniformLocation(shader.ID, name), value);
}

void SetInteger(Shader& shader, const char* name, int value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform1i(glGetUniformLocation(shader.ID, name), value);
}

void SetVector3f(Shader& shader, const char* name, const glm::vec3& value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform3f(glGetUniformLocation(shader.ID, name), value.x, value.y, value.z);
}

void SetVector2f(Shader& shader, const char* name, const glm::vec2& value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform2f(glGetUniformLocation(shader.ID, name), value.x, value.y);
}

void SetVector4f(Shader& shader, const char* name, const glm::vec4& value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform4f(glGetUniformLocation(shader.ID, name), value.x, value.y, value.z, value.w);
}

void SetMatrix4(Shader& shader, const char* name, const glm::mat4& matrix, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniformMatrix4fv(glGetUniformLocation(shader.ID, name), 1, false, glm::value_ptr(matrix));
}

// Texture2D (learnopengl: texture.h, texture.cpp)
// -----------------------------------------------
// a texture object and its settings
struct Texture2D
{
    // holds the ID of the texture object, used for all texture operations to reference to this particular texture
    unsigned int ID = 0;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
    // texture Format
    unsigned int Internal_Format = GL_RGB; // format of texture object
    unsigned int Image_Format = GL_RGB; // format of loaded image
    // texture configuration
    unsigned int Wrap_S = GL_REPEAT; // wrapping mode on S axis
    unsigned int Wrap_T = GL_REPEAT; // wrapping mode on T axis
    unsigned int Filter_Min = GL_LINEAR; // filtering mode if texture pixels < screen pixels
    unsigned int Filter_Max = GL_LINEAR; // filtering mode if texture pixels > screen pixels
};

// generates texture from image data
void Generate(Texture2D& texture, unsigned int width, unsigned int height, unsigned char* data)
{
    texture.Width = width;
    texture.Height = height;
    // create Texture
    glBindTexture(GL_TEXTURE_2D, texture.ID);
    glTexImage2D(GL_TEXTURE_2D, 0, texture.Internal_Format, width, height, 0, texture.Image_Format, GL_UNSIGNED_BYTE, data);
    // set Texture wrap and filter modes
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, texture.Wrap_S);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, texture.Wrap_T);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, texture.Filter_Min);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, texture.Filter_Max);
    // unbind texture
    glBindTexture(GL_TEXTURE_2D, 0);
}

// ResourceManager (learnopengl: resource_manager.h, resource_manager.cpp)
// -----------------------------------------------------------------------
// resource storage
std::map<std::string, Shader>    Shaders;
std::map<std::string, Texture2D> Textures;

// loads and generates a shader from file
Shader loadShaderFromFile(const char *vShaderFile, const char *fShaderFile, const char *gShaderFile = nullptr)
{
    // 1. retrieve the vertex/fragment source code from filePath
    std::string vertexCode;
    std::string fragmentCode;
    std::string geometryCode;
    try
    {
        // open files
        std::ifstream vertexShaderFile(vShaderFile);
        std::ifstream fragmentShaderFile(fShaderFile);
        std::stringstream vShaderStream, fShaderStream;
        // read file's buffer contents into streams
        vShaderStream << vertexShaderFile.rdbuf();
        fShaderStream << fragmentShaderFile.rdbuf();
        // close file handlers
        vertexShaderFile.close();
        fragmentShaderFile.close();
        // convert stream into string
        vertexCode = vShaderStream.str();
        fragmentCode = fShaderStream.str();
        // if geometry shader path is present, also load a geometry shader
        if (gShaderFile != nullptr)
        {
            std::ifstream geometryShaderFile(gShaderFile);
            std::stringstream gShaderStream;
            gShaderStream << geometryShaderFile.rdbuf();
            geometryShaderFile.close();
            geometryCode = gShaderStream.str();
        }
    }
    catch (std::exception& e)
    {
        std::cout << "ERROR::SHADER: Failed to read shader files" << std::endl;
    }
    const char *vShaderCode = vertexCode.c_str();
    const char *fShaderCode = fragmentCode.c_str();
    const char *gShaderCode = geometryCode.c_str();
    // 2. now create shader object from source code
    Shader shader;
    Compile(shader, vShaderCode, fShaderCode, gShaderFile != nullptr ? gShaderCode : nullptr);
    return shader;
}

// loads a single texture from file
Texture2D loadTextureFromFile(const char *file, bool alpha)
{
    // create texture object
    Texture2D texture;
    glGenTextures(1, &texture.ID);
    if (alpha)
    {
        texture.Internal_Format = GL_RGBA;
        texture.Image_Format = GL_RGBA;
    }
    // load image
    int width, height, nrChannels;
    unsigned char* data = stbi_load(file, &width, &height, &nrChannels, 0);
    // now generate texture
    Generate(texture, width, height, data);
    // and finally free image data
    stbi_image_free(data);
    return texture;
}

// loads (and generates) a shader program from file loading vertex, fragment (and geometry) shader's source code. If gShaderFile is not nullptr, it also loads a geometry shader
Shader LoadShader(const char *vShaderFile, const char *fShaderFile, const char *gShaderFile, std::string name)
{
    Shaders[name] = loadShaderFromFile(vShaderFile, fShaderFile, gShaderFile);
    return Shaders[name];
}

// retrieves a stored shader
Shader& GetShader(std::string name)
{
    return Shaders[name];
}

// loads (and generates) a texture from file
Texture2D LoadTexture(const char *file, bool alpha, std::string name)
{
    Textures[name] = loadTextureFromFile(file, alpha);
    return Textures[name];
}

// retrieves a stored texture
Texture2D& GetTexture(std::string name)
{
    return Textures[name];
}

// properly de-allocates all loaded resources
void ClearResources()
{
    // (properly) delete all shaders
    for (auto iter : Shaders)
        glDeleteProgram(iter.second.ID);
    // (properly) delete all textures
    for (auto iter : Textures)
        glDeleteTextures(1, &iter.second.ID);
}

// SpriteRenderer (learnopengl: sprite_renderer.h, sprite_renderer.cpp)
// ---------------------------------------------------------------------
// renders textured quads (sprites) with one shader
struct SpriteRenderer
{
    // render state
    Shader       shader;
    unsigned int quadVAO = 0;
};

// initializes and configures the quad's buffer and vertex attributes (learnopengl's SpriteRenderer constructor calls it)
void InitRenderData(SpriteRenderer& renderer)
{
    // configure VAO/VBO
    unsigned int VBO;
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };

    glGenVertexArrays(1, &renderer.quadVAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(renderer.quadVAO);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}

// renders a defined quad textured with given sprite
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))
{
    // prepare transformations
    Use(renderer.shader);
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    SetMatrix4(renderer.shader, "model", model);

    // render textured quad
    SetVector3f(renderer.shader, "spriteColor", color);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, texture);

    glBindVertexArray(renderer.quadVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

// GameObject (learnopengl: game_object.h, game_object.cpp)
// --------------------------------------------------------
// Container object for holding all state relevant for a single
// game object entity. Each object in the game likely needs the
// minimal of state as described within GameObject.
struct GameObject
{
    // object state
    glm::vec2    Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3    Color = glm::vec3(1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID
};

// creates a game object (learnopengl's GameObject constructor)
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, unsigned int sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}

// BallObject (learnopengl: ball_object.h, ball_object.cpp)
// --------------------------------------------------------
// BallObject holds the state of the Ball object inheriting
// relevant state data from GameObject. Contains some extra
// functionality specific to Hedgerow's ball object that
// were too specific for within GameObject alone.
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
    bool  Sticky = false, PassThrough = false;
};

// creates a ball (learnopengl's BallObject constructor)
BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, unsigned int sprite)
{
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
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}

// resets the ball to initial Stuck Position (if ball is outside window bounds)
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
    ball.Sticky = false;
    ball.PassThrough = false;
}

// PowerUp (learnopengl: power_up.h)
// ---------------------------------
// The size of a PowerUp block
const glm::vec2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const glm::vec2 VELOCITY(0.0f, 150.0f);

// PowerUp inherits its state and rendering functions from
// GameObject but also holds extra information to state its
// active duration and whether it is activated or not.
// The type of PowerUp is stored as a string.
struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

// creates a power-up (learnopengl's PowerUp constructor)
PowerUp MakePowerUp(std::string type, glm::vec3 color, float duration, glm::vec2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}

// GameLevel (learnopengl: game_level.h, game_level.cpp)
// -----------------------------------------------------
/// GameLevel holds all Tiles as part of a level and
/// hosts functionality to Load/render levels from the harddisk.
struct GameLevel
{
    // level state
    std::vector<GameObject> Bricks;
};

// initialize level from tile data
void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)
{
    // calculate dimensions
    unsigned int height = tileData.size();
    unsigned int width = tileData[0].size(); // note we can index vector at [0] since this function is only called if height > 0
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
    // initialize level tiles based on tileData
    for (unsigned int y = 0; y < height; ++y)
    {
        for (unsigned int x = 0; x < width; ++x)
        {
            // check block type from level data (2D level array)
            if (tileData[y][x] == 1) // solid
            {
                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").ID, glm::vec3(0.8f, 0.8f, 0.7f));
                obj.IsSolid = true;
                level.Bricks.push_back(obj);
            }
            else if (tileData[y][x] > 1) // non-solid; now determine its color based on level data
            {
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
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").ID, color));
            }
        }
    }
}

// loads level from file
void LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth, unsigned int levelHeight)
{
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream)
    {
        while (std::getline(fstream, line)) // read each line from level file
        {
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

// check if the level is completed (all non-solid tiles are destroyed)
bool IsCompleted(GameLevel& level)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.IsSolid && !tile.Destroyed)
            return false;
    return true;
}

// render level
void DrawLevel(GameLevel& level, SpriteRenderer& renderer)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}

// ParticleGenerator (learnopengl: particle_generator.h, particle_generator.cpp)
// -----------------------------------------------------------------------------
// Represents a single particle and its state
struct Particle
{
    glm::vec2 Position = glm::vec2(0.0f), Velocity = glm::vec2(0.0f);
    glm::vec4 Color = glm::vec4(1.0f);
    float     Life = 0.0f;
};

// ParticleGenerator acts as a container for rendering a large number of
// particles by repeatedly spawning and updating particles and killing
// them after a given amount of time.
struct ParticleGenerator
{
    // state
    std::vector<Particle> particles;
    unsigned int          amount = 0;
    // render state
    Shader                shader;
    unsigned int          texture = 0; // the texture's ID
    unsigned int          VAO = 0;
};

// initializes the buffer and vertex attributes and creates the particles (learnopengl's ParticleGenerator constructor calls it)
void InitParticles(ParticleGenerator& generator)
{
    // set up mesh and attribute properties
    unsigned int VBO;
    float particle_quad[] = {
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
    glGenVertexArrays(1, &generator.VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(generator.VAO);
    // fill mesh buffer
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(particle_quad), particle_quad, GL_STATIC_DRAW);
    // set mesh attributes
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindVertexArray(0);

    // create generator.amount default particle instances
    for (unsigned int i = 0; i < generator.amount; ++i)
        generator.particles.push_back(Particle());
}

// stores the index of the last particle used (for quick access to next dead particle)
unsigned int lastUsedParticle = 0;
// returns the first Particle index that's currently unused e.g. Life <= 0.0f or 0 if no particle is currently inactive
unsigned int firstUnusedParticle(ParticleGenerator& generator)
{
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}

// respawns particle
void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = glm::vec2(0.0f, 0.0f))
{
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    particle.Position = object.Position + random + offset;
    particle.Color = glm::vec4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    particle.Velocity = object.Velocity * 0.1f;
}

// update all particles: spawn newParticles at the object, age and move the living ones
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset = glm::vec2(0.0f, 0.0f))
{
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i)
    {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i)
    {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f)
        {   // particle is alive, thus update
            p.Position -= p.Velocity * dt;
            p.Color.a -= dt * 2.5f;
        }
    }
}

// render all particles
void DrawParticles(ParticleGenerator& generator)
{
    // use additive blending to give it a 'glow' effect
    glBlendFunc(GL_SRC_ALPHA, GL_ONE);
    Use(generator.shader);
    for (Particle particle : generator.particles)
    {
        if (particle.Life > 0.0f)
        {
            SetVector2f(generator.shader, "offset", particle.Position);
            SetVector4f(generator.shader, "color", particle.Color);
            glBindTexture(GL_TEXTURE_2D, generator.texture);
            glBindVertexArray(generator.VAO);
            glDrawArrays(GL_TRIANGLES, 0, 6);
            glBindVertexArray(0);
        }
    }
    // don't forget to reset to default blending mode
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
}

// PostProcessor (learnopengl: post_processor.h, post_processor.cpp)
// -----------------------------------------------------------------
// PostProcessor hosts all PostProcessing effects for the Hedgerow
// Game. It renders the game on a textured quad after which one can
// enable specific effects by enabling either the Confuse, Chaos or
// Shake boolean.
// It is required to call BeginRender() before rendering the game
// and EndRender() after rendering the game for the struct to work.
struct PostProcessor
{
    // state
    Shader       PostProcessingShader;
    Texture2D    Texture;
    unsigned int Width = 0, Height = 0;
    // options
    bool         Confuse = false, Chaos = false, Shake = false;
    // render state
    unsigned int MSFBO = 0, FBO = 0; // MSFBO = Multisampled FBO. FBO is regular, used for blitting MS color-buffer to texture
    unsigned int RBO = 0;            // RBO is used for multisampled color buffer
    unsigned int VAO = 0;
};

// initialize quad for rendering postprocessing texture
void InitRenderData(PostProcessor& effects)
{
    // configure VAO/VBO
    unsigned int VBO;
    float vertices[] = {
        // pos        // tex
        -1.0f, -1.0f, 0.0f, 0.0f,
         1.0f,  1.0f, 1.0f, 1.0f,
        -1.0f,  1.0f, 0.0f, 1.0f,

        -1.0f, -1.0f, 0.0f, 0.0f,
         1.0f, -1.0f, 1.0f, 0.0f,
         1.0f,  1.0f, 1.0f, 1.0f
    };
    glGenVertexArrays(1, &effects.VAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(effects.VAO);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}

// creates the framebuffers, the quad and the shader's kernels (learnopengl's PostProcessor constructor)
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize renderbuffer/framebuffer object
    glGenFramebuffers(1, &effects.MSFBO);
    glGenFramebuffers(1, &effects.FBO);
    glGenRenderbuffers(1, &effects.RBO);
    // initialize renderbuffer storage with a multisampled color buffer (don't need a depth/stencil buffer)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, effects.RBO);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGB, width, height); // allocate storage for render buffer object
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, effects.RBO); // attach MS render buffer object to framebuffer
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize MSFBO" << std::endl;
    // also initialize the FBO/texture to blit multisampled color-buffer to; used for shader operations (for postprocessing effects)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.FBO);
    glGenTextures(1, &effects.Texture.ID);
    Generate(effects.Texture, width, height, NULL);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, effects.Texture.ID, 0); // attach texture to framebuffer as its color attachment
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize FBO" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    // initialize render data and uniforms
    InitRenderData(effects);
    SetInteger(effects.PostProcessingShader, "scene", 0, true);
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
    glUniform2fv(glGetUniformLocation(effects.PostProcessingShader.ID, "offsets"), 9, (float*)offsets);
    int edge_kernel[9] = {
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
    };
    glUniform1iv(glGetUniformLocation(effects.PostProcessingShader.ID, "edge_kernel"), 9, edge_kernel);
    float blur_kernel[9] = {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
    glUniform1fv(glGetUniformLocation(effects.PostProcessingShader.ID, "blur_kernel"), 9, blur_kernel);
}

// prepares the postprocessor's framebuffer operations before rendering the game
void BeginRender(PostProcessor& effects)
{
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
}

// should be called after rendering the game, so it stores all the rendered data into a texture object
void EndRender(PostProcessor& effects)
{
    // now resolve multisampled color-buffer into intermediate FBO to store to texture
    glBindFramebuffer(GL_READ_FRAMEBUFFER, effects.MSFBO);
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, effects.FBO);
    glBlitFramebuffer(0, 0, effects.Width, effects.Height, 0, 0, effects.Width, effects.Height, GL_COLOR_BUFFER_BIT, GL_NEAREST);
    glBindFramebuffer(GL_FRAMEBUFFER, 0); // binds both READ and WRITE framebuffer to default framebuffer
}

// renders the PostProcessor texture quad (as a screen-encompassing large sprite)
void Render(PostProcessor& effects, float time)
{
    // set uniforms/options
    Use(effects.PostProcessingShader);
    SetFloat(effects.PostProcessingShader, "time", time);
    SetInteger(effects.PostProcessingShader, "confuse", effects.Confuse);
    SetInteger(effects.PostProcessingShader, "chaos", effects.Chaos);
    SetInteger(effects.PostProcessingShader, "shake", effects.Shake);
    // render textured quad
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, effects.Texture.ID);
    glBindVertexArray(effects.VAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

// TextRenderer (learnopengl: text_renderer.h, text_renderer.cpp)
// ---------------------------------------------------------------
/// Holds all state information relevant to a character as loaded using FreeType
struct Character {
    unsigned int TextureID; // ID handle of the glyph texture
    glm::ivec2   Size;      // size of glyph
    glm::ivec2   Bearing;   // offset from baseline to left/top of glyph
    unsigned int Advance;   // horizontal offset to advance to next glyph
};

// A renderer for rendering text displayed by a font loaded using the
// FreeType library. A single font is loaded, processed into a list of Character
// items for later rendering.
struct TextRenderer
{
    // holds a list of pre-compiled Characters
    std::map<char, Character> Characters;
    // shader used for text rendering
    Shader       TextShader;
    // render state
    unsigned int VAO = 0, VBO = 0;
};

// loads the text shader and configures the quad's buffer (learnopengl's TextRenderer constructor)
void InitTextRenderer(TextRenderer& renderer, unsigned int width, unsigned int height)
{
    // load and configure shader
    renderer.TextShader = LoadShader("text_2d.vs", "text_2d.fs", nullptr, "text");
    SetMatrix4(renderer.TextShader, "projection", glm::ortho(0.0f, static_cast<float>(width), static_cast<float>(height), 0.0f), true);
    SetInteger(renderer.TextShader, "text", 0);
    // configure VAO/VBO for texture quads
    glGenVertexArrays(1, &renderer.VAO);
    glGenBuffers(1, &renderer.VBO);
    glBindVertexArray(renderer.VAO);
    glBindBuffer(GL_ARRAY_BUFFER, renderer.VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 6 * 4, NULL, GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), 0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}

// pre-compiles a list of characters from the given font
void Load(TextRenderer& renderer, std::string font, unsigned int fontSize)
{
    // first clear the previously loaded Characters
    renderer.Characters.clear();
    // then initialize and load the FreeType library
    FT_Library ft;
    if (FT_Init_FreeType(&ft)) // all functions return a value different than 0 whenever an error occurred
        std::cout << "ERROR::FREETYPE: Could not init FreeType Library" << std::endl;
    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, font.c_str(), 0, &face))
        std::cout << "ERROR::FREETYPE: Failed to load font" << std::endl;
    // set size to load glyphs as
    FT_Set_Pixel_Sizes(face, 0, fontSize);
    // disable byte-alignment restriction
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    // then for the first 128 ASCII characters, pre-load/compile their characters and store them
    for (GLubyte c = 0; c < 128; c++)
    {
        // load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            std::cout << "ERROR::FREETYTPE: Failed to load Glyph" << std::endl;
            continue;
        }
        // generate texture
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RED,
            face->glyph->bitmap.width,
            face->glyph->bitmap.rows,
            0,
            GL_RED,
            GL_UNSIGNED_BYTE,
            face->glyph->bitmap.buffer
            );
        // set texture options
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // now store character for later use
        Character character = {
            texture,
            glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        renderer.Characters.insert(std::pair<char, Character>(c, character));
    }
    glBindTexture(GL_TEXTURE_2D, 0);
    // destroy FreeType once we're finished
    FT_Done_Face(face);
    FT_Done_FreeType(ft);
}

// renders a string of text using the precompiled list of characters (x, y: its top-left corner)
void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, glm::vec3 color = glm::vec3(1.0f))
{
    // activate corresponding render state
    Use(renderer.TextShader);
    SetVector3f(renderer.TextShader, "textColor", color);
    glActiveTexture(GL_TEXTURE0);
    glBindVertexArray(renderer.VAO);

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = renderer.Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // update VBO for each character
        float vertices[6][4] = {
            { xpos,     ypos + h,   0.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 0.0f },
            { xpos,     ypos,       0.0f, 0.0f },

            { xpos,     ypos + h,   0.0f, 1.0f },
            { xpos + w, ypos + h,   1.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 0.0f }
        };
        // render glyph texture over quad
        glBindTexture(GL_TEXTURE_2D, ch.TextureID);
        // update content of VBO memory
        glBindBuffer(GL_ARRAY_BUFFER, renderer.VBO);
        glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vertices), vertices); // be sure to use glBufferSubData and not glBufferData
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // render quad
        glDrawArrays(GL_TRIANGLES, 0, 6);
        // now advance cursors for next glyph
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (1/64th times 2^6 = 64)
    }
    glBindVertexArray(0);
    glBindTexture(GL_TEXTURE_2D, 0);
}

// Game (learnopengl: game.h, game.cpp)
// ------------------------------------
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
struct Game
{
    // game state
    GameState               State = GAME_MENU;
    bool                    Keys[1024] = {};
    bool                    KeysProcessed[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
    std::vector<GameLevel>  Levels;
    std::vector<PowerUp>    PowerUps;
    unsigned int            Level = 0;
    unsigned int            Lives = 3;
};

// Game-related State data
Game Hedgerow;
SpriteRenderer Renderer;
GameObject     Player;
BallObject     Ball;
ParticleGenerator Particles;
PostProcessor  Effects;
TextRenderer   Text;

float ShakeTime = 0.0f;

// PowerUps (learnopengl: game.cpp)
// --------------------------------
// Check if another PowerUp of the same type is still active
// in which case we don't disable its effect (yet)
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}

// moves the power-ups, counts down the active ones and removes the ones that are done
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        powerUp.Position += powerUp.Velocity * dt;
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}

// true with a chance of 1 in chance
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

// spawns power-ups (each with its own chance) at a destroyed block
void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}

// switches a power-up's effect on
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        Ball.Velocity *= 1.2f;
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = glm::vec3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = glm::vec3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}

// Collision detection (learnopengl: game.cpp)
// -------------------------------------------
// AABB - AABB collision
bool CheckCollision(GameObject& one, GameObject& two)
{
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
Direction VectorDirection(glm::vec2 target)
{
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}

// AABB - Circle collision
Collision CheckCollision(BallObject& one, GameObject& two)
{
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
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            Collision collision = CheckCollision(Ball, box);
            if (std::get<0>(collision)) // if collision is true
            {
                // destroy block if not solid
                if (!box.IsSolid)
                {
                    box.Destroyed = true;
                    SpawnPowerUps(game, box);
                }
                else
                {   // if block is solid, enable shake effect
                    ShakeTime = 0.05f;
                    Effects.Shake = true;
                }
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (!(Ball.PassThrough && !box.IsSolid)) // don't do collision resolution on non-solid bricks if pass-through is activated
                {
                    if (dir == LEFT || dir == RIGHT) // horizontal collision
                    {
                        Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                        // relocate
                        float penetration = Ball.Radius - std::abs(diff_vector.x);
                        if (dir == LEFT)
                            Ball.Position.x += penetration; // move ball to right
                        else
                            Ball.Position.x -= penetration; // move ball to left;
                    }
                    else // vertical collision
                    {
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
    }
    // also check collisions on PowerUps and if so, activate them
    for (PowerUp& powerUp : game.PowerUps)
    {
        if (!powerUp.Destroyed)
        {
            // first check if powerup passed bottom edge, if so: keep as inactive and destroy
            if (powerUp.Position.y >= game.Height)
                powerUp.Destroyed = true;

            if (CheckCollision(Player, powerUp))
            {   // collided with player, now activate powerup
                ActivatePowerUp(powerUp);
                powerUp.Destroyed = true;
                powerUp.Activated = true;
            }
        }
    }
    // and finally check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
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
        // if Sticky powerup is activated, also stick ball to paddle once new velocity vectors were calculated
        Ball.Stuck = Ball.Sticky;
    }
}

// reloads the current level (every brick back in place)
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);

    game.Lives = 3;
}

// puts the paddle back at the bottom centre and the ball back on it (stuck)
void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
    // also disable all active powerups
    Effects.Chaos = Effects.Confuse = false;
    Ball.PassThrough = Ball.Sticky = false;
    Player.Color = glm::vec3(1.0f);
    Ball.Color = glm::vec3(1.0f);
}

// initialize game state (load all shaders/textures/levels)
void Init(Game& game)
{
    // load shaders
    LoadShader("sprite.vs", "sprite.fs", nullptr, "sprite");
    LoadShader("particle.vs", "particle.fs", nullptr, "particle");
    LoadShader("post_processing.vs", "post_processing.fs", nullptr, "postprocessing");
    // configure shaders
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
    Use(GetShader("sprite"));
    SetInteger(GetShader("sprite"), "image", 0);
    SetMatrix4(GetShader("sprite"), "projection", projection);
    Use(GetShader("particle"));
    SetInteger(GetShader("particle"), "sprite", 0);
    SetMatrix4(GetShader("particle"), "projection", projection);
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
    LoadTexture("textures/particle.png", true, "particle");
    LoadTexture("textures/powerup_speed.png", true, "powerup_speed");
    LoadTexture("textures/powerup_sticky.png", true, "powerup_sticky");
    LoadTexture("textures/powerup_increase.png", true, "powerup_increase");
    LoadTexture("textures/powerup_confuse.png", true, "powerup_confuse");
    LoadTexture("textures/powerup_chaos.png", true, "powerup_chaos");
    LoadTexture("textures/powerup_pass.png", true, "powerup_pass");
    // set up the particle generator (learnopengl's ParticleGenerator constructor): 500 particles
    Particles.shader = GetShader("particle");
    Particles.texture = GetTexture("particle").ID;
    Particles.amount = 500;
    InitParticles(Particles);
    // set up the postprocessor (learnopengl's PostProcessor constructor)
    InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
    // set up the text renderer (learnopengl's TextRenderer constructor) and load the font at 24 pixels
    InitTextRenderer(Text, game.Width, game.Height);
    Load(Text, "fonts/Inter-Bold.otf", 24);
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
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
    glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
}

// game loop
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_MENU)
    {
        if (game.Keys[GLFW_KEY_ENTER] && !game.KeysProcessed[GLFW_KEY_ENTER])
        {
            game.State = GAME_ACTIVE;
            game.KeysProcessed[GLFW_KEY_ENTER] = true;
        }
        if (game.Keys[GLFW_KEY_W] && !game.KeysProcessed[GLFW_KEY_W])
        {
            game.Level = (game.Level + 1) % 4;
            game.KeysProcessed[GLFW_KEY_W] = true;
        }
        if (game.Keys[GLFW_KEY_S] && !game.KeysProcessed[GLFW_KEY_S])
        {
            if (game.Level > 0)
                --game.Level;
            else
                game.Level = 3;
            game.KeysProcessed[GLFW_KEY_S] = true;
        }
    }
    if (game.State == GAME_WIN)
    {
        if (game.Keys[GLFW_KEY_ENTER])
        {
            game.KeysProcessed[GLFW_KEY_ENTER] = true;
            Effects.Chaos = false;
            game.State = GAME_MENU;
        }
    }
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}

void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // update particles
    Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));
    // update PowerUps
    UpdatePowerUps(game, dt);
    // reduce shake time
    if (ShakeTime > 0.0f)
    {
        ShakeTime -= dt;
        if (ShakeTime <= 0.0f)
            Effects.Shake = false;
    }
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        --game.Lives;
        // did the player lose all his lives? : game over
        if (game.Lives == 0)
        {
            ResetLevel(game);
            game.State = GAME_MENU;
        }
        ResetPlayer(game);
    }
    // check win condition
    if (game.State == GAME_ACTIVE && IsCompleted(game.Levels[game.Level]))
    {
        ResetLevel(game);
        ResetPlayer(game);
        Effects.Chaos = true;
        game.State = GAME_WIN;
    }
}

void Render(Game& game)
{
    if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)
    {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw PowerUps
        for (PowerUp& powerUp : game.PowerUps)
            if (!powerUp.Destroyed)
                DrawObject(powerUp, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, glfwGetTime());
        // render text (don't include in postprocessing)
        RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);
    }
    if (game.State == GAME_MENU)
    {
        RenderText(Text, "Press ENTER to start", 250.0f, game.Height / 2.0f, 1.0f);
        RenderText(Text, "Press W or S to select level", 245.0f, game.Height / 2.0f + 20.0f, 0.75f);
    }
    if (game.State == GAME_WIN)
    {
        RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, glm::vec3(0.0f, 1.0f, 0.0f));
        RenderText(Text, "Press ENTER to retry or ESC to quit", 130.0f, game.Height / 2.0f, 1.0f, glm::vec3(1.0f, 1.0f, 0.0f));
    }
}

// Program (learnopengl: program.cpp)
// ----------------------------------
// GLFW function declarations
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode);

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

    glfwSetKeyCallback(window, key_callback);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    // OpenGL configuration
    // --------------------
    glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    // initialize game
    // ---------------
    Init(Hedgerow);

    // deltaTime variables
    // -------------------
    float deltaTime = 0.0f;
    float lastFrame = 0.0f;

    while (!glfwWindowShouldClose(window))
    {
        // calculate delta time
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;
        glfwPollEvents();

        // manage user input
        // -----------------
        ProcessInput(Hedgerow, deltaTime);

        // update game state
        // -----------------
        Update(Hedgerow, deltaTime);

        // render
        // ------
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        Render(Hedgerow);

        glfwSwapBuffers(window);
    }

    // delete all resources as loaded using the resource manager
    // ---------------------------------------------------------
    ClearResources();
    glDeleteVertexArrays(1, &Renderer.quadVAO);
    glDeleteVertexArrays(1, &Particles.VAO);
    glDeleteVertexArrays(1, &Effects.VAO);
    glDeleteFramebuffers(1, &Effects.MSFBO);
    glDeleteFramebuffers(1, &Effects.FBO);
    glDeleteRenderbuffers(1, &Effects.RBO);
    glDeleteTextures(1, &Effects.Texture.ID);
    glDeleteVertexArrays(1, &Text.VAO);
    glDeleteBuffers(1, &Text.VBO);
    for (auto& character : Text.Characters)
        glDeleteTextures(1, &character.second.TextureID);

    glfwTerminate();
    return 0;
}

void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode)
{
    // when a user presses the escape key, we set the WindowShouldClose property to true, closing the application
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
    if (key >= 0 && key < 1024)
    {
        if (action == GLFW_PRESS)
            Hedgerow.Keys[key] = true;
        else if (action == GLFW_RELEASE)
        {
            Hedgerow.Keys[key] = false;
            Hedgerow.KeysProcessed[key] = false;
        }
    }
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
