# Creating a window

The first thing we need to do before we can draw anything is to create a window to draw in. Opening a window is
not something a graphics API does by itself: windows belong to the operating system, and every operating system
creates them differently (Win32 on Windows, X11 or Wayland on Linux, Cocoa on macOS). The graphics API only renders;
something else has to give it a place on the screen.

:::opengl
For OpenGL we also need an **OpenGL context**. The context is the state machine you read about in the previous
chapter: it stores all of OpenGL's state, and every OpenGL call works on the context that is *current* on the
calling thread. Creating a context is, again, operating-system specific – which is why OpenGL purposefully leaves
it out of the specification.

Luckily there are quite a few libraries that do the window and the context for us, and that also give us the
keyboard and mouse input: GLUT, SDL, SFML and GLFW, to name a few. Like learnopengl.com, we will use **GLFW**.
:::
:::vulkan
Vulkan has no context like OpenGL. Instead you create every object it needs yourself, explicitly: an *instance* that
connects your program to the Vulkan library, the *physical device* (the graphics card) you want to use, and a
*logical device* with the *queues* you will send work to. That is what this chapter is about – it covers
vulkan-tutorial.com's "Development environment" briefly and the whole "Setup" section: base code, instance,
validation layers, physical devices and queue families, logical device and queues.

For the window itself we use **GLFW**, like vulkan-tutorial.com: it opens windows on Windows, Linux and macOS, and it
also takes care of some platform-specific Vulkan details for us (which extensions the window system needs, and
later the window surface).
:::
:::d3d12
Direct3D 12 only runs on Windows, so there is no need for a cross-platform library: like Microsoft's D3D12HelloWorld
samples, we create the window directly with the **Win32 API**. That part is already written in your project – we'll
walk through it so you know what it does. Then we start Direct3D 12 itself: the debug layer, the DXGI factory, the
adapter (graphics card), the **device** and the **command queue**. That is the beginning of `LoadPipeline()` in
the D3D12HelloWindow sample.
:::

The project on the right already contains the program's skeleton. `// TODO:` comments mark where your code goes,
and **Build & run** (Ctrl+Enter) compiles the project and runs it in the built-in simulator. If you'd rather also
run the program on your own machine, each API has a short *building it yourself* section below.

```quiz
Why does a graphics program need a library like GLFW, or the operating system's own window functions, to get a window?
- [ ] Because the graphics API's own window functions are deprecated
- [ ] Because without it, the program cannot use the graphics card at all
- [ ] Because the GPU can only draw into windows that GLFW created
- [x] Because creating windows is operating-system specific and not part of the graphics API
---
OpenGL, Vulkan and Direct3D 12 only render. The window (and, for OpenGL, the context) comes from the operating system –
directly through Win32, or through a library such as GLFW that hides the differences between operating systems.
```
:::opengl
## GLFW

GLFW is a library, written in C, specifically targeted at OpenGL. It gives us the bare necessities required for
rendering to the screen: it creates an OpenGL context, defines window parameters and handles user input – which is
plenty for our purposes.

The focus of this and the next chapter is to get GLFW up and running, making sure it properly creates an OpenGL
context and that it displays a simple window for us to mess around in.

## Building GLFW

GLFW can be obtained from its [download page](https://www.glfw.org/download.html). You can download the
pre-compiled binaries for Windows, but learnopengl.com recommends compiling the library yourself from the source
code: then it is built with exactly your compiler and settings, and you can always be sure the library matches your
project. From the source package, the files we're interested in are the library that comes out of the compilation
and the **include** folder.

## CMake

CMake is a tool that can generate project/solution files of the user's choice (Visual Studio, Code::Blocks, Eclipse,
Makefiles …) from a collection of source files and a `CMakeLists.txt` that describes them. That allows us to build a
Visual Studio project from GLFW's source package, which we can then compile into a library.

With the CMake GUI you choose the source folder (GLFW's root folder) and a build folder (for example a new `build`
folder inside it), press **Configure**, pick your generator (for example your version of Visual Studio), keep the
default settings, press **Configure** again and then **Generate**. The build folder now contains a solution.

## Compilation

Open the generated `GLFW.sln` and build it. The compiled library ends up in `build/src/Debug` as `glfw3.lib`
(on Linux and macOS, `make` produces `libglfw3.a` in `build/src`). On Linux you usually don't have to build anything
at all: your distribution's package (`libglfw3-dev` on Debian/Ubuntu, `glfw-devel` on Fedora, `glfw` on Arch) has the
headers and the library. On macOS, `brew install glfw` does the same.

```quiz
What does CMake do with GLFW's source code?
- [ ] It loads the OpenGL functions at runtime
- [ ] It downloads the pre-compiled binaries that match your system
- [ ] It compiles the source code into `glfw3.lib` by itself
- [x] It generates project files (a Visual Studio solution, Makefiles …) for your compiler, which you then build
---
CMake is a *build system generator*: from `CMakeLists.txt` it writes the project files for the tool you chose. The
compiling is done afterwards, by Visual Studio or `make`.
```
:::
:::opengl
## Linking

For your own project to use GLFW, the compiler has to find GLFW's headers and the linker has to find the library.
A common approach is a single folder of your own (for example `C:\OpenGL` with `include` and `lib` subfolders) that
you add to the project's **include directories** and **library directories**; then you add `glfw3.lib` to the
linker's input.

### OpenGL library on Windows

On Windows you also link against `opengl32.lib`, which comes with the Windows SDK (installed with Visual Studio).
It contains the OpenGL 1.1 entry points; everything newer is loaded at runtime – see GLAD below.

### OpenGL library on Linux

On Linux you link against `libGL.so` by adding `-lGL` – but with GLAD and GLFW that is often not even needed. If you
built GLFW as a static library yourself, you also need its own dependencies:
`-lglfw3 -lGL -lX11 -lpthread -lXrandr -lXi -ldl`. With the distribution's shared package, `-lglfw` is enough.

## GLAD

We're still not quite there. Because OpenGL is really only a standard/specification, it is up to the driver
manufacturer to implement the specification in a driver that the specific graphics card supports. Since there are
many different versions of OpenGL drivers, the location of most of its functions is not known at compile time and
needs to be queried at run time. It is then the task of the developer to retrieve the location of each function
they need and store it in a function pointer for later use. Doing that by hand, function by function, is
cumbersome – and that is what GLAD does for us.

### Setting up GLAD

GLAD is an open source library whose loader you generate with a web service (`glad.dav1d.de`, as learnopengl.com
uses). There you set the language to **C/C++**, the API **gl** to version **3.3**, the profile to **Core**, make
sure **Generate a loader** is ticked, and press **Generate**. You get a zip file with two include folders
(`include/glad/glad.h` and `include/KHR/khrplatform.h`) and a single `glad.c`. Copy both include folders into your
include directory and add `glad.c` to your project.

### Building it yourself

The project in this chapter is one file, `main.cpp`. With GLFW installed and the generated GLAD files in a folder
next to it (`include/` and `glad.c`), you can compile it on Linux like this:

```text
g++ -std=c++17 main.cpp glad.c -Iinclude -o window -lglfw -ldl
```

Or, more portably, with a small `CMakeLists.txt` (GLFW installs a CMake package that provides the `glfw` target):

```text
cmake_minimum_required(VERSION 3.16)
project(LearnOpenGL C CXX)

find_package(glfw3 REQUIRED)

add_executable(window main.cpp glad.c)
target_include_directories(window PRIVATE include)
target_link_libraries(window PRIVATE glfw ${CMAKE_DL_LIBS})
```

In Visual Studio: an empty C++ project with `main.cpp` and `glad.c`, the include and library folders set, and
`glfw3.lib` and `opengl32.lib` as additional linker dependencies.

## Hello Window

Let's see if we can get GLFW up and running. At the top of `main.cpp` the project already includes the headers:

```cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
```

Be sure to include GLAD before GLFW. GLAD's header includes the required OpenGL headers behind the scenes (like
`GL/gl.h`), so it has to come before every other header that requires OpenGL – like GLFW's.

```quiz
Why must `glad/glad.h` be included before `GLFW/glfw3.h`?
- [ ] The order doesn't matter; it is only a convention
- [ ] GLFW calls GLAD's functions while it is being included
- [ ] `glad.h` defines `SCR_WIDTH` and `SCR_HEIGHT`
- [x] GLAD's header provides the OpenGL declarations itself, so it must come before any header that would otherwise pull in the system's OpenGL header
---
GLFW includes the system's OpenGL header unless one has already been included. GLAD's header defines all OpenGL
declarations up to 3.3 itself and refuses to work if `gl.h` came first – so GLAD goes first.
```
:::
:::opengl
Next, we create the `main` function where we will instantiate the GLFW window:

```cpp
glfwInit();
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
```

In the main function we first initialize GLFW with `glfwInit`, after which we can configure GLFW using
`glfwWindowHint`. The first argument of `glfwWindowHint` tells us what option we want to configure, where we can
select the option from a large enum of possible options prefixed with `GLFW_`. The second argument is an integer
that sets the value of our option. A list of all the possible options and their corresponding values can be found
in GLFW's [window handling documentation](https://www.glfw.org/docs/latest/window_guide.html#window_hints).

Since the focus of this course is on OpenGL version 3.3, we'd like to tell GLFW that 3.3 is the OpenGL version we
want to use. This way GLFW can make the proper arrangements when creating the OpenGL context. This ensures that when
a user does not have the proper OpenGL version, GLFW fails to run. We set the major and minor version both to `3`.
We also tell GLFW we want to explicitly use the **core profile**: we'll get access to a smaller subset of OpenGL
features, without the backwards-compatible features we no longer need. On macOS you also need to ask for a
*forward-compatible* context, or the context isn't created – that's what the `#ifdef __APPLE__` lines are for.

Now do the first task: replace the first `// TODO:` in `main` with the `glfwInit()` call and the window hints.
Build & run: nothing visible happens yet, but the program should build and exit normally.

```quiz
You ask GLFW for an OpenGL 3.3 core profile context, but the computer's driver only supports OpenGL 2.1. What happens?
- [ ] The program crashes the first time it draws
- [ ] GLFW quietly creates a 2.1 context instead
- [ ] `glfwInit()` fails
- [x] Creating the window (and its context) fails: `glfwCreateWindow` returns `NULL`
---
The window hints are requirements for the context. If the driver can't satisfy them, `glfwCreateWindow` returns
`NULL` – which is why we check its return value.
```
:::
:::opengl
Next we're required to create a window object. This window object holds all the windowing data and is required by
most of GLFW's other functions.

```cpp
GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
if (window == NULL)
{
    std::cout << "Failed to create GLFW window" << std::endl;
    glfwTerminate();
    return -1;
}
glfwMakeContextCurrent(window);
```

The `glfwCreateWindow` function requires the window width and height as its first two arguments respectively –
`SCR_WIDTH` and `SCR_HEIGHT` are defined at the top of the file as 800 and 600. The third argument allows us to
create a name for the window; we call it `"LearnOpenGL"`. We can ignore the last 2 parameters (a monitor for full
screen mode, and a context to share resources with). The function returns a `GLFWwindow` object that we'll later
need for other GLFW operations. After that we tell GLFW to make the context of our window the main context on the
current thread: from now on, OpenGL calls go to this context.

Do the second task now: create the window, check it and make its context current.

## GLAD

In the previous section we mentioned that GLAD manages function pointers for OpenGL, so we want to initialize GLAD
before we call any OpenGL function:

```cpp
if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
{
    std::cout << "Failed to initialize GLAD" << std::endl;
    return -1;
}
```

We pass GLAD the function to load the address of the OpenGL function pointers, which is OS-specific. GLFW gives us
`glfwGetProcAddress`, which defines the correct function based on which OS we're compiling for. GLAD calls it for
every OpenGL function and stores the addresses it gets back.

Now do the third task: put the GLAD initialization right after `glfwMakeContextCurrent(window);`.

```quiz
Why must `gladLoadGLLoader` be called after `glfwMakeContextCurrent(window)`?
- [x] Because the function addresses are asked from the current context (through `glfwGetProcAddress`); without a current context there is nothing to ask
- [ ] It doesn't have to be – the order doesn't matter
- [ ] Because GLAD needs the window's width and height
- [ ] Because `glfwMakeContextCurrent` deletes the function pointers GLAD loaded earlier
---
The addresses belong to the driver behind the context. `glfwGetProcAddress` only works while a context is current,
so: create the window, make its context current, then load GLAD.
```
:::
:::opengl
## Cleaning up

When we're done, we want to properly clean up and delete all of GLFW's resources that were allocated. We can do
this via the `glfwTerminate` function that we call at the end of the `main` function:

```cpp
glfwTerminate();
return 0;
```

This cleans up all the resources and properly exits the application. Do the last task: add `glfwTerminate();`
right before `return 0;`.

Now try to build and run your application. If everything went well you see a window titled "LearnOpenGL" appear –
and disappear again straight away. That is expected: nothing keeps the program running yet. If it didn't work,
compare your code with the hints of the tasks.

```quiz
The finished program opens its window and closes it again at once. Why?
- [ ] Because the core profile doesn't allow windows to stay open
- [ ] Because GLAD failed to load
- [ ] Because the window has no viewport yet
- [x] Because `main` has no loop: right after setting everything up it calls `glfwTerminate()` and returns
---
A window only stays as long as the program runs. In the next chapter, Hello Window, you add a *render loop* that
keeps the window open and draws into it until it is closed.
```
:::
:::opengl
## Additional resources

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) and
  [Hello Window](https://learnopengl.com/Getting-started/Hello-Window) on learnopengl.com: the chapters this one
  follows, with screenshots of the Visual Studio and CMake set-up.
- GLFW's [window guide](https://www.glfw.org/docs/latest/window_guide.html) and
  [context guide](https://www.glfw.org/docs/latest/context_guide.html): every window hint and what it does.

In the next chapter we keep the window open with a render loop, react to input and clear the window with a colour.
:::
:::vulkan
## Development environment

To develop Vulkan programs on your own machine you need three things: a C++17 compiler, the Vulkan SDK (or your
Linux distribution's Vulkan packages) and GLFW.

- **The Vulkan SDK** from [LunarG](https://vulkan.lunarg.com/) contains the headers, the standard validation layers,
  debugging tools and the **loader**. The loader is the library you link with (`vulkan-1.lib` on Windows,
  `libvulkan.so` on Linux): it looks up the functions in the driver at run time. The SDK also contains `vkcube`, a
  small demo – run it first to check that your graphics card and driver support Vulkan. Later, the shader compilers
  `glslc` and `glslangValidator` come in handy too.
- **GLFW** from [glfw.org](https://www.glfw.org/download.html) (on Windows the pre-compiled 64-bit binaries are
  fine).

vulkan-tutorial.com also installs GLM, a maths library; you won't need it until transformations.

### Building it yourself

On Linux (Debian/Ubuntu package names; Fedora and Arch have the same under similar names) install the loader, the
validation layers, the tools and GLFW:

```text
sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools libglfw3-dev
```

Then compile `main.cpp` with:

```text
g++ -std=c++17 -o VulkanTest main.cpp -lglfw -lvulkan
```

(vulkan-tutorial.com's makefile uses `-lglfw -lvulkan -ldl -lpthread -lX11 -lXxf86vm -lXrandr -lXi`; with a shared
GLFW the first two are enough.) Don't define `NDEBUG` while you learn – you'll see why under *Validation layers*.
With CMake, `find_package(Vulkan REQUIRED)` and `find_package(glfw3 REQUIRED)` give you the targets `Vulkan::Vulkan`
and `glfw` to link with.

On Windows, install the SDK and unpack GLFW, then in a Visual Studio C++ project add the `Include` folder of the SDK
and GLFW's `include` folder to the include directories, the SDK's `Lib` folder and GLFW's library folder to the
library directories, `vulkan-1.lib` and `glfw3.lib` to the linker input, and set the language standard to C++17.

On macOS the SDK runs Vulkan on top of Metal (MoltenVK). There `vkCreateInstance` can return
`VK_ERROR_INCOMPATIBLE_DRIVER` unless you enable the `VK_KHR_portability_enumeration` instance extension and set
`VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` in the create info's `flags`; the code in this course doesn't, as
it targets Windows and Linux.

## Base code

Your project starts with vulkan-tutorial.com's base code. The program is wrapped into a class where we'll store the
Vulkan objects as private class members and add functions to initiate each of them, which will be called from
`initVulkan`:

```cpp
void run() {
    initWindow();
    initVulkan();
    mainLoop();
    cleanup();
}
```

Once everything has been prepared, `mainLoop` runs until the window is closed, and `cleanup` then frees everything.
If a fatal error occurs we throw a `std::runtime_error` with a descriptive message; `main` catches it, prints it
and returns `EXIT_FAILURE`.

### Resource management

Just like every `malloc` needs a `free`, every Vulkan object that we create needs to be explicitly destroyed when we
no longer need it. Objects are created with functions like `vkCreateXXX` (or allocated with `vkAllocateXXX`) and
destroyed with `vkDestroyXXX` (or `vkFreeXXX`). These functions share a parameter `pAllocator` for custom memory
allocator callbacks; we always pass `nullptr`. Roughly every section that follows adds one function called from
`initVulkan`, one or more class members, and the matching destruction in `cleanup` – in reverse order of creation.

### Integrating GLFW

The file starts with:

```cpp
#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>
```

That way GLFW includes the Vulkan header (`vulkan/vulkan.h`) along with its own. `initWindow` creates the window:

```cpp
void initWindow() {
    glfwInit();

    glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
    glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

    window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
}
```

Because GLFW was originally designed to create an OpenGL context, we need to tell it *not* to create one with
`GLFW_CLIENT_API` set to `GLFW_NO_API`. Handling resized windows takes special care that we'll look into much later,
so it is disabled with `GLFW_RESIZABLE`. The first three parameters of `glfwCreateWindow` are the width, height
(`WIDTH` and `HEIGHT`, 800 and 600) and title; the fourth optionally names a monitor for full screen mode, and the
last one is only relevant to OpenGL.

`mainLoop` keeps the program running and processes events (like pressing the close button) until the window is
closed; `cleanup` destroys the window and terminates GLFW:

```cpp
void mainLoop() {
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
    }
}
```

Build & run the project as it is: a window titled "Vulkan" opens and stays open until you close it. Its content is
black (undefined, really) – nothing will be shown in it until the next chapter presents the first image.

```quiz
Why does `initWindow` call `glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API)`?
- [x] Because GLFW would otherwise create an OpenGL context for the window, which a Vulkan program doesn't use
- [ ] To tell GLFW to load the Vulkan functions
- [ ] To stop the user from resizing the window
- [ ] To make the window full screen
---
GLFW creates an OpenGL context with every window by default. Vulkan talks to the window in its own way (through a
surface, in the next chapter), so we switch the context off. Resizing is switched off by the *other* hint.
```
:::
:::vulkan
## Instance

The very first thing you need to do is initialize the Vulkan library by creating an **instance**. The instance is
the connection between your application and the Vulkan library, and creating it involves specifying some details
about your application to the driver. It is stored in a class member, `VkInstance instance;`, and created in a new
function `createInstance()`, called from `initVulkan`.

To create an instance we first fill in a struct with some information about our application. This data is
technically optional, but it may give the driver useful information to optimize for our application:

```cpp
VkApplicationInfo appInfo{};
appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
appInfo.pApplicationName = "Hello Triangle";
appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.pEngineName = "No Engine";
appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.apiVersion = VK_API_VERSION_1_0;
```

Many structs in Vulkan require you to explicitly specify their type in the `sType` member. This is also one of the
many structs with a `pNext` member that can point to extension information; the value initialization `{}` leaves it
as `nullptr`.

A lot of information in Vulkan is passed through structs instead of function parameters. The next struct is not
optional: it tells the Vulkan driver which global extensions and validation layers we want to use. Global here means
that they apply to the entire program and not to a specific device.

```cpp
VkInstanceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
createInfo.pApplicationInfo = &appInfo;

auto extensions = getRequiredExtensions();
createInfo.enabledExtensionCount = static_cast<uint32_t>(extensions.size());
createInfo.ppEnabledExtensionNames = extensions.data();

createInfo.enabledLayerCount = 0;
```

Vulkan is a platform agnostic API, which means that you need an extension to interface with the window system. GLFW
has a handy function that returns the extensions it needs for that; we collect them in `getRequiredExtensions()`
(it will get one more extension later):

```cpp
std::vector<const char*> getRequiredExtensions() {
    uint32_t glfwExtensionCount = 0;
    const char** glfwExtensions;
    glfwExtensions = glfwGetRequiredInstanceExtensions(&glfwExtensionCount);

    std::vector<const char*> extensions(glfwExtensions, glfwExtensions + glfwExtensionCount);

    return extensions;
}
```

The last two members of the struct determine the global validation layers to enable – none for now. We've now
specified everything Vulkan needs to create an instance:

```cpp
if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS) {
    throw std::runtime_error("failed to create instance!");
}
```

The general pattern that object creation functions in Vulkan follow is: a pointer to a struct with creation info, a
pointer to custom allocator callbacks (always `nullptr` here), and a pointer to the variable that receives the handle
of the new object. Nearly all Vulkan functions return a `VkResult` that is either `VK_SUCCESS` or an error code.

The instance should only be destroyed right before the program exits, in `cleanup`, after every other Vulkan object:

```cpp
vkDestroyInstance(instance, nullptr);
```

Now do the first task: add the `instance` member, write `createInstance()` and `getRequiredExtensions()`, call
`createInstance()` in `initVulkan` and destroy the instance in `cleanup`. Build & run: the window looks the same,
but an instance now exists behind it.

```quiz
Why does `createInstance` enable the extensions returned by `glfwGetRequiredInstanceExtensions`?
- [ ] Because without them `vkCreateInstance` can't find a graphics card
- [ ] Because they turn on the validation layers
- [ ] Because GLFW can't open a window without them
- [x] Because Vulkan is platform agnostic: talking to the window system needs instance extensions (such as `VK_KHR_surface`), and GLFW knows which ones this platform needs
---
The window already exists without Vulkan. The extensions are what lets *Vulkan* present images to it later –
`VK_KHR_surface` plus a platform-specific one such as `VK_KHR_win32_surface` or `VK_KHR_xlib_surface`.
```
:::
:::vulkan
## Validation layers

The Vulkan API is designed around the idea of minimal driver overhead, and one of the manifestations of that goal is
that there is very limited error checking in the API by default. Even mistakes as simple as setting enumerations to
incorrect values or passing null pointers to required parameters generally result in crashes or undefined behavior.

Vulkan introduces an elegant system for this known as **validation layers**: optional components that hook into
Vulkan function calls to apply additional operations – checking parameter values against the specification,
tracking creation and destruction of objects to find resource leaks, checking thread safety, logging calls. You can
enable them for debug builds and completely disable them for release builds, which gives you the best of both
worlds. All of the useful standard validation is bundled into a layer that comes with the SDK, called
`VK_LAYER_KHRONOS_validation`.

We add two configuration variables at the top of the file: the layers to enable, and whether to enable them. The
`NDEBUG` macro is part of the C++ standard and means "not debug":

```cpp
const std::vector<const char*> validationLayers = {
    "VK_LAYER_KHRONOS_validation"
};

#ifdef NDEBUG
const bool enableValidationLayers = false;
#else
const bool enableValidationLayers = true;
#endif
```

A new function `checkValidationLayerSupport` checks if all of the requested layers are available. It uses the
two-call pattern you'll see all over Vulkan: first ask for the number of items, then allocate an array and ask again
to fill it in:

```cpp
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
```

We use it at the top of `createInstance`:

```cpp
if (enableValidationLayers && !checkValidationLayerSupport()) {
    throw std::runtime_error("validation layers requested, but not available!");
}
```

and we replace `createInfo.enabledLayerCount = 0;` with the layer names, if they are enabled:

```cpp
if (enableValidationLayers) {
    createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
    createInfo.ppEnabledLayerNames = validationLayers.data();
} else {
    createInfo.enabledLayerCount = 0;
}
```

Do the second task now. Build & run: if the layer were missing, the program would stop with "validation layers
requested, but not available!".

### Message callback

The validation layers print their messages to the standard output by default, but we can also handle them ourselves
with a callback. That lets you decide which kind of messages you want to see, because not all of them are (fatal)
errors. For that we set up a **debug messenger**, which comes from the `VK_EXT_debug_utils` extension – so the
extension is added in `getRequiredExtensions()` when the layers are enabled:

```cpp
if (enableValidationLayers) {
    extensions.push_back(VK_EXT_DEBUG_UTILS_EXTENSION_NAME);
}
```

The callback is a static member function with the `PFN_vkDebugUtilsMessengerCallbackEXT` prototype; `VKAPI_ATTR`
and `VKAPI_CALL` make sure it has the right signature for Vulkan to call it:

```cpp
static VKAPI_ATTR VkBool32 VKAPI_CALL debugCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData) {
    std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;

    return VK_FALSE;
}
```

`messageSeverity` tells how serious the message is (verbose, info, warning or error), `messageType` whether it is a
general event, a specification violation or a performance hint, and `pCallbackData` holds the details – most
importantly `pMessage`, the message itself. The return value says whether the Vulkan call that triggered the
message should be aborted; that is only meant for testing the layers themselves, so always return `VK_FALSE`.

Even the debug callback is managed with a handle that needs to be explicitly created and destroyed: a class member
`VkDebugUtilsMessengerEXT debugMessenger;`, set up by `setupDebugMessenger()` right after `createInstance()`. The
details go into a `VkDebugUtilsMessengerCreateInfoEXT`, which we fill in a separate function because we'll need it
twice:

```cpp
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
```

`messageSeverity` lists the severities the callback is called for (everything except info here), `messageType` the
types (all of them).

`vkCreateDebugUtilsMessengerEXT` is an extension function, so the loader does not export it: we have to look up its
address ourselves with `vkGetInstanceProcAddr`. Two small proxy functions above the class do that, one for creating
and one for destroying the messenger:

```cpp
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
```

The messenger belongs to the instance, so `cleanup` destroys it before the instance:

```cpp
if (enableValidationLayers) {
    DestroyDebugUtilsMessengerEXT(instance, debugMessenger, nullptr);
}
```

### Debugging instance creation and destruction

There is one gap left: the messenger needs a valid instance, and it must be destroyed before the instance – so
problems inside `vkCreateInstance` and `vkDestroyInstance` themselves would go unreported. The extension has a way
around that: pass a `VkDebugUtilsMessengerCreateInfoEXT` in the `pNext` field of `VkInstanceCreateInfo`, and a
separate messenger is used automatically during those two calls. In `createInstance` the layer code becomes:

```cpp
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
```

`debugCreateInfo` is declared outside the `if` so that it still exists when `vkCreateInstance` is called.

Now do the third task – it touches several places, so follow the TODO comments: the two proxy functions, the
`debugMessenger` member, `debugCallback`, `populateDebugMessengerCreateInfo()` and `setupDebugMessenger()`, the
extension, the `pNext` chain, the call in `initVulkan` and the destruction in `cleanup`. Build & run: the output now
shows lines starting with `validation layer:`. Because we asked for verbose messages too, these are mostly harmless
information from the loader. A correct program shows no messages with `Validation Error` or `Validation Warning` in
them – watch out for those from now on.

```quiz
Why is a `VkDebugUtilsMessengerCreateInfoEXT` also chained into `pNext` of `VkInstanceCreateInfo`?
- [ ] Because `setupDebugMessenger` doesn't work without it
- [x] So that `vkCreateInstance` and `vkDestroyInstance` are checked too: the normal messenger can only exist between those two calls
- [ ] To enable the `VK_EXT_debug_utils` extension
- [ ] To pass the validation layer names to the driver
---
`debugMessenger` needs an instance to be created and must be destroyed before it. The create info in `pNext` gives
those two calls a messenger of their own, which is cleaned up automatically.
```
:::
:::vulkan
## Physical devices and queue families

After initializing the Vulkan library through a `VkInstance` we need to look for and select a graphics card in the
system that supports the features we need. We'll stick to the first graphics card that suits our needs. It is
stored in a new class member:

```cpp
VkPhysicalDevice physicalDevice = VK_NULL_HANDLE;
```

This object is implicitly destroyed when the `VkInstance` is destroyed, so `cleanup` needs nothing new. Listing the
graphics cards in `pickPhysicalDevice()` is very similar to listing the layers – the two-call pattern again:

```cpp
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
```

Not all graphics cards are created equal, so `isDeviceSuitable` checks each one. You could query its properties
(name, type, supported Vulkan version) with `vkGetPhysicalDeviceProperties` and its optional features (like geometry
shaders) with `vkGetPhysicalDeviceFeatures`, and for example prefer a discrete GPU by giving every device a score.
For now we only need one thing: a queue that can do graphics.

### Queue families

Almost every operation in Vulkan, anything from drawing to uploading textures, requires commands to be submitted to
a **queue**. There are different types of queues that originate from different **queue families**, and each family
of queues allows only a subset of commands: there could be a family that only allows compute commands, or one that
only allows memory transfers. We need a queue family that supports graphics commands, and we bundle its index into
a struct, because a later chapter looks for a second queue family:

```cpp
struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;

    bool isComplete() {
        return graphicsFamily.has_value();
    }
};
```

Any value of `uint32_t` could in theory be a valid queue family index, including `0`, so there is no "magic" value
that could mean "not found". `std::optional` (C++17) solves that: it contains no value until you assign something
to it, and `has_value()` tells you whether it does.

`findQueueFamilies` retrieves the list of queue families with `vkGetPhysicalDeviceQueueFamilyProperties` and looks
for one with `VK_QUEUE_GRAPHICS_BIT`; `isDeviceSuitable` accepts a device if it has one:

```cpp
bool isDeviceSuitable(VkPhysicalDevice device) {
    QueueFamilyIndices indices = findQueueFamilies(device);

    return indices.isComplete();
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

        if (indices.isComplete()) {
            break;
        }

        i++;
    }

    return indices;
}
```

Do the fourth task: add the struct, the member, the three functions, and call `pickPhysicalDevice()` after
`setupDebugMessenger()`. Build & run – the window is unchanged, and if no Vulkan device fits, the program stops with
"failed to find a suitable GPU!".

```quiz
Why does `QueueFamilyIndices` store the graphics family as `std::optional<uint32_t>` instead of a plain `uint32_t`?
- [ ] Because queue family indices can be negative
- [ ] Because `std::optional` makes the lookup faster
- [x] Because every `uint32_t` value, including `0`, could be a valid index – so a plain number can't say "not found"
- [ ] Because Vulkan requires `std::optional` in its structs
---
`std::optional` adds the missing "no value" state: `graphicsFamily.has_value()` is only true once a family with
`VK_QUEUE_GRAPHICS_BIT` has been found.
```
:::
:::vulkan
## Logical device and queues

After selecting a physical device we need to set up a **logical device** to interface with it. Its creation is
similar to the instance creation: it describes the features we want to use, and which queues to create now that we
know which queue families are available. New class members hold the device and its queue:

```cpp
VkDevice device;

VkQueue graphicsQueue;
```

`createLogicalDevice()`, called after `pickPhysicalDevice()`, first describes the queues we want for a single queue
family – one queue with graphics capabilities:

```cpp
QueueFamilyIndices indices = findQueueFamilies(physicalDevice);

VkDeviceQueueCreateInfo queueCreateInfo{};
queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
queueCreateInfo.queueFamilyIndex = indices.graphicsFamily.value();
queueCreateInfo.queueCount = 1;

float queuePriority = 1.0f;
queueCreateInfo.pQueuePriorities = &queuePriority;
```

You don't really need more than one queue per family: you can record command buffers on many threads and submit
them all at once on one queue. Vulkan lets you assign priorities (between `0.0` and `1.0`) to queues to influence
their scheduling; this is required even if there is only a single queue.

Next come the device features we'll use – the ones you could query with `vkGetPhysicalDeviceFeatures`. We don't need
anything special yet, so everything stays `VK_FALSE`. Then the main struct:

```cpp
VkPhysicalDeviceFeatures deviceFeatures{};

VkDeviceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;

createInfo.pQueueCreateInfos = &queueCreateInfo;
createInfo.queueCreateInfoCount = 1;

createInfo.pEnabledFeatures = &deviceFeatures;

createInfo.enabledExtensionCount = 0;

if (enableValidationLayers) {
    createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
    createInfo.ppEnabledLayerNames = validationLayers.data();
} else {
    createInfo.enabledLayerCount = 0;
}
```

Like the instance, the device can have extensions – this time device specific ones, like `VK_KHR_swapchain` in the
next chapter; none yet. Up-to-date implementations ignore the device's layer fields (there are no device-only layers
any more), but older ones need them, so we pass the same layers as for the instance. Now we create the device and
get the handle of its queue:

```cpp
if (vkCreateDevice(physicalDevice, &createInfo, nullptr, &device) != VK_SUCCESS) {
    throw std::runtime_error("failed to create logical device!");
}

vkGetDeviceQueue(device, indices.graphicsFamily.value(), 0, &graphicsQueue);
```

The queue is created along with the device; `vkGetDeviceQueue` only gives us its handle – queue family, queue index
(`0`, the only one) and where to store it. Queues are implicitly cleaned up when the device is destroyed. The device
itself is destroyed first in `cleanup`:

```cpp
vkDestroyDevice(device, nullptr);
```

Do the last task. Build & run: the window opens as before, there are no validation errors, and the program exits
cleanly when you close the window. With the logical device and the queue handle we can actually start using the
graphics card – in the next chapter we connect it to the window and show the first image.

```quiz
Which of these objects does `cleanup()` destroy explicitly? (Choose all that apply.)
- [ ] The physical device
- [ ] The graphics queue
- [x] The logical device (`vkDestroyDevice`)
- [x] The instance (`vkDestroyInstance`)
- [x] The debug messenger (`DestroyDebugUtilsMessengerEXT`)
---
Everything you create is destroyed, in reverse order. The physical device and the queue are not created by you – they
are only retrieved – and go away together with the instance and the device.
```
:::
:::vulkan
## Additional resources

- vulkan-tutorial.com: [Development environment](https://vulkan-tutorial.com/Development_environment),
  [Instance](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Instance),
  [Validation layers](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Validation_layers),
  [Physical devices and queue families](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Physical_devices_and_queue_families) and
  [Logical device and queues](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Logical_device_and_queues) – the
  chapters this one follows.
- The [Vulkan SDK](https://vulkan.lunarg.com/) and its getting started guides.
:::
:::d3d12
## Development environment

Everything you need for Direct3D 12 comes with Windows and Visual Studio:

- **Visual Studio** with the **Desktop development with C++** workload. It installs the compiler and the
  **Windows SDK**, which contains the headers the project includes – `d3d12.h`, `dxgi1_6.h`, `d3dcompiler.h`,
  `DirectXMath.h`, `wrl.h` – and the import libraries `d3d12.lib`, `dxgi.lib` and `d3dcompiler.lib`.
- **d3dx12.h**, a header-only helper library for D3D12 (the `CD3DX12_...` structs). It isn't in the Windows SDK; it
  comes from Microsoft's [DirectX-Headers](https://github.com/microsoft/DirectX-Headers) repository, in the
  `include/directx` folder (which also contains a matching, newer `d3d12.h`). You can also get it through vcpkg
  (`directx-headers`).
- **The Graphics Tools** optional feature of Windows (Settings → System → Optional features → Add an optional
  feature). It contains the D3D12 debug layer, which we turn on below.

The libraries are linked by three lines at the top of `main.cpp`, which only the Microsoft compiler reads:

```cpp
#if defined(_MSC_VER)
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3dcompiler.lib")
#endif
```

### Building it yourself

In Visual Studio, create an empty C++ project, add `main.cpp`, add DirectX-Headers' `include/directx` folder to the
include directories, and set **Linker → System → SubSystem** to **Windows**: the program starts in `wWinMain`, the
entry point of a Windows (not console) program. Build the **Debug** configuration – it defines `_DEBUG`, which turns
on the debug layer code. From a *Developer Command Prompt*, the same is:

```text
cl /std:c++17 /EHsc /MDd /Zi /I DirectX-Headers\include\directx main.cpp /link /SUBSYSTEM:WINDOWS user32.lib
```

(`/MDd` selects the debug runtime and defines `_DEBUG`; `user32.lib` has the window functions.)

## The Win32 window

The window part of the program is finished in your project; it is what the samples' `Win32Application` class does.
`wWinMain` first describes and registers a **window class** – the kind of window we want, and the function that
handles its messages:

```cpp
WNDCLASSEXW windowClass = {};
windowClass.cbSize = sizeof(WNDCLASSEXW);
windowClass.style = CS_HREDRAW | CS_VREDRAW;
windowClass.lpfnWndProc = WindowProc;
windowClass.hInstance = hInstance;
windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
windowClass.lpszClassName = L"DXSampleClass";
RegisterClassExW(&windowClass);
```

The window has a title bar and borders, but we want the area we draw in – the **client area** – to be exactly
800×600. `AdjustWindowRect` computes the size of the whole window for that client area, and `CreateWindowW` creates
the window:

```cpp
RECT windowRect = { 0, 0, static_cast<LONG>(width), static_cast<LONG>(height) };
AdjustWindowRect(&windowRect, WS_OVERLAPPEDWINDOW, FALSE);

HWND hwnd = CreateWindowW(
    windowClass.lpszClassName,
    L"LearnDirectX",
    WS_OVERLAPPEDWINDOW,
    CW_USEDEFAULT,
    CW_USEDEFAULT,
    windowRect.right - windowRect.left,
    windowRect.bottom - windowRect.top,
    nullptr,        // We have no parent window.
    nullptr,        // We aren't using menus.
    hInstance,
    nullptr);
```

The `HWND` it returns is the window's handle: Direct3D will need it later to show images in the window. Then
`app.OnInit(hwnd)` sets up Direct3D (it calls `LoadPipeline()`, where all of this chapter's code goes), the window is
shown, and the **message loop** runs until the window is closed:

```cpp
MSG msg = {};
while (msg.message != WM_QUIT)
{
    if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}
```

Windows tells a program about everything that happens to its windows – key presses, mouse moves, resizing, the close
button – with *messages*. `PeekMessage` takes the next message if there is one and returns immediately if there
isn't (unlike `GetMessage`, which waits), so the loop can later render frames in between. `DispatchMessage` passes
each message to `WindowProc`, which only handles `WM_DESTROY`, sent when the window is being destroyed:

```cpp
case WM_DESTROY:
    PostQuitMessage(0);
    return 0;
```

`PostQuitMessage` puts a `WM_QUIT` message in the queue, which ends the loop. Every other message goes to
`DefWindowProc`, Windows' default handling – which, for example, destroys the window when you press the close button.

Build & run the project as it is: a window titled "LearnDirectX" opens and stays open until you close it. Nothing is
drawn into it – that only happens once there is a swap chain, in the next chapter.

```quiz
Why does `wWinMain` call `AdjustWindowRect` before `CreateWindowW`?
- [ ] To make the window resizable
- [x] Because the size given to `CreateWindowW` includes the title bar and borders: `AdjustWindowRect` computes the window size that leaves a client area of exactly 800×600
- [ ] Because Direct3D 12 requires it before it can create a device
- [ ] To centre the window on the screen
---
We draw into the client area, so that is the part that must be 800×600. `AdjustWindowRect` adds the size of the
frame that the `WS_OVERLAPPEDWINDOW` style puts around it.
```
:::
:::d3d12
## COM objects, HRESULT and ThrowIfFailed

Direct3D 12 and DXGI are made of **COM** interfaces (`ID3D12Device`, `IDXGIFactory4` …). You never create these
objects with `new`; a function creates them and hands you an interface pointer, and you release it when you're done.
The project uses **`ComPtr`** (from `wrl.h`), a smart pointer that releases the object automatically when it goes
away. Three of its members appear in this chapter: `Get()` returns the raw pointer, `&` gives the address to fill in
(releasing whatever it held before), and `Detach()` hands the pointer over without releasing it.

The creation functions take the interface you want and the pointer to fill in. The macro `IID_PPV_ARGS(&ptr)` writes
both for you: the interface ID (taken from the pointer's type) and the address.

Almost every call returns an **`HRESULT`**, a result code that is negative on failure; the macros `SUCCEEDED` and
`FAILED` test it. The project's `ThrowIfFailed` turns a failure into an exception, which `wWinMain` shows in a message
box. That way no error goes unnoticed.

## The DXGI factory

**DXGI** (the DirectX Graphics Infrastructure) is the part of Windows that knows the graphics adapters in the system
and the monitors connected to them, and that creates the *swap chains* which show the rendered images in a window.
Direct3D 12 itself only talks to a device. Everything starts with a DXGI **factory**:

```cpp
ComPtr<IDXGIFactory4> factory;
ThrowIfFailed(CreateDXGIFactory2(0, IID_PPV_ARGS(&factory)));
```

`IDXGIFactory4` is the factory version the D3D12 samples use; the first parameter of `CreateDXGIFactory2` holds
creation flags (none for now – that changes in the next step).

Now do the first task: create the factory where the `// TODO: create the DXGI factory` comment is. Build & run: the
window looks the same.

```quiz
What is DXGI responsible for? (Choose all that apply.)
- [ ] Recording draw commands
- [x] Creating the swap chains that show images in a window
- [x] Enumerating the graphics adapters in the system
- [ ] Compiling HLSL shaders
---
DXGI handles what is shared by all Direct3D versions: adapters, outputs and swap chains. Shaders are compiled by the
shader compiler (`d3dcompiler`), and commands are recorded into Direct3D 12 command lists.
```
:::
:::d3d12
## The debug layer

Like Vulkan, Direct3D 12 does very little error checking by itself, to keep the driver overhead low: a wrong
parameter can simply crash or give a black screen. The **debug layer** checks every call and reports mistakes, with
an explanation, in the debugger's output window. It has to be enabled **before** the device is created – enabling it
afterwards removes the device. So this code goes at the very top of `LoadPipeline`, above the factory:

```cpp
UINT dxgiFactoryFlags = 0;

#if defined(_DEBUG)
// Enable the debug layer (requires the Graphics Tools "optional feature").
// NOTE: Enabling the debug layer after device creation will invalidate the active device.
{
    ComPtr<ID3D12Debug> debugController;
    if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
    {
        debugController->EnableDebugLayer();

        // Enable additional debug layers.
        dxgiFactoryFlags |= DXGI_CREATE_FACTORY_DEBUG;
    }
}
#endif
```

`D3D12GetDebugInterface` gets the debug interface (it fails if the Graphics Tools aren't installed – then we simply
go on without it), and `EnableDebugLayer` switches the layer on. The flag `DXGI_CREATE_FACTORY_DEBUG` asks for DXGI's
own debug checks as well, so the factory is now created with the collected flags instead of `0`:

```cpp
ThrowIfFailed(CreateDXGIFactory2(dxgiFactoryFlags, IID_PPV_ARGS(&factory)));
```

All of it sits between `#if defined(_DEBUG)` and `#endif`: the checks cost time, so release builds leave them out.
Do the second task now.

```quiz
Why must the debug layer be enabled before `D3D12CreateDevice` is called?
- [ ] Because the debug layer creates the device itself
- [ ] Because `D3D12GetDebugInterface` needs the DXGI factory
- [ ] It doesn't have to be – it can be switched on at any time
- [x] Because enabling it after the device has been created removes (invalidates) that device
---
The debug layer wraps the device when it is created. That is why the samples enable it first thing in
`LoadPipeline`, before the factory and the device.
```
:::
:::d3d12
## Adapters and the device

An **adapter** is a graphics card – or a software renderer such as the "Microsoft Basic Render Driver". We want the
first hardware adapter that supports Direct3D 12. That's the job of `GetHardwareAdapter`:

```cpp
ComPtr<IDXGIAdapter1> adapter;
for (UINT adapterIndex = 0; SUCCEEDED(pFactory->EnumAdapters1(adapterIndex, &adapter)); ++adapterIndex)
{
    DXGI_ADAPTER_DESC1 desc;
    adapter->GetDesc1(&desc);

    if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE)
    {
        // Don't select the Basic Render Driver adapter.
        continue;
    }

    // Check to see whether the adapter supports Direct3D 12, but don't create the
    // actual device yet.
    if (SUCCEEDED(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)))
    {
        break;
    }
}

*ppAdapter = adapter.Detach();
```

`EnumAdapters1` returns the adapter with the given index, and fails (`DXGI_ERROR_NOT_FOUND`) once the index is past
the last one – that ends the loop. `GetDesc1` describes the adapter (its name, its memory, its flags); software
adapters are skipped. To test whether an adapter supports Direct3D 12, `D3D12CreateDevice` is called with `nullptr`
as the last argument: then it only checks whether a device *could* be created, and doesn't create one. The first
adapter that passes is handed to the caller with `Detach()`. If none passes, the loop ends with an empty `adapter`
and `*ppAdapter` is `nullptr` – and `D3D12CreateDevice` then uses the default adapter. (The current samples first try
`IDXGIFactory6::EnumAdapterByGpuPreference`, which can prefer the high-performance GPU in a laptop; the simple loop
is their fallback.)

### Feature levels

The second argument of `D3D12CreateDevice` is the **minimum feature level**. A feature level is a well-defined set
of GPU functionality: `D3D_FEATURE_LEVEL_11_0` is what Direct3D 11 hardware can do, and higher levels (11_1, 12_0,
12_1, 12_2) add more. Every Direct3D 12 driver supports at least 11_0, so asking for 11_0 – like the samples do –
accepts every card that runs Direct3D 12. A feature level says what a card *can do*, not how fast it is.

With an adapter chosen, `LoadPipeline` creates the **device** – the object that represents the adapter and creates
every other Direct3D 12 object:

```cpp
ComPtr<IDXGIAdapter1> hardwareAdapter;
GetHardwareAdapter(factory.Get(), &hardwareAdapter);

ThrowIfFailed(D3D12CreateDevice(
    hardwareAdapter.Get(),
    D3D_FEATURE_LEVEL_11_0,
    IID_PPV_ARGS(&m_device)
    ));
```

The device is stored in the member `m_device`. Do the third task: fill in the body of `GetHardwareAdapter` and
create the device in `LoadPipeline`. (The samples can also use **WARP**, Windows' software rasterizer, via
`factory->EnumWarpAdapter` – useful on machines without a suitable GPU; we leave that out.)

```quiz
In `GetHardwareAdapter`, what does `D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)` do?
- [ ] It creates the device that `LoadPipeline` uses
- [ ] It turns on feature level 11_0 for the adapter
- [ ] It creates a software (WARP) device
- [x] It only tests whether a Direct3D 12 device could be created on this adapter; with `nullptr` as the last argument no device is created
---
Passing `nullptr` for the device pointer makes `D3D12CreateDevice` a check. The real device is created afterwards in
`LoadPipeline`, on the adapter that passed.
```
:::
:::d3d12
## The command queue

In Direct3D 12 the CPU doesn't call drawing functions on the device. Instead it records commands into **command
lists**, and hands the finished lists to the GPU through a **command queue**; the GPU works through the queue on its
own. The queue is described by a `D3D12_COMMAND_QUEUE_DESC` and created by the device:

```cpp
// Describe and create the command queue.
D3D12_COMMAND_QUEUE_DESC queueDesc = {};
queueDesc.Flags = D3D12_COMMAND_QUEUE_FLAG_NONE;
queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;

ThrowIfFailed(m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue)));
```

There are queue types for compute work (`D3D12_COMMAND_LIST_TYPE_COMPUTE`) and for copies
(`D3D12_COMMAND_LIST_TYPE_COPY`); a **direct** queue accepts every kind of command – drawing, compute and copying –
which is what we need. This is the same idea as Vulkan's queue families.

Do the last task: create the command queue at the end of `LoadPipeline`. Build & run: the window opens as before and
closes cleanly. Nothing in `OnDestroy` has to be released by hand – the `ComPtr` members release the queue and the
device. In the next chapter the queue gets a swap chain, and you clear the window with a colour.

```quiz
Why is the command queue created with `D3D12_COMMAND_LIST_TYPE_DIRECT`?
- [ ] Because it is the only type a device can create
- [ ] Because direct queues bypass the command lists
- [ ] Because the debug layer requires it
- [x] Because a direct queue accepts every kind of command – drawing, compute and copies
---
Compute and copy queues only take a subset of commands. To draw, we need a direct queue.
```
:::
:::d3d12
## Additional resources

- [Creating a basic Direct3D 12 component](https://learn.microsoft.com/en-us/windows/win32/direct3d12/creating-a-basic-direct3d-12-component)
  on Microsoft Learn: the call flow of the hello-world samples, step by step.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  headers, libraries and the debug layer.
- The [D3D12HelloWorld samples](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld)
  this course follows.
:::
