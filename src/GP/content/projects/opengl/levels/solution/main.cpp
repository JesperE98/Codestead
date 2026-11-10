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

// render level
void DrawLevel(GameLevel& level, SpriteRenderer& renderer)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}

// Game (learnopengl: game.h, game.cpp)
// ------------------------------------
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Initial size of the player paddle
const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game
{
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};

// Game-related State data
Game Hedgerow;
SpriteRenderer Renderer;
GameObject     Player;

// initialize game state (load all shaders/textures/levels)
void Init(Game& game)
{
    // load shaders
    LoadShader("sprite.vs", "sprite.fs", nullptr, "sprite");
    // configure shaders
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
    Use(GetShader("sprite"));
    SetInteger(GetShader("sprite"), "image", 0);
    SetMatrix4(GetShader("sprite"), "projection", projection);
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
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
}

// game loop
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
}

void Update(Game& game, float dt)
{

}

void Render(Game& game)
{
    if (game.State == GAME_ACTIVE)
    {
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
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
            Hedgerow.Keys[key] = false;
    }
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
