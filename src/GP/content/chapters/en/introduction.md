# Welcome to graphics programming

Since you came here, you probably want to learn how computer graphics work: how a program gets the graphics card
to draw triangles, how those triangles get colours, textures and light, and how all of that ends up as the images
you see in games, 3D tools and visualisations. Doing this yourself teaches you a lot about how the hardware works,
and it is a lot of fun. This course takes you there step by step, from opening an empty window to lighting,
shadows and physically based rendering.

## What this course is

Codestead GP follows [learnopengl.com](https://learnopengl.com/) by Joey de Vries, chapter by chapter and section
by section: the same chapters, in the same order, with the same examples. The difference is that you can read every
chapter for one of three graphics APIs:

- **OpenGL** (3.3 core profile) – the text and code follow learnopengl.com.
- **Vulkan** – the text and code follow [vulkan-tutorial.com](https://vulkan-tutorial.com/) by Alexander
  Overvoorde.
- **DirectX 12** (Direct3D 12) – the text and code follow Microsoft's D3D12HelloWorld samples and the Direct3D 12
  documentation on Microsoft Learn.

You don't only read about graphics programming: every chapter comes with a project that you change, build and run
yourself, in your own IDE on your own computer. By the end of a chapter you have written the code it talks about.

## Prerequisites

A graphics API is not a programming language of its own; you call it from a language, and the language used here
is **C++**. You should be comfortable with C++ before you start: variables, functions, pointers and references,
structs and classes, arrays and `std::vector`. The chapters explain the less common C++ that shows up along the
way, and the Vulkan code uses a few C++17 features (such as `std::optional`) that are explained where they appear.

You also need a little mathematics later on (vectors and matrices). You don't have to know it in advance: the
*Transformations* chapter introduces what you need, just like learnopengl.com does.

## Choosing an API

At the top of the window you choose the graphics API: **OpenGL**, **Vulkan** or **DirectX 12**. All three drive the
same graphics hardware and draw the same pictures, but they differ a lot in how much they do for you:

| API | Runs on | What it is like | What it costs to learn |
|---|---|---|---|
| OpenGL | Windows, Linux, macOS (deprecated there, but still available) | The driver does most of the work for you: memory, synchronisation, keeping track of state | The simplest of the three: the first triangle takes about 180 lines |
| Vulkan | Windows, Linux, Android (macOS and iOS through a translation layer) | Explicit: you describe everything yourself, and the driver does almost nothing behind your back | Very verbose: the same triangle takes about 1,000 lines |
| DirectX 12 | Windows and Xbox | Explicit like Vulkan, with Microsoft's helper structures and tools | Between the two: the triangle takes about 500 lines, and you also learn some Windows programming |

**OpenGL** is the best choice if you are new to graphics programming: you see results quickly and can concentrate on
the ideas (shaders, textures, lighting) instead of the bookkeeping. **Vulkan** and **DirectX 12** are what modern
engines use underneath: they give you full control over the GPU and let you use it efficiently from several
threads, but you pay for that control with much more code and many more concepts before the first triangle
appears. Everything you learn with one API carries over to the others – the graphics pipeline, shaders and the
mathematics are the same everywhere.

```quiz
Which of the three APIs only runs on Microsoft's platforms (Windows and Xbox)?
- [ ] OpenGL
- [ ] Vulkan
- [x] DirectX 12
---
OpenGL and Vulkan are open standards from the Khronos Group and run on many operating systems. Direct3D 12 is part of Microsoft's DirectX and exists on Windows and Xbox.
```

The chapters are the same for all three APIs. When an API needs extra steps (Vulkan and DirectX 12 often do), the
chapter explains them; when an API has no equivalent of something, the chapter says so. You can switch API at any
time, even in the middle of a chapter. Each API has its own projects and its own progress: the tasks you have done
in OpenGL stay done when you try Vulkan, and when you switch back you continue where you left off.

:::opengl
You have chosen **OpenGL**. Good choice for a start: you will draw your first triangle a few chapters from now and
spend most of your time on what makes graphics interesting.
:::
:::vulkan
You have chosen **Vulkan**. Be prepared for a lot of setup before anything appears on the screen – the next
chapters build the roughly 1,000 lines of the triangle program piece by piece. Once that foundation is in place,
the later chapters add features at about the same pace as in OpenGL.
:::
:::d3d12
You have chosen **DirectX 12**. You will first set up a Win32 window, a device, a command queue and a swap chain
before you can draw; the chapters walk you through each of them. Once that foundation is in place, the later
chapters add features at about the same pace as in OpenGL.
:::

```quiz
You have done the first chapters with OpenGL and switch to Vulkan. What happens to your OpenGL progress?
- [ ] It is deleted, because you can only follow the course with one API
- [ ] It is copied to Vulkan, so the Vulkan tasks are already done
- [x] It is kept: each API has its own projects and progress, and you can switch back at any time
---
Each API is counted separately. Switching only changes which text, project and tasks you see.
```

## How this course is structured

The course is split into the same parts as learnopengl.com: *Getting started*, *Lighting*, *Model Loading*,
*Advanced OpenGL*, *Advanced Lighting*, *PBR* and *In Practice*. Each chapter builds on the previous ones, so it is
best to follow them in order.

Each chapter is a lesson in three parts:

1. **The text** (on the left) explains the theory and the code, step by step, the way learnopengl.com does. Code
   excerpts in the text are taken from the chapter's start files, so you can find every line again in your project.
2. **Questions** in the text ("Check yourself") make sure you have understood the important points. Answer them
   as you read: once you have answered them, the tasks open up.
3. **The tasks** (on the right) are the code you write – in your own IDE. The **Your project** panel connects the
   chapter with the folder your project is in.

At the end of most chapters you find *Additional resources*: links to the official documentation and the original
tutorials, if you want to read more.

## How you work in this course

You write, build and run the code in a real IDE – Visual Studio, CLion, Rider or Visual Studio Code – with a real
compiler, and your program opens a real window on your screen. The app is your textbook and your checker. The chapter
*Setting up your IDE*, two chapters from here, shows how to set up the IDE, the compiler and the libraries for the
API you have chosen.

On the right of each chapter are the **tasks**. Each task is one change to the project: a function to call, a value
to change, a few lines to add. The text tells you when it is time for a task. If you get stuck, open the **Hint**.
After a few attempts – or as soon as you have opened the hint – you can also show the **solution**, the code that
belongs where the task's `// TODO:` comment is.

Above the tasks is the **Your project** panel:

- **Choose folder…** picks the folder for the chapter's project on your disk, and **Copy start files** copies the
  chapter's files into it: `main.cpp`, and later also shaders, textures and models. In the projects of the coming
  chapters, `// TODO:` comments mark where your code goes. **Open folder** opens the folder, so you can open it in
  your IDE.
- When you have written a task's code, you **build** the program and **run** it from your IDE. The app watches the
  folder: once it has seen a new build and a run of it, it checks your source files with the course's checks and
  ticks the task – or tells you what is still missing.
- For each task the panel shows the **Expected result**: a picture of what your program's window should show when
  the task is done.

If your IDE builds or runs the program somewhere the app can't see (in WSL or on another machine, for example), the
**I ran it** link tells the app that you have run it.

```quiz
You have written the code of a task. What makes the app tick it? (Choose all that apply.)
- [x] You build the program in your IDE
- [x] You run the program you have built
- [ ] You open the **Expected result** picture
---
The app waits for a new build and a run of it, then checks your source files. The expected result is only there to
compare with what your program draws.
```

## Your first program

The project of this chapter is not one you have to write: it is the finished *Hello Triangle* program, the program
you will build yourself over the next chapters. It opens an 800×600 window, clears it to a dark teal colour and
draws one orange triangle in the middle.

:::opengl
The whole program is one file, `main.cpp`: it creates the window with GLFW, loads the OpenGL functions with GLAD,
compiles two small shaders (written as strings inside `main.cpp`), puts the three corners of the triangle in a
buffer and draws it in a loop until you press Escape or close the window.
:::
:::vulkan
The program has three files. `main.cpp` contains the class `HelloTriangleApplication`, which creates the window
with GLFW and sets up Vulkan: an instance, a device, a swap chain, a render pass, a graphics pipeline, command
buffers and the objects that synchronise the CPU and the GPU. `shaders/shader.vert` and `shaders/shader.frag` are
the two shaders, written in GLSL; when you build, they are compiled to SPIR-V (`shaders/vert.spv` and
`shaders/frag.spv`), the form Vulkan loads.
:::
:::d3d12
The program has two files. `main.cpp` creates a Win32 window titled "LearnDirectX" and sets up Direct3D 12: a
device, a command queue, a swap chain, a pipeline state object, a command list and a fence. `shaders.hlsl`
contains the two shaders, written in HLSL; `main.cpp` compiles them when the program starts.
:::

Don't worry if none of this means anything to you yet – that is what the course is for. For now, just see it run.

This chapter's start files are that program. You'll build it yourself once your IDE is set up – the first task
asks you to build and run it and look at its window: an orange triangle on a dark teal background. Until then, its
**Expected result** shows you what it draws.

### The colour of the triangle

Every pixel of the triangle gets its colour from a small program that runs on the GPU: a **shader**. You will learn
all about shaders later; for now it is enough to find the one line that decides the colour.

:::opengl
In OpenGL it is the **fragment shader**, written in GLSL. In this program it is stored as a string in `main.cpp`,
in the variable `fragmentShaderSource`:

```cpp
const char *fragmentShaderSource = "#version 330 core\n"
    "out vec4 FragColor;\n"
    "void main()\n"
    "{\n"
    "   FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);\n"
    "}\n\0";
```

The shader runs once for every pixel the triangle covers. `out vec4 FragColor;` declares its output, and the line
`FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);` sets it: a colour of four values – red, green, blue and alpha
(opacity) – each from `0.0` to `1.0`. `(1.0, 0.5, 0.2)` is full red, half green and a little blue: orange.

```quiz
Which line makes the triangle pure red?
- [x] `FragColor = vec4(1.0f, 0.0f, 0.0f, 1.0f);`
- [ ] `FragColor = vec4(255.0f, 0.0f, 0.0f, 255.0f);`
- [ ] `FragColor = vec4(0.0f, 0.0f, 1.0f, 1.0f);`
---
Colour values in a shader go from 0.0 to 1.0, in the order red, green, blue, alpha. 255 is the range of 8-bit pixel values, not of shader colours; `(0, 0, 1)` would be blue.
```
:::
:::vulkan
In Vulkan it is the **fragment shader** in `shaders/shader.frag`, written in GLSL:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

The shader runs once for every pixel the triangle covers. `layout(location = 0) out vec4 outColor;` declares its
output: location 0 is the first (and here only) colour attachment, the swap chain image the triangle is drawn
into. The line `outColor = vec4(1.0, 0.5, 0.2, 1.0);` sets the colour: four values – red, green, blue and alpha
(opacity) – each from `0.0` to `1.0`. `(1.0, 0.5, 0.2)` is full red, half green and a little blue: orange.

```quiz
Which line makes the triangle pure red?
- [ ] `outColor = vec4(255.0, 0.0, 0.0, 255.0);`
- [x] `outColor = vec4(1.0, 0.0, 0.0, 1.0);`
- [ ] `outColor = vec4(0.0, 0.0, 1.0, 1.0);`
---
Colour values in a shader go from 0.0 to 1.0, in the order red, green, blue, alpha. 255 is the range of 8-bit pixel values, not of shader colours; `(0, 0, 1)` would be blue.
```
:::
:::d3d12
In Direct3D 12 it is the **pixel shader** `PSMain` in `shaders.hlsl`, written in HLSL:

```hlsl
// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

The shader runs once for every pixel the triangle covers. Its return value is the pixel's colour; the semantic
`SV_TARGET` says that it goes to the render target (the back buffer of the swap chain). The colour is a `float4` of
four values – red, green, blue and alpha (opacity) – each from `0.0` to `1.0`. `(1.0, 0.5, 0.2)` is full red,
half green and a little blue: orange.

```quiz
Which line makes the triangle pure red?
- [ ] `return float4(0.0f, 0.0f, 1.0f, 1.0f);`
- [x] `return float4(1.0f, 0.0f, 0.0f, 1.0f);`
- [ ] `return float4(255.0f, 0.0f, 0.0f, 255.0f);`
---
Colour values in a shader go from 0.0 to 1.0, in the order red, green, blue, alpha. 255 is the range of 8-bit pixel values, not of shader colours; `(0, 0, 1)` would be blue.
```
:::

The second task: make the triangle green by changing the colour to `(0.2, 0.8, 0.3, 1.0)`. Build and run it again
and check your program's window: the triangle has the same shape and position, only its colour has changed.

## Course map

Here is the whole course: all chapters of learnopengl.com. The chapters of *Getting started* up to *Shaders* are in
the app now; the rest is coming, in this order.

**Getting started** – in the app now up to *Shaders*

| Chapter | |
|---|---|
| {{api}} | available |
| Setting up your IDE | available |
| Creating a window | available |
| Hello Window | available |
| Hello Triangle | available |
| Shaders | available |
| Textures | coming |
| Transformations | coming |
| Coordinate Systems | coming |
| Camera | coming |
| Review | coming |

**Lighting** – coming: Colors, Basic Lighting, Materials, Lighting maps, Light casters, Multiple lights, Review.

**Model Loading** – coming: Assimp, Mesh, Model.

**Advanced {{api}}** – coming: Depth testing, Stencil testing, Blending, Face culling, Framebuffers, Cubemaps,
Advanced Data, Advanced {{shaderLanguage}}, Geometry Shader, Instancing, Anti Aliasing.

**Advanced Lighting** – coming: Advanced Lighting, Gamma Correction, Shadows, Normal Mapping, Parallax Mapping,
HDR, Bloom, Deferred Shading, SSAO.

**PBR** – coming: Theory, Lighting, IBL.

**In Practice** – coming: Debugging, Text Rendering, 2D Game.

The next chapter, *{{api}}*, explains what the API you have chosen actually is and how it is organised. Then you set
up your IDE and start writing code: first a window, then a cleared window, then the triangle you just saw.

## Additional resources

- [learnopengl.com: Introduction](https://learnopengl.com/Introduction): the introduction of the original
  tutorial this course follows.
- [vulkan-tutorial.com: Introduction](https://vulkan-tutorial.com/Introduction): what the Vulkan tutorial
  covers and expects.
- [Microsoft Learn: Direct3D 12 programming guide](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-guide):
  the official documentation of Direct3D 12.
