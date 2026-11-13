# Setting up your IDE

From the next chapter on you write code – and you write it the way graphics programmers do: in a real IDE, with a
real compiler, building a program that opens a real window on your own machine. This app is your textbook and your
checker. It shows the text, the tasks and a picture of the result each task should give. You tick a task yourself
once your program does what it asks – and whenever you like, the app reads your code and checks it with the course's
own checks.

learnopengl.com spends a good part of its *Creating a window* chapter on setting up a project, and so does
vulkan-tutorial.com with its *Development environment* chapter. This chapter does the same for the three APIs of
this course: you choose an IDE, install a compiler, get the libraries {{api}} needs, set up the project files, and
learn how the **Your project** panel works. It has no tasks, but its start files are the triangle program from the
introduction, so at the end you can check that everything works.

Choose your IDE in the **IDE** picker at the top of the window, next to the API. From here on the chapters show the
steps for the IDE you have chosen, wherever the IDEs differ – you can change it at any time.

## How you work in this course

Every chapter with tasks comes with **start files**: `main.cpp`, and from later chapters on also headers, shader
files, textures, models and fonts. The `// TODO:` comments in them mark where your code goes. Where you keep your
code is up to you: your own folders, one project per chapter or one for the whole course, the IDE you like. The
**Your project** panel connects the chapter with your code:

1. **Save start files…** asks for a folder and copies the chapter's start files there: `main.cpp`, the shaders and the
   course's textures, models and fonts. If a file is already there, the app asks before it overwrites it. Then you
   add your project files – see below – and open the project in your IDE.
2. You write the code of a task, **build** the program and **run** it from your IDE. That is how you see what your
   code does: compare your window with the **Expected result**, the picture the panel shows for every task.
3. When your program does what the task asks, tick the task with **Mark as done**. Your XP, streaks and achievements
   count it just as before.
4. Whenever you want a second opinion, press **Check my code**. The first time, it asks for the chapter's main source
   file – `main.cpp`, or whatever you called it – wherever it is on your disk. (After **Save start files…** it already
   uses the `main.cpp` it saved.) The app reads that file and the chapter's other files – shaders and headers – that
   it finds next to it, in the folders below it or in the folder above it, and checks them with the course's own
   checks. It ticks every task that passes and tells you, for the others, what is still missing. **Change file…**
   picks another file.

**Check my code** reads your sources only: nothing has to be built or run for it. Build and run your program all the
same – a check can tell you that the right calls are there, but only your window shows you what they draw.

The tasks stay locked until you have answered the questions in the text.

```quiz
You finish a task in `main.cpp` and save the file. How can the task get ticked? (Choose all that apply.)
- [x] You tick it yourself with **Mark as done**, once your program does what the task asks
- [ ] The app notices that you built and ran the program, and ticks it
- [x] You press **Check my code**, and the course's checks for the task pass
- [ ] You save the start files again with **Save start files…**
---
The app doesn't follow your IDE: you tick a task yourself, or let **Check my code** read your sources and tick every
task that passes. Saving the start files again would overwrite your work.
```

## Choosing an IDE

Any C++ IDE will do, but the course gives steps for four of them:

| IDE | Runs on | Cost | Good to know |
|---|---|---|---|
| [Visual Studio](https://visualstudio.microsoft.com/) | Windows | The Community edition is free for individuals, students, open-source work and small teams | Comes with Microsoft's compiler (MSVC) and the Windows SDK; the best choice for DirectX 12 |
| [CLion](https://www.jetbrains.com/clion/) | Windows, macOS, Linux | Free for non-commercial use; a paid licence for commercial work | Built around CMake; brings its own CMake, and on Windows its own MinGW compiler |
| [Rider](https://www.jetbrains.com/rider/) | Windows, macOS, Linux | Free for non-commercial use; a paid licence for commercial work | Builds C++ with Microsoft's build tools from Visual Studio solutions, which in practice means Windows |
| [Visual Studio Code](https://code.visualstudio.com/) | Windows, macOS, Linux | Free | An editor that becomes a C++ IDE with Microsoft's **C/C++** and **CMake Tools** extensions; you install the compiler and CMake yourself |

The four build the course's projects in two ways. **CLion** and **VS Code** use **CMake**: a `CMakeLists.txt` in the
chapter folder describes the program. **Visual Studio** and **Rider** use a **Visual Studio solution**: a `.sln` file
and a project file, `.vcxproj`, whose settings name the include folders, the libraries and the working directory.
(Visual Studio can also open a CMake folder, and Rider a CMake project; the course's steps for them follow the
solution.)

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
natural choice. Rider opens the same solutions; CLion and VS Code work too, as long as they use Microsoft's compiler
(MSVC).
:::

```quiz
How do the IDEs build the course's projects? (Choose all that apply.)
- [x] CLion and VS Code build from a `CMakeLists.txt` with CMake
- [ ] VS Code needs no build files at all
- [x] Visual Studio and Rider build a Visual Studio solution (`.sln` and `.vcxproj`)
- [ ] Rider builds from a makefile
---
CMake is the build system of CLion and of VS Code's CMake Tools. Visual Studio's own projects are solutions, and Rider
builds the same solutions with Microsoft's build tools.
```

## A compiler

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

:::ide clion vscode
**CMake** describes a project in a file called `CMakeLists.txt`: which sources make up the program, which libraries
it uses and where they are. From that file CMake generates the build files for your compiler (Ninja files or
makefiles), which the IDE then builds. CLion brings CMake along; for VS Code you install it yourself. The
`CMakeLists.txt` below needs CMake 3.24 or newer, and Git, which CMake uses to download libraries.
:::
:::ide vs rider
A **Visual Studio solution** is built by MSBuild, which comes with Visual Studio and with the *Build Tools for Visual
Studio*. Rider uses the same MSBuild and the same compiler, so for Rider you install the Build Tools (or Visual Studio
Community) with the **Desktop development with C++** workload too.
:::

## The libraries for {{api}}

:::opengl
OpenGL itself needs nothing to install: it comes with your graphics driver. What you do need are the libraries the
learnopengl.com code uses:

- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) creates the window and the OpenGL context and gives you
  keyboard and mouse input.
- **GLAD** loads the OpenGL functions at run time. You generate it on [glad.dav1d.de](https://glad.dav1d.de/):
  language **C/C++**, specification **OpenGL**, API **gl** version **3.3**, profile **Core**, **Generate a loader**
  ticked, then **Generate**. The zip file contains `include/glad/glad.h`, `include/KHR/khrplatform.h` and
  `src/glad.c`. ([gen.glad.sh](https://gen.glad.sh/) is the generator of GLAD 2, whose functions have other names;
  the course's code uses GLAD 1's `gladLoadGLLoader`.)
- **GLM** ([github.com/g-truc/glm](https://github.com/g-truc/glm)), the maths library, from *Transformations* on.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), one header, `stb_image.h`, that loads
  images, from *Textures* on.
- Later, **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  for *Model Loading*, and **FreeType** ([freetype.org](https://freetype.org/)) for *Text Rendering*. Those chapters
  tell you what to add.

:::ide clion vscode
GLFW and GLM come by themselves: the `CMakeLists.txt` below downloads and builds them, unless it finds installed ones
(on Linux `libglfw3-dev` and `libglm-dev` or your distribution's equivalents, on macOS `brew install glfw glm`).
:::
:::ide vs rider
For GLFW, download the **64-bit Windows binaries** from glfw.org: the zip file has an `include` folder and a
`lib-vc2022` folder with `glfw3.lib` (it works with newer Visual Studio versions too). GLM is only headers: download
the repository (or a release) so that its `glm` folder, the one with `glm.hpp` in it, is available.
:::

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
  small demo – run it first to see that your graphics card and driver support Vulkan. On Windows its installer also
  sets the environment variable `VULKAN_SDK` to the folder it installed to. On Linux you can use your distribution's
  packages instead, for example on Debian and Ubuntu:

  ```text
  sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools glslc libglfw3-dev libglm-dev
  ```

- **macOS:** the SDK runs Vulkan on top of Metal with **MoltenVK**, which it includes. There `vkCreateInstance` can
  return `VK_ERROR_INCOMPATIBLE_DRIVER` unless you enable the `VK_KHR_portability_enumeration` instance extension
  and set `VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` in the create info's `flags`; the course's code targets
  Windows and Linux and doesn't do that.
- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) for the window, and **GLM**
  ([github.com/g-truc/glm](https://github.com/g-truc/glm)) for the maths.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), one header, `stb_image.h`, from
  *Textures* on, and **tinyobjloader** ([github.com/tinyobjloader/tinyobjloader](https://github.com/tinyobjloader/tinyobjloader)),
  one header, `tiny_obj_loader.h`, for the models, as in vulkan-tutorial.com.
- Later, **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  and **FreeType** ([freetype.org](https://freetype.org/)). Those chapters tell you what to add.

:::ide clion vscode
GLFW and GLM come by themselves: the `CMakeLists.txt` below downloads and builds them, unless it finds installed ones.
:::
:::ide vs rider
For GLFW, download the **64-bit Windows binaries** from glfw.org: the zip file has an `include` folder and a
`lib-vc2022` folder with `glfw3.lib` (it works with newer Visual Studio versions too). GLM is only headers: download
the repository (or a release) so that its `glm` folder, the one with `glm.hpp` in it, is available.
:::

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

How you organise your code is up to you. The steps in this course use one layout, as a suggestion: every chapter gets
its own folder, and the libraries that are just files – the ones you download yourself – go into one `libs` folder
that all chapters share. The `CMakeLists.txt` and the Visual Studio settings below find that folder as `../../libs`,
two levels above the chapter folder:

:::opengl
:::ide clion vscode
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
:::ide vs rider
```text
learn/
  libs/
    glad/        include/glad/glad.h, include/KHR/khrplatform.h, src/glad.c
    glfw/        include/GLFW/glfw3.h, lib-vc2022/glfw3.lib
    glm/         glm/glm.hpp …
    stb/         stb_image.h
  opengl/
    LearnOpenGL/          the project you copy into every chapter (see below)
    creating-a-window/
      LearnOpenGL.sln, LearnOpenGL.vcxproj
      main.cpp
    hello-window/
      ...
```
:::
:::
:::vulkan
:::ide clion vscode
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
:::ide vs rider
```text
learn/
  libs/
    glfw/            include/GLFW/glfw3.h, lib-vc2022/glfw3.lib
    glm/             glm/glm.hpp …
    stb/             stb_image.h
    tinyobjloader/   tiny_obj_loader.h
  vulkan/
    LearnVulkan/     the project you copy into every chapter (see below)
    creating-a-window/
      LearnVulkan.sln, LearnVulkan.vcxproj
      main.cpp
    hello-triangle/
      LearnVulkan.sln, LearnVulkan.vcxproj
      main.cpp
      shaders/shader.vert, shaders/shader.frag
    ...
```
:::
:::
:::d3d12
:::ide clion vscode
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
:::ide vs rider
```text
learn/
  libs/
    DirectX-Headers/   the repository: include/directx/d3dx12.h …
    stb/               stb_image.h
  d3d12/
    LearnDirectX/      the project you copy into every chapter (see below)
    creating-a-window/
      LearnDirectX.sln, LearnDirectX.vcxproj
      main.cpp
    hello-triangle/
      LearnDirectX.sln, LearnDirectX.vcxproj
      main.cpp
      shaders.hlsl
    ...
```
:::
:::

Any other structure works just as well – for example one CMake project for the whole course, with one executable per
chapter. Then adjust the paths to the libraries: `LIBS` in the `CMakeLists.txt`, or the include and library
directories in the Visual Studio project.

The programs load their shaders, textures and models with paths relative to the **working directory**, the folder a
program runs in: `"shaders/vert.spv"`, `"container.png"`, `L"shaders.hlsl"`. The start files put those files next to
`main.cpp`, in the chapter folder, so the program has to run with the chapter folder as its working directory. The
steps below say how.

```quiz
Your program builds, but when it starts it stops with an error that it can't open one of its shader files. The file is in the chapter folder. What is the most likely cause?
- [ ] You haven't pressed **Check my code** yet
- [ ] The shader file is older than the program
- [x] The program runs with another working directory than the chapter folder – usually the build folder
- [ ] The libs folder is missing
---
Relative paths are resolved from the working directory. IDEs often run a program in the folder it was built in, so
the working directory has to be the chapter folder – the steps below show how for your IDE.
```

## The project files

:::ide clion vscode
You write the `CMakeLists.txt` yourself – one per chapter, or one for your whole course with a program per chapter.
New to CMake? [CMake's tutorial](https://cmake.org/cmake/help/latest/guide/tutorial/index.html) has what you need.
:::
:::ide vs rider
You set up a Visual Studio project once per API and copy its two files, the `.sln` and the `.vcxproj`, into every
chapter folder. The project refers to `main.cpp` and to the `libs` folder by relative paths, so the copies work
unchanged in every chapter folder at the same depth (`learn/<api>/<chapter>`). If your folders are laid out
differently, change the `..\..\libs` paths in the settings to match.
:::

:::opengl
:::ide clion vscode
For OpenGL it needs to:

- use C++17 ([`CMAKE_CXX_STANDARD`](https://cmake.org/cmake/help/latest/variable/CMAKE_CXX_STANDARD.html))
- get GLFW and GLM: installed with [`find_package`](https://cmake.org/cmake/help/latest/command/find_package.html), or
  downloaded with [`FetchContent`](https://cmake.org/cmake/help/latest/module/FetchContent.html)
- build a program from `main.cpp` and GLAD's `glad.c`
  ([`add_executable`](https://cmake.org/cmake/help/latest/command/add_executable.html))
- add GLAD's and stb's include folders
  ([`target_include_directories`](https://cmake.org/cmake/help/latest/command/target_include_directories.html)) and link
  GLFW and GLM ([`target_link_libraries`](https://cmake.org/cmake/help/latest/command/target_link_libraries.html))

<details data-summary="Show a finished CMakeLists.txt">

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
```

</details>

On Linux, install your distribution's GLFW package: building GLFW from source there also needs the X11 and Wayland
development packages. You don't have to link `opengl32.lib` or `libGL` yourself – GLFW creates the context and GLAD
asks it for every function.
:::
:::ide vs rider
The project, `LearnOpenGL`, compiles `main.cpp` and GLAD's `glad.c`, and needs these settings for **all
configurations** and the **x64** platform:

- **C/C++ → General → Additional Include Directories:**
  `..\..\libs\glfw\include;..\..\libs\glad\include;..\..\libs\glm;..\..\libs\stb`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → General → Additional Library Directories:** `..\..\libs\glfw\lib-vc2022`
- **Linker → Input → Additional Dependencies:** `glfw3.lib;opengl32.lib` in front of the ones already there
- **Debugging → Working Directory:** `$(ProjectDir)` – the default, which is the chapter folder

In the project file these settings are an `ItemDefinitionGroup`, after the ones that are already there, and the two
source files an `ItemGroup`:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>..\..\libs\glfw\include;..\..\libs\glad\include;..\..\libs\glm;..\..\libs\stb;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <AdditionalLibraryDirectories>..\..\libs\glfw\lib-vc2022;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
    <AdditionalDependencies>glfw3.lib;opengl32.lib;%(AdditionalDependencies)</AdditionalDependencies>
  </Link>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
  <ClCompile Include="..\..\libs\glad\src\glad.c" />
</ItemGroup>
```

Relative paths in these settings start at the folder of the `.vcxproj`, which is the chapter folder.
:::
:::
:::vulkan
:::ide clion vscode
For Vulkan it needs to:

- use C++17 ([`CMAKE_CXX_STANDARD`](https://cmake.org/cmake/help/latest/variable/CMAKE_CXX_STANDARD.html))
- find the Vulkan SDK and its `glslc` ([`FindVulkan`](https://cmake.org/cmake/help/latest/module/FindVulkan.html)), and
  get GLFW and GLM ([`find_package`](https://cmake.org/cmake/help/latest/command/find_package.html) or
  [`FetchContent`](https://cmake.org/cmake/help/latest/module/FetchContent.html))
- build a program from `main.cpp` ([`add_executable`](https://cmake.org/cmake/help/latest/command/add_executable.html))
  with stb's and tinyobjloader's include folders
  ([`target_include_directories`](https://cmake.org/cmake/help/latest/command/target_include_directories.html))
- link Vulkan, GLFW and GLM
  ([`target_link_libraries`](https://cmake.org/cmake/help/latest/command/target_link_libraries.html))
- compile the shaders to SPIR-V with `glslc`
  ([`add_custom_command`](https://cmake.org/cmake/help/latest/command/add_custom_command.html)) – or run `glslc` by
  hand, as vulkan-tutorial.com's `compile.bat` does

<details data-summary="Show a finished CMakeLists.txt">

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
```

The loop does what vulkan-tutorial.com's `compile.bat` does by hand: it runs `glslc` for each shader, and again
whenever you change one.

</details>
:::
:::ide vs rider
The project, `LearnVulkan`, compiles `main.cpp` and needs these settings for **all configurations** and the **x64**
platform:

- **C/C++ → General → Additional Include Directories:**
  `$(VULKAN_SDK)\Include;..\..\libs\glfw\include;..\..\libs\glm;..\..\libs\stb;..\..\libs\tinyobjloader`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → General → Additional Library Directories:** `$(VULKAN_SDK)\Lib;..\..\libs\glfw\lib-vc2022`
- **Linker → Input → Additional Dependencies:** `vulkan-1.lib;glfw3.lib` in front of the ones already there
- **Build Events → Pre-Build Event → Command Line:** the `glslc` commands below
- **Debugging → Working Directory:** `$(ProjectDir)` – the default, which is the chapter folder

A solution doesn't compile shaders by itself. The pre-build event does what vulkan-tutorial.com's `compile.bat`
does: it runs the SDK's `glslc` for every shader in `shaders\` before each build – `shader.vert` becomes `vert.spv`
(vulkan-tutorial's names), any other `name.vert` becomes `name.vert.spv`. In the project file:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>$(VULKAN_SDK)\Include;..\..\libs\glfw\include;..\..\libs\glm;..\..\libs\stb;..\..\libs\tinyobjloader;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <AdditionalLibraryDirectories>$(VULKAN_SDK)\Lib;..\..\libs\glfw\lib-vc2022;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
    <AdditionalDependencies>vulkan-1.lib;glfw3.lib;%(AdditionalDependencies)</AdditionalDependencies>
  </Link>
  <PreBuildEvent>
    <Command>for %%f in (shaders\*.vert shaders\*.frag shaders\*.geom shaders\*.tesc shaders\*.tese shaders\*.comp) do "$(VULKAN_SDK)\Bin\glslc.exe" "%%f" -o "%%f.spv"
if exist shaders\shader.vert "$(VULKAN_SDK)\Bin\glslc.exe" shaders\shader.vert -o shaders\vert.spv
if exist shaders\shader.frag "$(VULKAN_SDK)\Bin\glslc.exe" shaders\shader.frag -o shaders\frag.spv</Command>
  </PreBuildEvent>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
</ItemGroup>
```

Relative paths in these settings start at the folder of the `.vcxproj`, which is the chapter folder, and the build
events run there too.
:::

Don't build the **Release** configuration while you learn: it defines `NDEBUG`, which switches the validation layers
off.
:::
:::d3d12
:::ide clion vscode
For DirectX 12 it needs to:

- use C++17 ([`CMAKE_CXX_STANDARD`](https://cmake.org/cmake/help/latest/variable/CMAKE_CXX_STANDARD.html))
- build a Windows program from `main.cpp` – `WIN32`, because it starts in `wWinMain`
  ([`add_executable`](https://cmake.org/cmake/help/latest/command/add_executable.html))
- add the include folders of DirectX-Headers and stb
  ([`target_include_directories`](https://cmake.org/cmake/help/latest/command/target_include_directories.html))

<details data-summary="Show a finished CMakeLists.txt">

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
```

</details>
:::
:::ide vs rider
The project, `LearnDirectX`, compiles `main.cpp` and needs these settings for **all configurations** and the **x64**
platform:

- **C/C++ → General → Additional Include Directories:** `..\..\libs\DirectX-Headers\include\directx;..\..\libs\stb`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → System → SubSystem:** Windows – the program starts in `wWinMain`, not in `main`
- **Debugging → Working Directory:** `$(ProjectDir)` – the default, which is the chapter folder, where `shaders.hlsl`
  is

In the project file:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>..\..\libs\DirectX-Headers\include\directx;..\..\libs\stb;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <SubSystem>Windows</SubSystem>
  </Link>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
</ItemGroup>
```
:::

`d3d12.lib`, `dxgi.lib` and `d3dcompiler.lib` need no setting: the `#pragma comment(lib, ...)` lines at the top of
`main.cpp` link them. Build the **Debug** configuration: it defines `_DEBUG`, which turns on the debug layer code.
:::

:::ide vs rider
The shaders, textures and models stay in the chapter folder, where the program runs. (If you'd rather run the `.exe`
from its own folder, copy them next to it with a post-build event, for example
`xcopy /y /s /i "$(ProjectDir)shaders" "$(OutDir)shaders"`.)
:::

:::opengl d3d12
The program reads its shaders each time it starts, so a change to a shader alone needs no new build: just run the
program again.
:::
:::vulkan
:::ide clion vscode
After a change to a shader, build as usual: CMake sees the change and runs `glslc` on that shader again.
:::
:::ide vs rider
A solution doesn't count the shaders as sources: when only a shader has changed, the IDE may find nothing to build
and skip the pre-build event. After a change to a shader alone, use **Build → Rebuild Solution**, so that `glslc`
compiles it again.
:::
:::

## Building and running

:::ide vs
1. In the Visual Studio Installer, install the **Desktop development with C++** workload.
2. Once per API, create the project you'll copy: **File → New → Project…**, **Empty Project** (C++). Name it
   `LearnOpenGL`, `LearnVulkan` or `LearnDirectX`, choose your `learn/<api>` folder as the location and tick **Place
   solution and project in the same directory**.
3. Add a `main.cpp` with **Project → Add New Item…** (an empty one is fine – every chapter brings its own; for OpenGL
   also add `glad.c` with **Project → Add Existing Item…**), and make the settings above in **Project → Properties**
   (Configuration *All Configurations*, Platform *x64*).
4. For each chapter, copy the project's `.sln`, `.vcxproj` and `.vcxproj.filters` into the chapter folder next to the
   start files, and open the `.sln` there.
5. **Build → Build Solution** (Ctrl+Shift+B) builds the program; **Debug → Start Without Debugging** (Ctrl+F5) or
   **Start Debugging** (F5) builds it if needed and runs it, with the chapter folder as its working directory.
:::
:::ide clion
1. **File → Open…** and choose the chapter folder. CLion reads the `CMakeLists.txt` and asks for a CMake profile the
   first time; the default **Debug** profile is fine.
2. CLion creates a run configuration for the program. Open **Run → Edit Configurations…** and set its
   **Working directory** to the chapter folder (`$ProjectFileDir$`).
3. **Build → Build Project** (Ctrl+F9) builds it; **Run → Run** (Shift+F10) or the green ▶ button runs it.
:::
:::ide rider
1. Install the *Build Tools for Visual Studio* (or Visual Studio Community) with the **Desktop development with C++**
   workload: Rider builds C++ with Microsoft's MSBuild and compiler.
2. Once per API, create the project you'll copy: a C++ project named `LearnOpenGL`, `LearnVulkan` or `LearnDirectX`
   in your `learn/<api>` folder, with the `.sln` and the `.vcxproj` in the same folder – with Rider's **File → New
   Solution…** or, if you have it, with Visual Studio's **Empty Project**.
3. Add a `main.cpp` (for OpenGL also `glad.c`) and the settings above: open the `.vcxproj` in the editor – it is
   MSBuild XML – and add the `ItemDefinitionGroup` and the `ItemGroup` after the ones already there.
4. For each chapter, copy the project's `.sln`, `.vcxproj` and `.vcxproj.filters` into the chapter folder next to the
   start files, and open the `.sln` there with **File → Open…**.
5. **Build → Build Solution** builds the program; **Run → Run** runs it.

If the program can't find its files, set **Working directory** in **Run → Edit Configurations…** to the chapter
folder.
:::
:::ide vscode
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

:::d3d12
:::ide clion
On Windows CLion uses its bundled MinGW by default. For DirectX 12, add a **Visual Studio** toolchain under
**Settings → Build, Execution, Deployment → Toolchains** and move it to the top (or choose it in the CMake profile).
:::
:::

## Trying it out

This chapter's start files are the triangle program from the introduction. Save them with **Save start files…**,
add your project files, open the project in your IDE, build and run. If a window with an orange triangle on a dark
teal background appears, your IDE, your compiler and the libraries for {{api}} are ready – the next chapter starts
from an empty window.

```quiz
You keep the course your own way: one CMake project for all chapters, each chapter's code in a folder of its own. What does **Check my code** need from you?
- [ ] The suggested folder layout, `learn/<api>/<chapter>`
- [ ] A build of the program that is newer than your sources
- [ ] The program, running while the check reads your code
- [x] The chapter's main source file, picked once, wherever it is
---
**Check my code** reads your sources – the main file you pick, and the shaders and headers it finds next to it, below
it or in the folder above – and runs the course's checks on them. Any folder structure works, and nothing has to be
built or run for the check; you build and run the program to see what it draws.
```

## Additional resources

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) on learnopengl.com and
  [Development environment](https://vulkan-tutorial.com/Development_environment) on vulkan-tutorial.com: how the
  original tutorials set up their projects.
- [CMake projects in Visual Studio](https://learn.microsoft.com/en-us/cpp/build/cmake-projects-in-visual-studio) on
  Microsoft Learn.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  the headers, libraries and the debug layer of Direct3D 12.
