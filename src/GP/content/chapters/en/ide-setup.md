# Setting up your IDE

From the next chapter on you write code – and you write it the way graphics programmers do: in a real IDE, with a
real compiler, building a program that opens a real window on your own machine. This app is your textbook and your
checker. It shows the text, the tasks and a picture of the result each task should give, and it watches the folder
your project is in: when you have built and run your program, it checks your code and ticks the task.

learnopengl.com spends a good part of its *Creating a window* chapter on setting up a project, and so does
vulkan-tutorial.com with its *Development environment* chapter. This chapter does the same for the three APIs of
this course: you choose an IDE, install a compiler and CMake, get the libraries {{api}} needs, write a small
`CMakeLists.txt`, and learn how the **Your project** panel follows what you do. It has no tasks, but its start files
are the triangle program from the introduction, so at the end you can check that everything works.

## How you work in this course

Every chapter with tasks comes with **start files**: `main.cpp`, and from later chapters on also headers, shader
files, textures, models and fonts. The `// TODO:` comments in them mark where your code goes. The **Your project**
panel connects a chapter with a folder on your disk:

1. **Choose folder…** picks the folder for this chapter. Use a new, empty folder for every chapter. Once you have
   chosen one, the app suggests the next ones itself, as `<base>/<api>/<chapter>` – for example
   `learn/opengl/hello-window` next to `learn/opengl/creating-a-window`.
2. **Copy start files** copies the chapter's start files into the folder. If a file is already there, the app asks
   before it overwrites it.
3. You add your `CMakeLists.txt` (the same one for every chapter of an API – see below) and open the folder in your
   IDE. **Open folder** opens it in your file manager.
4. You write the code of a task, **build** the program and **run** it from your IDE.

The app sees both steps. A build counts when the folder contains a program (an `.exe` on Windows, an executable file
on Linux and macOS) that is newer than all your source files, shaders included. A run counts when that program is
started after the build. Then the app checks your source files in the background with the course's own checks for
the task, and ticks it if they pass. If something is missing, the task says *not yet* together with what the check
missed. For every task the panel also shows the **Expected result**: a picture of what your window should look like
once the task is done, so you can compare it with what your program draws.

The status of each task reads *locked* (answer the questions in the text first), *waiting for build*, *waiting for
run*, *checking*, *done* or *not yet*, and a small line shows when the app last saw a build and a run.

Sometimes the app can't see your program start: when you build in WSL, on another machine, or in an IDE that runs
in a sandbox. For those cases there is a small link, **I ran it**. It still requires a build that is newer than your
sources – unless the app finds no program in the folder at all, in which case it tells you so.

```quiz
You finish a task in `main.cpp` and save the file. What has to happen before the app can tick the task? (Choose all that apply.)
- [x] You build the program, so that the folder contains a program newer than your sources
- [ ] You copy the start files again
- [x] You run the program you just built
- [ ] You open the folder with **Open folder**
---
The app waits for a fresh build and for a run of that build. Then it checks your source files with the course's
checks for the task. Copying the start files again would overwrite your work.
```

## Choosing an IDE

Any C++ IDE will do, but the course gives steps for four of them:

| IDE | Runs on | Cost | Good to know |
|---|---|---|---|
| [Visual Studio](https://visualstudio.microsoft.com/) | Windows | The Community edition is free for individuals, students, open-source work and small teams | Comes with Microsoft's compiler (MSVC), the Windows SDK and CMake; the best choice for DirectX 12 |
| [CLion](https://www.jetbrains.com/clion/) | Windows, macOS, Linux | Free for non-commercial use; a paid licence for commercial work | Built around CMake; brings its own CMake, and on Windows its own MinGW compiler |
| [Rider](https://www.jetbrains.com/rider/) | Windows, macOS, Linux | Free for non-commercial use; a paid licence for commercial work | Its C++ support is for Visual Studio solutions (and Unreal Engine), which in practice means Windows with Microsoft's build tools |
| [Visual Studio Code](https://code.visualstudio.com/) | Windows, macOS, Linux | Free | An editor that becomes a C++ IDE with Microsoft's **C/C++** and **CMake Tools** extensions; you install the compiler and CMake yourself |

:::opengl
For OpenGL every one of them works. On Windows, Visual Studio is what learnopengl.com uses; on Linux and macOS,
CLion or VS Code. macOS still runs OpenGL up to version 4.1 – deprecated, but enough for this course's 3.3 core
profile.
:::
:::vulkan
For Vulkan every one of them works. vulkan-tutorial.com shows Visual Studio on Windows and a makefile on Linux; with
CMake, CLion and VS Code work the same on all three systems. On macOS, Vulkan runs on top of Metal through MoltenVK
(more on that below).
:::
:::d3d12
Direct3D 12 only exists on Windows, and Microsoft's samples are Visual Studio solutions, so Visual Studio is the
natural choice. CLion and VS Code work too, as long as they use Microsoft's compiler (MSVC); Rider opens the same
solutions as Visual Studio.
:::

```quiz
You work on a Mac. Which of these IDEs can you use for this course's CMake projects? (Choose all that apply.)
- [x] CLion
- [ ] Visual Studio
- [x] Visual Studio Code with the C/C++ and CMake Tools extensions
- [ ] Rider
---
Visual Studio runs only on Windows. Rider runs on macOS, but its C++ support is for Visual Studio solutions and
Unreal Engine – not for CMake projects. CLion and VS Code open a `CMakeLists.txt` on every system.
```

## A compiler and CMake

Your IDE needs a C++17 compiler:

- **Windows:** Microsoft's compiler, **MSVC**. It comes with Visual Studio's **Desktop development with C++** workload
  (which also installs the Windows SDK and CMake). If you use another IDE, install the *Build Tools for Visual
  Studio* with the same workload. MinGW-w64 (GCC) and Clang work for OpenGL and Vulkan as well – CLion even brings
  MinGW along – but the DirectX 12 code is written for MSVC.
- **Linux:** GCC or Clang from your distribution, for example on Debian and Ubuntu:

  ```text
  sudo apt install build-essential cmake ninja-build git
  ```

- **macOS:** Apple's Clang from the **Xcode Command Line Tools** (`xcode-select --install` in a terminal), and CMake
  from [cmake.org](https://cmake.org/download/) or Homebrew (`brew install cmake`).

**CMake** describes a project in a file called `CMakeLists.txt`: which sources make up the program, which libraries
it uses and where they are. From that file CMake generates the build files for your compiler (Ninja files,
makefiles or a Visual Studio solution), which the IDE then builds. All four IDEs understand it, so one
`CMakeLists.txt` works everywhere. Visual Studio and CLion bring CMake along; for VS Code you install it yourself.
The `CMakeLists.txt` below needs CMake 3.24 or newer, and Git, which CMake uses to download libraries.

## The libraries for {{api}}

:::opengl
OpenGL itself needs nothing to install: it comes with your graphics driver. What you do need are the libraries the
learnopengl.com code uses:

- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) creates the window and the OpenGL context and gives you
  keyboard and mouse input. The `CMakeLists.txt` below downloads and builds it for you, unless it finds an installed
  GLFW (on Linux `libglfw3-dev` or your distribution's equivalent, on macOS `brew install glfw`).
- **GLAD** loads the OpenGL functions at run time. You generate it on [glad.dav1d.de](https://glad.dav1d.de/):
  language **C/C++**, specification **OpenGL**, API **gl** version **3.3**, profile **Core**, **Generate a loader**
  ticked, then **Generate**. The zip file contains `include/glad/glad.h`, `include/KHR/khrplatform.h` and
  `src/glad.c`. ([gen.glad.sh](https://gen.glad.sh/) is the generator of GLAD 2, whose functions have other names;
  the course's code uses GLAD 1's `gladLoadGLLoader`.)
- **GLM** ([github.com/g-truc/glm](https://github.com/g-truc/glm)), the maths library, from *Transformations* on.
  The `CMakeLists.txt` downloads it as well.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), one header, `stb_image.h`, that loads
  images, from *Textures* on.
- Later, **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  for *Model Loading*, and **FreeType** ([freetype.org](https://freetype.org/)) for *Text Rendering*. Those chapters
  tell you what to add.

```quiz
Why does the course generate GLAD on glad.dav1d.de rather than on gen.glad.sh?
- [ ] Because gen.glad.sh can't generate a loader for OpenGL 3.3
- [x] Because gen.glad.sh makes GLAD 2, whose functions have other names, and the course's code calls GLAD 1's `gladLoadGLLoader`
- [ ] Because only glad.dav1d.de includes `glad.c`
---
Both generators produce a loader for OpenGL 3.3 core. They differ in the generated API: the code in this course is
written for GLAD 1, as learnopengl.com's is.
```
:::
:::vulkan
- **The Vulkan SDK** from LunarG ([vulkan.lunarg.com](https://vulkan.lunarg.com/)), for Windows, Linux and macOS. It
  contains the Vulkan headers, the **loader** your program links with, the **validation layers**
  (`VK_LAYER_KHRONOS_validation`), the shader compiler **glslc** that turns your GLSL into SPIR-V, and `vkcube`, a
  small demo – run it first to see that your graphics card and driver support Vulkan. On Linux you can use your
  distribution's packages instead, for example on Debian and Ubuntu:

  ```text
  sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools glslc libglfw3-dev libglm-dev
  ```

- **macOS:** the SDK runs Vulkan on top of Metal with **MoltenVK**, which it includes. There `vkCreateInstance` can
  return `VK_ERROR_INCOMPATIBLE_DRIVER` unless you enable the `VK_KHR_portability_enumeration` instance extension
  and set `VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` in the create info's `flags`; the course's code targets
  Windows and Linux and doesn't do that.
- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) for the window, and **GLM**
  ([github.com/g-truc/glm](https://github.com/g-truc/glm)) for the maths. The `CMakeLists.txt` below downloads and
  builds both, unless it finds installed ones.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), one header, `stb_image.h`, from
  *Textures* on, and **tinyobjloader** ([github.com/tinyobjloader/tinyobjloader](https://github.com/tinyobjloader/tinyobjloader)),
  one header, `tiny_obj_loader.h`, for the models, as in vulkan-tutorial.com.
- Later, **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  and **FreeType** ([freetype.org](https://freetype.org/)). Those chapters tell you what to add.

```quiz
What does glslc, which comes with the Vulkan SDK, do for your project?
- [ ] It checks your Vulkan calls while the program runs
- [ ] It loads the Vulkan functions from the driver
- [x] It compiles your GLSL shaders to SPIR-V, the form Vulkan loads
---
Vulkan doesn't take GLSL source: it takes SPIR-V. The validation layers check your calls at run time, and the loader
finds the driver's functions.
```
:::
:::d3d12
- **Windows 10 or 11** and a graphics card with a Direct3D 12 driver.
- **Visual Studio** with the **Desktop development with C++** workload: the MSVC compiler and the **Windows SDK**,
  which contains `d3d12.h`, `dxgi1_6.h`, `d3dcompiler.h`, **DirectXMath** (`DirectXMath.h`) and the libraries
  `d3d12.lib`, `dxgi.lib` and `d3dcompiler.lib`. (With another IDE: the *Build Tools for Visual Studio* with the same
  workload.)
- **d3dx12.h**, the header-only helper library with the `CD3DX12_...` structs. It isn't in the Windows SDK; it comes
  from Microsoft's [DirectX-Headers](https://github.com/microsoft/DirectX-Headers) repository, in the
  `include/directx` folder.
- **The shader compiler.** The course compiles its HLSL when the program starts, with `D3DCompileFromFile` from the
  D3DCompiler library (shader model 5.0). Its DLL, `d3dcompiler_47.dll`, comes with Windows. The newer compiler, DXC
  (shader model 6), is in the Windows SDK as well; you don't need it for this course.
- **The debug layer**, which checks your Direct3D 12 calls, is part of the **Graphics Tools** optional feature of
  Windows (Settings → System → Optional features → Add an optional feature).
- **PIX**, Microsoft's free GPU debugger for Direct3D 12, is optional but very useful when a frame doesn't look
  right.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), one header, `stb_image.h`, from
  *Textures* on; later **Assimp** ([assimp.org](https://www.assimp.org/),
  [github.com/assimp/assimp](https://github.com/assimp/assimp)) and **FreeType**
  ([freetype.org](https://freetype.org/)). Those chapters tell you what to add.

```quiz
Where does `d3dx12.h` come from?
- [ ] From the Windows SDK, next to `d3d12.h`
- [ ] From the Graphics Tools optional feature
- [ ] From DirectXMath
- [x] From Microsoft's DirectX-Headers repository on GitHub, in `include/directx`
---
`d3dx12.h` is a helper library that Microsoft publishes separately from the SDK. The Graphics Tools contain the
debug layer, and DirectXMath is the maths library.
```
:::

## The folders

Every chapter gets its own folder, and the libraries that are just files – the ones you download yourself – go into
one `libs` folder that all chapters share:

:::opengl
```text
learn/
  libs/
    glad/        include/glad/glad.h, include/KHR/khrplatform.h, src/glad.c
    stb/         stb_image.h
  opengl/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-window/
      ...
```
:::
:::vulkan
```text
learn/
  libs/
    stb/             stb_image.h
    tinyobjloader/   tiny_obj_loader.h
  vulkan/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-triangle/
      CMakeLists.txt
      main.cpp
      shaders/shader.vert, shaders/shader.frag
    ...
```
:::
:::d3d12
```text
learn/
  libs/
    DirectX-Headers/   the repository: include/directx/d3dx12.h …
    stb/               stb_image.h
  d3d12/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-triangle/
      CMakeLists.txt
      main.cpp
      shaders.hlsl
    ...
```
:::

Keep your IDE's build folder inside the chapter folder – all four IDEs do that by default – so that the app finds the
program you build.

The programs load their shaders, textures and models with paths relative to the **working directory**, the folder a
program runs in: `"shaders/vert.spv"`, `"container.png"`, `L"shaders.hlsl"`. The start files put those files in the
chapter folder, so the program has to run with the chapter folder as its working directory. The steps for each IDE
below say how.

```quiz
Your program builds, but when it starts it stops with an error that it can't open one of its shader files. The file is in the chapter folder. What is the most likely cause?
- [ ] The app hasn't checked the task yet
- [ ] The shader file is older than the program
- [x] The program runs with another working directory than the chapter folder – usually the build folder
- [ ] The libs folder is missing
---
Relative paths are resolved from the working directory. IDEs often run a program in the folder it was built in, so
set the working directory to the chapter folder (the `CMakeLists.txt` below does that for Visual Studio).
```

## A CMakeLists.txt

This is all a chapter needs. Put it into each chapter folder next to the start files – it is the same file for every
chapter of the course.

:::opengl
```text
cmake_minimum_required(VERSION 3.24)
project(LearnOpenGL C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# GLFW and GLM: the installed ones if CMake finds them, otherwise downloaded and built from source
include(FetchContent)
FetchContent_Declare(glfw3 GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4 FIND_PACKAGE_ARGS)
FetchContent_Declare(glm GIT_REPOSITORY https://github.com/g-truc/glm.git GIT_TAG 1.0.1 FIND_PACKAGE_ARGS)
FetchContent_MakeAvailable(glfw3 glm)

# GLAD and stb_image: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

add_executable(LearnOpenGL main.cpp ${LIBS}/glad/src/glad.c)
target_include_directories(LearnOpenGL PRIVATE ${LIBS}/glad/include ${LIBS}/stb)
target_link_libraries(LearnOpenGL PRIVATE glfw glm::glm ${CMAKE_DL_LIBS})

# Visual Studio: run the program in the chapter folder, where its shaders and textures are
set_target_properties(LearnOpenGL PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
file(GLOB SHADERS CONFIGURE_DEPENDS *.vs *.fs *.gs *.tcs *.tes *.comp)
set_target_properties(LearnOpenGL PROPERTIES LINK_DEPENDS "${SHADERS}")
```

On Linux, install your distribution's GLFW package: building GLFW from source there also needs the X11 and Wayland
development packages. You don't have to link `opengl32.lib` or `libGL` yourself – GLFW creates the context and GLAD
asks it for every function.
:::
:::vulkan
```text
cmake_minimum_required(VERSION 3.24)
project(LearnVulkan CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Vulkan REQUIRED COMPONENTS glslc)

# GLFW and GLM: the installed ones if CMake finds them, otherwise downloaded and built from source
include(FetchContent)
FetchContent_Declare(glfw3 GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4 FIND_PACKAGE_ARGS)
FetchContent_Declare(glm GIT_REPOSITORY https://github.com/g-truc/glm.git GIT_TAG 1.0.1 FIND_PACKAGE_ARGS)
FetchContent_MakeAvailable(glfw3 glm)

# stb_image and tinyobjloader: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

add_executable(LearnVulkan main.cpp)
target_include_directories(LearnVulkan PRIVATE ${LIBS}/stb ${LIBS}/tinyobjloader)
target_link_libraries(LearnVulkan PRIVATE Vulkan::Vulkan glfw glm::glm)

# Visual Studio: run the program in the chapter folder, where its shaders and textures are
set_target_properties(LearnVulkan PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

# Compile every shader in shaders/ to SPIR-V next to it:
# shader.vert -> vert.spv (vulkan-tutorial's names), any other name.vert -> name.vert.spv
file(GLOB SHADERS CONFIGURE_DEPENDS shaders/*.vert shaders/*.frag shaders/*.geom shaders/*.tesc shaders/*.tese shaders/*.comp)
foreach(SHADER ${SHADERS})
    get_filename_component(NAME ${SHADER} NAME)
    get_filename_component(STAGE ${SHADER} LAST_EXT)
    if(NAME MATCHES "^shader\\.")
        string(SUBSTRING ${STAGE} 1 -1 STAGE)
        set(SPIRV ${CMAKE_CURRENT_SOURCE_DIR}/shaders/${STAGE}.spv)
    else()
        set(SPIRV ${SHADER}.spv)
    endif()
    add_custom_command(OUTPUT ${SPIRV} COMMAND Vulkan::glslc ${SHADER} -o ${SPIRV} DEPENDS ${SHADER})
    list(APPEND SPIRV_FILES ${SPIRV})
endforeach()
add_custom_target(shaders DEPENDS ${SPIRV_FILES})
add_dependencies(LearnVulkan shaders)

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
set_target_properties(LearnVulkan PROPERTIES LINK_DEPENDS "${SHADERS}")
```

The loop does what vulkan-tutorial.com's `compile.bat` and `compile.sh` do by hand: it runs `glslc` for each shader,
and again whenever you change one. Don't build the **Release** configuration while you learn: it defines `NDEBUG`,
which switches the validation layers off.
:::
:::d3d12
```text
cmake_minimum_required(VERSION 3.24)
project(LearnDirectX CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# DirectX-Headers (d3dx12.h) and stb_image: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

# WIN32: a Windows program that starts in wWinMain, not a console program
add_executable(LearnDirectX WIN32 main.cpp)
target_include_directories(LearnDirectX PRIVATE ${LIBS}/DirectX-Headers/include/directx ${LIBS}/stb)

# Visual Studio: run the program in the chapter folder, where shaders.hlsl and the textures are
set_target_properties(LearnDirectX PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
file(GLOB SHADERS CONFIGURE_DEPENDS *.hlsl)
set_target_properties(LearnDirectX PROPERTIES LINK_DEPENDS "${SHADERS}")
```

`d3d12.lib`, `dxgi.lib` and `d3dcompiler.lib` need no line here: the `#pragma comment(lib, ...)` lines at the top of
`main.cpp` link them. Build the **Debug** configuration: it defines `_DEBUG`, which turns on the debug layer code.
:::

Two lines are there for the course rather than for the compiler. `VS_DEBUGGER_WORKING_DIRECTORY` makes Visual Studio
(and the solutions CMake generates) run the program in the chapter folder. `LINK_DEPENDS` links the program again
when you only changed a shader: the shaders are sources too, and the app only counts a build whose program is newer
than all of them.

:::ide vs
## Visual Studio

**Opening the folder (CMake).** Since Visual Studio understands CMake directly, there is no solution to create:

1. In the Visual Studio Installer, install the **Desktop development with C++** workload.
2. **File → Open → Folder…** and choose the chapter folder. Visual Studio runs CMake by itself; the *Output* window
   shows when it is done.
3. In the toolbar, choose the program (`LearnOpenGL.exe`, `LearnVulkan.exe` or `LearnDirectX.exe`) in the
   **Select Startup Item** list.
4. **Build → Build All** (Ctrl+Shift+B) builds it; **Debug → Start Without Debugging** (Ctrl+F5) or
   **Start Debugging** (F5) builds it if needed and runs it.

The program ends up in `out/build/<configuration>/` inside the chapter folder, for example
`out/build/x64-Debug/LearnOpenGL.exe`, and runs in the chapter folder thanks to `VS_DEBUGGER_WORKING_DIRECTORY`.

**A solution of your own (without CMake).** This is the route learnopengl.com and vulkan-tutorial.com describe:

1. **File → New → Project…**, **Empty Project** (C++). Tick **Place solution and project in the same directory**,
   and let Visual Studio create the chapter folder.
2. Choose that folder in the **Your project** panel and copy the start files into it. Add them to the project with
   **Project → Add Existing Item…**.
3. In the project's **Properties** (Configuration *All Configurations*, Platform *x64*), set
   **C/C++ → General → Additional Include Directories** to the libraries' include folders,
   **Linker → General → Additional Library Directories** to their library folders,
   **Linker → Input → Additional Dependencies** to their `.lib` files, and
   **C/C++ → Language → C++ Language Standard** to C++17.
4. Build with **Build → Build Solution** and run with Ctrl+F5 or F5.

The program ends up in `x64/Debug/` inside the folder. Visual Studio runs it in the project folder by default
(**Debugging → Working Directory** is `$(ProjectDir)`), which is the chapter folder.

:::opengl
For OpenGL, use the pre-compiled GLFW binaries from glfw.org: their `include` folder, the `lib-vc…` folder that
matches your Visual Studio, and `glfw3.lib` plus `opengl32.lib` as dependencies. Add `glad.c` to the project.
:::
:::vulkan
For Vulkan, add the SDK's `Include` and `Lib` folders, GLFW's `include` and library folders, and `vulkan-1.lib` and
`glfw3.lib`. A solution doesn't compile your shaders: add a **Build Events → Pre-Build Event** that runs the SDK's
`%VULKAN_SDK%\Bin\glslc.exe` for each shader, as vulkan-tutorial.com's `compile.bat` does. The CMake route does all
of this for you.
:::
:::d3d12
For DirectX 12, add `DirectX-Headers\include\directx` to the include directories and set
**Linker → System → SubSystem** to **Windows**, because the program starts in `wWinMain`. That is all: the
`#pragma comment` lines link the Direct3D libraries.
:::

A solution has no `LINK_DEPENDS`: when you only changed a shader, use **Build → Rebuild Solution**, so that the
program is newer than the shader.

:::

:::ide clion
## CLion

1. **File → Open…** and choose the chapter folder. CLion reads the `CMakeLists.txt` and asks for a CMake profile the
   first time; the default **Debug** profile is fine.
2. CLion creates a run configuration for the program. Open **Run → Edit Configurations…** and set its
   **Working directory** to the chapter folder (`$ProjectFileDir$`).
3. **Build → Build Project** (Ctrl+F9) builds it; **Run → Run** (Shift+F10) or the green ▶ button runs it.

The program ends up in `cmake-build-debug/` inside the chapter folder.

:::d3d12
On Windows CLion uses its bundled MinGW by default. For DirectX 12, add a **Visual Studio** toolchain under
**Settings → Build, Execution, Deployment → Toolchains** and move it to the top (or choose it in the CMake profile).
:::

:::

:::ide rider
## Rider

Rider builds C++ through Visual Studio solutions, so it needs Microsoft's build tools (Visual Studio or the *Build
Tools for Visual Studio* with the **Desktop development with C++** workload). There are two ways to get a solution:

- Create one as described under *A solution of your own* above (in Visual Studio), and open it in Rider.
- Or let CMake generate one: in a terminal in the chapter folder, run `cmake -B build`. On Windows CMake uses the
  newest Visual Studio it finds, and writes a Visual Studio solution into `build`. Open it in Rider with
  **File → Open…**.

Choose the program's project (not `ALL_BUILD`) as the one to run, build with **Build → Build Solution** and run it
with **Run → Run**. The program ends up in `build/Debug/` (or `x64/Debug/` for your own solution). If it can't find
its files, set **Working directory** in **Run → Edit Configurations…** to the chapter folder.

:::

:::ide vscode
## Visual Studio Code

1. Install the **C/C++** and **CMake Tools** extensions (both from Microsoft), a compiler and CMake.
2. **File → Open Folder…** and choose the chapter folder. CMake Tools finds the `CMakeLists.txt` and asks for a
   *kit* – the compiler to use. (For DirectX 12, choose a Visual Studio kit.)
3. **CMake: Build** (F7, or *Build* in the status bar) builds the program into `build/` inside the chapter folder:
   `build/LearnOpenGL`, or on Windows `build\LearnOpenGL.exe` (`build\Debug\LearnOpenGL.exe` if CMake uses a Visual
   Studio generator).
4. Run it from VS Code's terminal (**Terminal → New Terminal**, which opens in the chapter folder), for example
   `./build/LearnOpenGL` – then the chapter folder is the working directory.

To run it under the debugger with **CMake: Debug** (Ctrl+F5), tell CMake Tools the working directory in
`.vscode/settings.json`:

```text
{
    "cmake.debugConfig": { "cwd": "${workspaceFolder}" }
}
```

:::

## Trying it out

This chapter's start files are the triangle program from the introduction. Choose a folder for this chapter, copy
the start files, add your `CMakeLists.txt`, open the folder in your IDE, build and run. If a window with an orange
triangle on a dark teal background appears, your IDE, your compiler and the libraries for {{api}} are ready – the
next chapter starts from an empty window.

```quiz
You build the program, and the panel's task line changes to *waiting for run*. What should you do?
- [ ] Copy the start files again
- [ ] Build the program once more
- [ ] Use **I ran it** – the app can't follow your IDE
- [x] Run the program from your IDE: the app has seen the new build, but not yet a run of it
---
*Waiting for run* means the build counted. Starting the program from the IDE (or a terminal) is the next step;
**I ran it** is only for setups where the app can't see your program start.
```

## Additional resources

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) on learnopengl.com and
  [Development environment](https://vulkan-tutorial.com/Development_environment) on vulkan-tutorial.com: how the
  original tutorials set up their projects.
- [CMake projects in Visual Studio](https://learn.microsoft.com/en-us/cpp/build/cmake-projects-in-visual-studio) on
  Microsoft Learn.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  the headers, libraries and the debug layer of Direct3D 12.
