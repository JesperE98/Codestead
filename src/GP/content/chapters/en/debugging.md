# Debugging

This chapter starts the last part of the course: *In Practice*, learnopengl's last section. It puts what you have
learned to work. First come two chapters every graphics program needs sooner or later – *Debugging* (this one) and
*Text Rendering* – and then a complete 2D game, built step by step over the rest of the part. learnopengl builds a
clone of a well-known arcade game; the course builds its own game of the same kind, **Hedgerow**: a ball, a paddle
and a wall of blocks in a garden at dusk. None of this is specific to one API: finding mistakes, drawing text and
writing a game loop work the same way in OpenGL, Vulkan and DirectX 12, and each chapter shows how {{api}} does it.

Graphics programming can be a lot of fun, but it can also be a large source of frustration whenever something isn't
rendering just right, or perhaps not even rendering at all. Seeing as most of what we do involves manipulating pixels,
it can be difficult to figure out the cause of error whenever something doesn't work the way it's supposed to.
Debugging these kinds of *visual* errors is different from what you're used to when debugging errors on the CPU. We
have no console to output text to, no breakpoints to set on GPU code, and no way of easily checking the state of GPU
execution.

In this chapter we'll look into several techniques and tricks of debugging your {{api}} program. Debugging in
{{api}} is not that difficult to do and getting a grasp of its techniques definitely pays out in the long run.

## The project

The project is learnopengl's debugging demo: one wooden cube (`wood.png`, the course's own texture), 2.5 units in front
of the camera, turning 10° per second about the axis (1, 1, 1). There is no view matrix – the camera sits at the
origin and looks down -z – and the projection is a perspective one with a field of view of 45° and a far plane at 10.
The depth test and back-face culling are on.

One value differs from learnopengl's demo: the window is cleared to **(0.2, 0.3, 0.3)**, a dark teal, instead of
black. You will see why soon: halfway through the chapter the cube is drawn *black*, and on a black background you
would not see it at all.

learnopengl hides two mistakes in its demo for the reader to find, and so does the project. Build and run it:

:::opengl
the window shows only the teal clear colour. There is no cube, and nothing is printed. The two mistakes are
learnopengl's own: one when the texture is loaded and one when the uniforms are set – but the program does not tell you
anything about them. Finding them is what this chapter is about.
:::
:::vulkan
the cube is there, but in one flat dark brown – no wood grain at all. Nothing in the window tells you why. The
program does print something, though: a few lines starting with `validation layer:`. The mistake is Vulkan's own
(learnopengl's two mistakes are OpenGL calls that have no Vulkan counterpart): something the vertex shader needs is
missing from the pipeline. Finding it is what this chapter is about.
:::
:::d3d12
the window shows only the teal clear colour. There is no cube. Like learnopengl's demo, the project has two mistakes:
one in `PopulateCommandList`, which keeps the draw from finding its projection and its texture, and one in
`LoadTexture`, in the texture's shader resource view. The program says nothing about them. Finding them is what this
chapter is about.
:::

The `// TODO:` comments in the project mark where your code goes. The tasks first add the tools, then use what they
report to fix the mistakes.

Some of the tools are your IDE's **debugger**: you run the program under it, stop it at a **breakpoint** and look at the
**call stack** – the chain of calls that led there – and at the variables.

:::ide vs
**Debug → Start Debugging** (F5) runs the program under the debugger, **Debug → Start Without Debugging** (Ctrl+F5)
without it. F9, or a click in the grey margin left of a line, sets a breakpoint there. When the program stops, the
**Call Stack** window shows how it got there – double-click a line to jump to it – and **Locals** and **Autos** show the
variables; F10 steps over a line, F11 into a call, F5 carries on. What the program prints goes to its console window,
and what it sends to the debugger with `OutputDebugString` to the **Output** window (**View → Output**, *Show output
from: Debug*).
:::
:::ide clion
**Run → Debug** (Shift+F9) runs the program under the debugger, **Run → Run** (Shift+F10) without it – both with the
working directory of your run configuration. A click in the gutter next to a line number, or Ctrl+F8, sets a breakpoint
there. When the program stops, the **Debug** tool window shows the call stack under **Frames** – click a frame to jump
to it – and the variables under **Variables**; F8 steps over a line, F7 into a call, F9 carries on. What the program
prints appears in the **Console** tab of the same window.
:::
:::ide rider
**Run → Debug** runs the program under the debugger, **Run → Run** without it. A click in the gutter next to a line
number sets a breakpoint there. When the program stops, the **Debug** tool window shows the call stack under **Frames**
– click a frame to jump to it – and the variables under **Variables**; the window's toolbar steps over a line, into a
call, or carries on. What the program prints appears in its console, and what it sends to the debugger with
`OutputDebugString` in the window's **Debug Output** tab.
:::
:::ide vscode
**CMake: Debug** (Ctrl+F5, or the bug icon in the status bar) runs the program under the debugger, with the working
directory from `cmake.debugConfig` (*Setting up your IDE*). F9, or a click left of a line number, sets a breakpoint
there. When the program stops, the **Run and Debug** view (Ctrl+Shift+D) shows the **Call Stack** – click a frame to
jump to it – and the **Variables**; F10 steps over a line, F11 into a call, F5 carries on. The debugger's messages – on
Windows also what the program sends with `OutputDebugString` – appear in the **Debug Console** panel, and what the
program prints in the Debug Console or the terminal.
:::

## glGetError()

:::opengl
The moment you incorrectly use OpenGL (like configuring a buffer without first binding any) it will take notice and
generate one or more user error flags behind the scenes. We can query these error flags using a function named
`glGetError` that checks the error flag(s) set and returns an error value if OpenGL got misused:

```cpp
GLenum glGetError();
```

The moment `glGetError` is called, it returns either an error flag or no error at all. The error codes that
`glGetError` can return are listed below:

| Flag | Code | Description |
|---|---|---|
| `GL_NO_ERROR` | 0 | No user error reported since the last call to `glGetError`. |
| `GL_INVALID_ENUM` | 1280 | Set when an enumeration parameter is not legal. |
| `GL_INVALID_VALUE` | 1281 | Set when a value parameter is not legal. |
| `GL_INVALID_OPERATION` | 1282 | Set when the state for a command is not legal for its given parameters. |
| `GL_STACK_OVERFLOW` | 1283 | Set when a stack pushing operation causes a stack overflow. |
| `GL_STACK_UNDERFLOW` | 1284 | Set when a stack popping operation occurs while the stack is at its lowest point. |
| `GL_OUT_OF_MEMORY` | 1285 | Set when a memory allocation operation cannot allocate (enough) memory. |
| `GL_INVALID_FRAMEBUFFER_OPERATION` | 1286 | Set when reading or writing to a framebuffer that is not complete. |

Within OpenGL's function documentation you can always find the error codes a function generates the moment it is
incorrectly used. For instance, if you take a look at the documentation of `glBindTexture`, you can find all the user
error codes it could generate under the *Errors* section.

The moment an error flag is set, no other error flags will be reported. Furthermore, the moment `glGetError` is called
it clears all error flags (or only one if on a distributed system, see note below). This means that if you call
`glGetError` once at the end of each frame and it returns an error, you can't conclude this was the only error, and the
source of the error could've been anywhere in the frame.

Note that when OpenGL runs distributedly like frequently found on X11 systems, other user error codes can still be
generated as long as they have different error codes. Calling `glGetError` then only resets one of the error code flags
instead of all of them. Because of this, it is recommended to call `glGetError` inside a loop.

```cpp
glBindTexture(GL_TEXTURE_2D, tex);
std::cout << glGetError() << std::endl; // returns 0 (no error)

glTexImage2D(GL_TEXTURE_3D, 0, GL_RGB, 512, 512, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
std::cout << glGetError() << std::endl; // returns 1280 (invalid enum)

glGenTextures(-5, textures);
std::cout << glGetError() << std::endl; // returns 1281 (invalid value)

std::cout << glGetError() << std::endl; // returns 0 (no error)
```

The great thing about `glGetError` is that it makes it relatively easy to pinpoint where any error may be and to
validate the proper use of OpenGL. Let's say you get a black screen and you have no idea what's causing it: is the
framebuffer not properly set? Did I forget to bind a texture? By calling `glGetError` all over your codebase, you can
quickly catch the first place an OpenGL error starts showing up.

By default `glGetError` only prints error numbers, which isn't easy to understand unless you've memorized the error
codes. It often makes sense to write a small helper function to easily print out the error strings together with where
the error check function was called:

```cpp
GLenum glCheckError_(const char *file, int line)
{
    GLenum errorCode;
    while ((errorCode = glGetError()) != GL_NO_ERROR)
    {
        std::string error;
        switch (errorCode)
        {
            case GL_INVALID_ENUM:                  error = "INVALID_ENUM"; break;
            case GL_INVALID_VALUE:                 error = "INVALID_VALUE"; break;
            case GL_INVALID_OPERATION:             error = "INVALID_OPERATION"; break;
            case GL_STACK_OVERFLOW:                error = "STACK_OVERFLOW"; break;
            case GL_STACK_UNDERFLOW:               error = "STACK_UNDERFLOW"; break;
            case GL_OUT_OF_MEMORY:                 error = "OUT_OF_MEMORY"; break;
            case GL_INVALID_FRAMEBUFFER_OPERATION: error = "INVALID_FRAMEBUFFER_OPERATION"; break;
        }
        std::cout << error << " | " << file << " (" << line << ")" << std::endl;
    }
    return errorCode;
}
#define glCheckError() glCheckError_(__FILE__, __LINE__)
```

In case you're unaware of what the preprocessor directives `__FILE__` and `__LINE__` are: these variables get replaced
during compile time with the respective file and line they were compiled in. If we decide to stick a large number of
these `glCheckError` calls in our codebase it's helpful to more precisely know which `glCheckError` call returned the
error.

Now do the first task, **check-error**: add the function and the macro, and call `glCheckError();` twice – right after
the texture is loaded (after `stbi_image_free(data);`) and right after the two uniforms are set. Build and run. The
window does not change, but the program now prints two lines:

```text
INVALID_ENUM | main.cpp (180)
INVALID_OPERATION | main.cpp (187)
```

(the numbers are the lines of your two `glCheckError();` calls). The first error happened somewhere while the texture
was loaded, the second while the uniforms were set. That narrows it down a lot. Look at the second place first:

```cpp
    glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 10.0f);
    glUniformMatrix4fv(glGetUniformLocation(shader.ID, "projection"), 1, GL_FALSE, glm::value_ptr(projection));
    glUniform1i(glGetUniformLocation(shader.ID, "tex"), 0);
```

`glUniform*` sets a uniform of the *program in use* – and no program is in use yet: `shader.use()` is only called
later, in the render loop. Both calls fail with `GL_INVALID_OPERATION` and do nothing. The projection matrix stays all
zeros, so every vertex ends up at (0, 0, 0, 0) and no triangle covers a single pixel. That is the empty window.
:::
:::vulkan
OpenGL keeps an error flag that the program asks for with `glGetError`: every call that is used wrongly sets it, and
learnopengl's `glCheckError()` macro reads it after a group of calls and prints the error's name with the file and the
line. Vulkan has no such flag. It reports errors in two very different ways:

- **Return values.** Every Vulkan call that can fail *at run time* – because memory runs out, a device is lost, a swap
  chain is out of date, a file was not a valid shader – returns a `VkResult`: `VK_SUCCESS` or a code like
  `VK_ERROR_OUT_OF_DEVICE_MEMORY`. vulkan-tutorial checks them where it matters, `if (… != VK_SUCCESS) throw
  std::runtime_error(…)`, and the course's code does the same. That is the part of `glGetError`'s job that Vulkan does
  directly.
- **Nothing at all.** Using the API *wrongly* – a missing state, a wrong layout, a value the specification does not
  allow – is not checked by the driver. The specification lists for every call what *valid usage* is, and breaking it
  is undefined behaviour: the program may work on one GPU, draw garbage on another and crash on a third. Checking
  every call would cost time in every frame of every finished program, so Vulkan leaves it out.

The checking lives in an optional layer between your program and the driver: the **validation layer**
(`VK_LAYER_KHRONOS_validation`), which you enabled in the very first Vulkan chapter. It checks each call against the
specification's valid usage rules and sends a message for each violation to a *debug messenger* – the
`VK_EXT_debug_utils` object vulkan-tutorial creates in `setupDebugMessenger()`, with `debugCallback` as the function
that receives the messages. In a release build (`NDEBUG`) `enableValidationLayers` is false, and the program runs
without the layer and its cost.

The project's messenger asks for three severities:

```cpp
        createInfo.messageSeverity = VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT;
        createInfo.messageType = VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT;
```

and `debugCallback` prints every message it gets. That is why the output of the start is so noisy: the loader and the
layer report what they are doing (lines like `validation layer: Searching for ICD drivers named …` and `validation
layer: Loading layer library libVkLayer_khronos_validation.so`), and between those verbose lines there is one that
matters. The severities are bits in the order of their importance:

| Severity | Value | Meaning |
|---|---|---|
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT` | 0x1 | Diagnostic messages (what the loader and the layers do) |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_INFO_BIT_EXT` | 0x10 | Informational messages, like the creation of a resource |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT` | 0x100 | Behaviour that is not necessarily an error, but very likely a bug |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT` | 0x1000 | Behaviour that is invalid and may cause crashes |

so – as vulkan-tutorial points out – a comparison is enough to keep only the important ones. Now do the first task,
**message-severity**: print a message in `debugCallback` only if its severity is a warning or worse:

```cpp
        if (messageSeverity >= VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT) {
            std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;
        }
```

Build and run. The cube is as brown as before, but the program's console is down to one message (shortened here):

```text
validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0x…, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location. The Vulkan spec states: …
```

Read it from the front: it is an **error** of the validation kind; `VUID-VkGraphicsPipelineCreateInfo-Input-07904` is
the *valid usage ID*, the name of the rule in the specification that was broken (the message ends with the rule's text
and a link to it); `Object 0` is the object it is about – a shader module, given by its handle; and the call that broke
the rule was `vkCreateGraphicsPipelines`. Note that `vkCreateGraphicsPipelines` returned `VK_SUCCESS` anyway – the
`throw` after it never fired. Without the layer there would have been no hint at all.
:::
:::d3d12
OpenGL keeps an error flag that the program asks for with `glGetError`: every call that is used wrongly sets it, and
learnopengl's `glCheckError()` macro reads it after a group of calls and prints the error's name with the file and the
line. Direct3D 12 reports errors in two ways:

- **Return values.** Calls that can fail at run time return an `HRESULT` – `S_OK` or an error code such as
  `E_OUTOFMEMORY` or `DXGI_ERROR_DEVICE_REMOVED`. The samples, and the course, wrap them in `ThrowIfFailed`, which turns
  a failure into an exception.
- **The debug layer.** Many calls return nothing at all: `CreateShaderResourceView`, `SetGraphicsRootDescriptorTable`,
  `DrawInstanced` and every other command list call are `void`. Using them wrongly is not checked by the runtime and
  the driver – that would cost time in every frame of every finished program – and the result is undefined: it may
  work on one GPU, draw garbage on another, remove the device on a third. The checking lives in the optional **debug
  layer**, which every course project has enabled since the first DirectX 12 chapter:

```cpp
#if defined(_DEBUG)
    // Enable the debug layer (requires the Graphics Tools "optional feature").
    // NOTE: Enabling the debug layer after device creation will invalidate the active device.
    {
        ComPtr<ID3D12Debug> debugController;
        if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
        {
            debugController->EnableDebugLayer();
```

It exists only in a debug build (`_DEBUG`) on a Windows with the "Graphics Tools" optional feature installed. It checks
each call and writes a message for each mistake to the debugger's output, as lines like

```text
D3D12 ERROR: ID3D12Device::CreateShaderResourceView: … [ STATE_CREATION ERROR #31: CREATESHADERRESOURCEVIEW_INVALIDDIMENSIONS]
```

:::ide vs
In Visual Studio that is the **Output** window: start the program with F5 and choose *Show output from: Debug*.
:::
:::ide rider
In Rider that is the **Debug Output** tab of the **Debug** tool window, when you start the program with **Run → Debug**.
:::
:::ide clion
CLion debugs a program built with the Visual Studio toolchain with its own LLDB-based debugger: start the program with
**Run → Debug** and look for the lines in the **Debug** tool window's **Console** tab. If they don't show up there,
Microsoft's free [DebugView](https://learn.microsoft.com/en-us/sysinternals/downloads/debugview) shows them: start the
program without the debugger (**Run → Run**) while DebugView runs.
:::
:::ide vscode
In VS Code that is the **Debug Console**: with a Visual Studio kit, **CMake: Debug** runs the program under Microsoft's
debugger, which shows these lines there.
:::

That is useful, but only while a debugger runs, and the program knows nothing about it. The program can read the
messages itself, though: the debug layer also stores them in the device's **info queue**, `ID3D12InfoQueue`, which
you get from the device with `QueryInterface` – ComPtr's `As`. With it you can write the Direct3D 12 version of
learnopengl's `glCheckError_`: read every message stored since the last check, print it with the file and the line of
the check, and empty the queue.

```cpp
void CheckDebugMessages_(ID3D12InfoQueue* infoQueue, const char* file, int line)
{
    if (infoQueue == nullptr)
        return;    // no debug layer (a release build): no messages

    UINT64 count = infoQueue->GetNumStoredMessages();
    for (UINT64 i = 0; i < count; i++)
    {
        // first ask how big the message is, then get it into memory of that size
        SIZE_T messageLength = 0;
        infoQueue->GetMessage(i, nullptr, &messageLength);
        D3D12_MESSAGE* message = static_cast<D3D12_MESSAGE*>(malloc(messageLength));
        infoQueue->GetMessage(i, message, &messageLength);

        std::string text = std::string(SeverityName(message->Severity)) + " #" + std::to_string(message->ID) + ": "
            + message->pDescription + " | " + file + " (" + std::to_string(line) + ")\n";
        OutputDebugStringA(text.c_str());    // the debugger's Output window

        free(message);
    }
    infoQueue->ClearStoredMessages();
}
#define CheckDebugMessages() CheckDebugMessages_(m_infoQueue.Get(), __FILE__, __LINE__)
```

`GetMessage` is called twice, as the documentation describes: first with `nullptr` to learn the size of the message
(a `D3D12_MESSAGE` with its text behind it), then with memory of that size. A message has a category, a severity
(`CORRUPTION`, `ERROR`, `WARNING`, `INFO`, `MESSAGE` – `SeverityName`, already in the project, turns it into text), an
`ID` and the description. In case you're unaware of what `__FILE__` and `__LINE__` are: the preprocessor replaces them
with the file and the line they appear in, so each `CheckDebugMessages()` call reports its own place.

Now do the first task, **info-queue**: get the info queue in `LoadPipeline` right after the device is created (inside
`#if defined(_DEBUG)` – in a release build there is no debug layer, `As` fails and `m_infoQueue` stays empty), add the
function and the macro, and call `CheckDebugMessages();` after `LoadTexture(…)` in `LoadAssets` and after
`ExecuteCommandLists` in `OnRender`. Run it under the debugger: the debug layer reports these mistakes, stores them in
the info queue, and your function writes them out. The picture does not change, but the debugger's output now holds the
messages:

```text
ERROR #31: ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture. | main.cpp (…)
ERROR #708: CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x…:'Unnamed ID3D12DescriptorHeap Object') containing handle 0x… is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'. | main.cpp (…)
```

The first once, after the texture is loaded; the second twice after every frame – once for each of the two
`SetGraphicsRootDescriptorTable` calls. Two mistakes, two places. The chapter takes the second one first, because it
is the one that keeps anything from being drawn.
:::

:::opengl
```quiz
After the task check-error the program prints `INVALID_ENUM` once for the texture code, although a second call there fails too (`glGenerateMipmap` on a texture without an image). Why is that second error not printed?
- [ ] Because `glGenerateMipmap` never sets an error flag
- [ ] Because `glCheckError_` stops after the first error it reads
- [x] Because once an error flag is set, OpenGL records no further errors until `glGetError` has read it – the later failure is lost
- [ ] Because errors of the texture functions are only reported at the next draw call
---
That is the weakness of `glGetError`: it tells you that something went wrong since the last check, and the first thing that did, not everything. Calling it often narrows the place down; the debug output below reports every failing call.
```
:::
:::vulkan
```quiz
`vkCreateGraphicsPipelines` returned `VK_SUCCESS`, yet the validation layer reports an error in that very call. How do the two fit together?
- [ ] They don't: the layer is wrong, the pipeline is valid
- [x] The driver does not check valid usage – a pipeline whose vertex shader reads an input no attribute describes is simply undefined behaviour; only the layer compares the call against the specification's rules
- [ ] `VK_SUCCESS` only means that the call was recorded; the real result comes later through the fence
- [ ] The layer turns the error into `VK_SUCCESS` so that the program keeps running
---
The `VkResult` reports what can go wrong at run time (out of memory, device lost …). Misuse of the API is the program's bug, and finding it is the validation layer's job – which is why you run with it during development and without it in a release build.
```
:::
:::d3d12
```quiz
`CreateShaderResourceView` returns `void`. How does the program learn that the view it asked for is invalid?
- [ ] From the `HRESULT` of the next `ThrowIfFailed` call
- [ ] It cannot: the mistake only shows in the picture
- [ ] From `GetDeviceRemovedReason`, which the call sets
- [x] The debug layer checks the call and stores a message (ERROR #31) in the device's info queue, where `GetNumStoredMessages` / `GetMessage` read it
---
Without the debug layer, nothing checks the description at all – the descriptor in the heap is simply invalid, and what a shader reads through it is undefined.
```
:::

:::opengl
Now do the task **use-program**: call `shader.use();` before the two uniform calls. Build and run: the cube appears –
**all black**. Only one line is printed now, `INVALID_ENUM | main.cpp (…)`, from the texture code. The texture is still
broken, and a texture without a (valid) image is *incomplete*: sampling it returns (0, 0, 0, 1). This is where the teal
clear colour pays off.

`glGetError` told us *that* something failed between two checks. It did not tell us *which* call, or why. For that
there is a better tool.
:::

## Debug output

:::opengl
A less common, but more useful tool than `glCheckError` is an OpenGL extension called *debug output* that became part
of core OpenGL since version 4.3. With the debug output extension, OpenGL itself will directly send an error or warning
message to the user with a lot more details compared to `glCheckError`. Not only does it provide more information, it
can also help you catch errors exactly where they occur by intelligently using a debugger.

Debug output is core since OpenGL 4.3, which means you'll find this functionality on any machine that runs OpenGL 4.3
or higher. If they're not available, its functionality can be queried from the `ARB_debug_output` or
`AMD_debug_output` extension (and from `KHR_debug`, the extension the 4.3 functionality was made from, which most
drivers expose for older context versions too). Note that macOS does not seem to support debug output functionality:
its OpenGL stops at 4.1 and has none of these extensions – there `glGetError` is what you have.

**What a 4.3 context means for the course.** Every other OpenGL project of the course asks GLFW for a 3.3 core
context. This one asks for **4.3**:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4); // debug output (glDebugMessageCallback) is core OpenGL since 4.3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true); // comment this line in a release build!
```

A 4.3 core context runs 3.3 core code unchanged – later versions add functions, they take nothing away – so you can
debug any of the course's programs this way: change the two version hints, add the debug hint, and load the 4.3
functions with GLAD (the course's GLAD for this chapter is generated for 4.3 core). learnopengl's demo keeps 3.3 and
relies on a GLAD generated with the `KHR_debug` extension; that works on most drivers as well. Only on a Mac, with its
4.1 maximum, there is no debug output.

In order to start using debug output we have to request a debug output context from OpenGL during our initialization
process – the `GLFW_OPENGL_DEBUG_CONTEXT` hint above, before `glfwCreateWindow`. Note that a debug context may be
slower compared to a non-debug context, so when working on optimizations or releasing your application you want to
remove the debug request hint.

To check if we successfully initialized a debug context we can query OpenGL:

```cpp
    int flags; glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
    if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)
    {
        // initialize debug output
    }
```

The way debug output works is that we pass OpenGL an error logging function callback (similar to GLFW's input
callbacks) and in the callback function we are free to process the OpenGL error data as we see fit; in our case we'll
be displaying useful error data to the console. Below is the callback function prototype that OpenGL expects for debug
output:

```cpp
void APIENTRY glDebugOutput(GLenum source, GLenum type, unsigned int id, GLenum severity,
                            GLsizei length, const char *message, const void *userParam);
```

Given the large set of data we have at our exposal, we can create a useful error printing tool like below:

```cpp
void APIENTRY glDebugOutput(GLenum source,
                            GLenum type,
                            unsigned int id,
                            GLenum severity,
                            GLsizei length,
                            const char *message,
                            const void *userParam)
{
    if (id == 131169 || id == 131185 || id == 131218 || id == 131204) return; // ignore these non-significant error codes

    std::cout << "---------------" << std::endl;
    std::cout << "Debug message (" << id << "): " << message << std::endl;

    switch (source)
    {
        case GL_DEBUG_SOURCE_API:             std::cout << "Source: API"; break;
        case GL_DEBUG_SOURCE_WINDOW_SYSTEM:   std::cout << "Source: Window System"; break;
        case GL_DEBUG_SOURCE_SHADER_COMPILER: std::cout << "Source: Shader Compiler"; break;
        case GL_DEBUG_SOURCE_THIRD_PARTY:     std::cout << "Source: Third Party"; break;
        case GL_DEBUG_SOURCE_APPLICATION:     std::cout << "Source: Application"; break;
        case GL_DEBUG_SOURCE_OTHER:           std::cout << "Source: Other"; break;
    } std::cout << std::endl;

    switch (type)
    {
        case GL_DEBUG_TYPE_ERROR:               std::cout << "Type: Error"; break;
        case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR: std::cout << "Type: Deprecated Behaviour"; break;
        case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:  std::cout << "Type: Undefined Behaviour"; break;
        case GL_DEBUG_TYPE_PORTABILITY:         std::cout << "Type: Portability"; break;
        case GL_DEBUG_TYPE_PERFORMANCE:         std::cout << "Type: Performance"; break;
        case GL_DEBUG_TYPE_MARKER:              std::cout << "Type: Marker"; break;
        case GL_DEBUG_TYPE_PUSH_GROUP:          std::cout << "Type: Push Group"; break;
        case GL_DEBUG_TYPE_POP_GROUP:           std::cout << "Type: Pop Group"; break;
        case GL_DEBUG_TYPE_OTHER:               std::cout << "Type: Other"; break;
    } std::cout << std::endl;

    switch (severity)
    {
        case GL_DEBUG_SEVERITY_HIGH:         std::cout << "Severity: high"; break;
        case GL_DEBUG_SEVERITY_MEDIUM:       std::cout << "Severity: medium"; break;
        case GL_DEBUG_SEVERITY_LOW:          std::cout << "Severity: low"; break;
        case GL_DEBUG_SEVERITY_NOTIFICATION: std::cout << "Severity: notification"; break;
    } std::cout << std::endl;
    std::cout << std::endl;
}
```

Whenever debug output detects an OpenGL error, it will call this callback function and we'll be able to print out a
large deal of information regarding the OpenGL error. Note that we ignore a few error codes that tend to not really
display anything useful (like 131185 in NVIDIA drivers that tells us a buffer was successfully created).

Now that we have the callback function it's time to initialize debug output:

```cpp
    int flags; glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
    if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)
    {
        glEnable(GL_DEBUG_OUTPUT);
        glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS); // makes sure errors are displayed synchronously
        glDebugMessageCallback(glDebugOutput, nullptr);
        glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_TRUE);
    }
```

Here we tell OpenGL to enable debug output. The `glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS)` call tells OpenGL to directly
call the callback function the moment an error occurred – inside the call that caused it. The last parameter of
`glDebugMessageCallback`, `nullptr` here, is handed to the callback as `userParam`. `glDebugMessageControl` decides
which messages are sent; with `GL_DONT_CARE` for source, type and severity and `GL_TRUE`, it enables all of them
(including the low-severity ones, which are off by default).

Now do the task **debug-output**: the 4.3 debug context, the `glDebugOutput` function, and its initialization right
after GLAD is loaded. Build and run. The picture is the same black cube, but now the driver describes the errors in
words (these are Mesa's texts; NVIDIA and AMD word them differently and use other ids):

```text
---------------
Debug message (1): GL_INVALID_ENUM in glTexImage2D(target=GL_FRAMEBUFFER)
Source: API
Type: Error
Severity: high

---------------
Debug message (1): GL_INVALID_OPERATION in glGenerateMipmap(zero size base image)
Source: API
Type: Error
Severity: high

INVALID_ENUM | main.cpp (…)
```

There it is: `glTexImage2D` was called with the target `GL_FRAMEBUFFER`, which is not a texture target. The call fails
and the texture never gets an image. And the debug output also shows what `glGetError` could not: the follow-up error –
`glGenerateMipmap` on a texture whose base image has a size of zero. The last line is your `glCheckError()`, which
still reports the first of them.

Now do the task **fix-texture**: upload the image to `GL_TEXTURE_2D`, the target the texture is bound to:

```cpp
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
```

Build and run: **the wooden cube**, the boards running up its front face – and nothing is printed any more.

### Filtering debug output

With `glDebugMessageControl` you can potentially filter the type(s) of errors you'd like to receive a message from.
In our case we decided to not filter on any of the sources, types, or severity rates. If we wanted to only show
messages from the OpenGL API that are errors and have a high severity, we'd first switch everything off and then
enable just those:

```cpp
glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_FALSE);
glDebugMessageControl(GL_DEBUG_SOURCE_API, GL_DEBUG_TYPE_ERROR, GL_DEBUG_SEVERITY_HIGH, 0, nullptr, GL_TRUE);
```

Given our configuration, and assuming you have a context that supports debug output, every incorrect OpenGL command
will now print a large bundle of useful data.

The application can also send messages of its own (`glDebugMessageInsert`, source `GL_DEBUG_SOURCE_APPLICATION`) and
mark regions of a frame with `glPushDebugGroup` / `glPopDebugGroup`, which the callback sees as push and pop group
messages – and which tools like RenderDoc show as named groups of draw calls. With `glObjectLabel` you give an object
(a buffer, a texture, a program …) a name that messages and tools then use instead of a bare number.

### Backtracking the debug error source

Another great trick with debug output is that you can relatively easily figure out the exact line or call an error
occurred. By setting a breakpoint in `glDebugOutput` at a specific error type (or at the top of the function if you
don't care), the debugger will catch the error thrown and you can move up the call stack to whatever function caused
the message dispatch. This only works because of `GL_DEBUG_OUTPUT_SYNCHRONOUS`: without it the driver may call the
callback later, from another thread, when the call stack no longer shows the guilty call.

It requires some manual intervention, but if you roughly know what you're looking for it's incredibly useful to
quickly determine which call causes an error.
:::
:::vulkan
The messenger sends each message to `debugCallback` with more than the text. vulkan-tutorial's callback has this
signature:

```cpp
    static VKAPI_ATTR VkBool32 VKAPI_CALL debugCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData) {
```

- `messageSeverity` – the severity in the table above.
- `messageType` – `VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT` (something unrelated to the specification or to
  performance, like the loader's lines), `…_VALIDATION_BIT_EXT` (a broken rule of the specification or a likely
  mistake) or `…_PERFORMANCE_BIT_EXT` (a potentially non-optimal use of Vulkan).
- `pCallbackData` – the message itself: `pMessage` (the whole text), `pMessageIdName` (the VUID, here
  `VUID-VkGraphicsPipelineCreateInfo-Input-07904`) and `messageIdNumber`, and `pObjects` / `objectCount`, the objects
  the message is about, each with its type, its handle and – if it has one – its name.
- `pUserData` – a pointer you can give the messenger when you create it (`createInfo.pUserData`), for example your
  application object.

The callback returns a `VkBool32`. `VK_TRUE` would make the call that triggered the message fail with
`VK_ERROR_VALIDATION_FAILED_EXT`; that is only meant for testing the layers themselves, so the callback always returns
`VK_FALSE`.

The order of the two filters matters a little: `createInfo.messageSeverity` decides which messages the messenger is
sent at all, the `if` in the callback which of those it prints. The project keeps the verbose bit in the create info
(so you can turn the `if` around when you want to see what the loader does) and filters in the callback, as
vulkan-tutorial does.

### Object names

`Object 0: handle = 0x…, type = VK_OBJECT_TYPE_SHADER_MODULE` tells you *which kind* of object the message is about,
but a handle is just a number. In a program with dozens of pipelines and hundreds of images you want a name. The
`VK_EXT_debug_utils` extension – the one the messenger comes from – lets you give every Vulkan object a name with
`vkSetDebugUtilsObjectNameEXT`. The validation layer then prints the name with the handle, and graphics debuggers such
as RenderDoc show it too.

Like `vkCreateDebugUtilsMessengerEXT`, it is an extension function, which is not loaded automatically: it is looked up
with `vkGetInstanceProcAddr`, in a proxy function next to the messenger's:

```cpp
// vkSetDebugUtilsObjectNameEXT is a function of the VK_EXT_debug_utils extension too: look it up like the messenger's.
VkResult SetDebugUtilsObjectNameEXT(VkInstance instance, VkDevice device, const VkDebugUtilsObjectNameInfoEXT* pNameInfo) {
    auto func = (PFN_vkSetDebugUtilsObjectNameEXT) vkGetInstanceProcAddr(instance, "vkSetDebugUtilsObjectNameEXT");
    if (func != nullptr) {
        return func(device, pNameInfo);
    } else {
        return VK_ERROR_EXTENSION_NOT_PRESENT;
    }
}
```

A small member function fills the structure – the object's type, its handle as a 64-bit number and the name:

```cpp
    void setObjectName(VkObjectType objectType, uint64_t objectHandle, const char* name) {
        if (!enableValidationLayers) return;

        VkDebugUtilsObjectNameInfoEXT nameInfo{};
        nameInfo.sType = VK_STRUCTURE_TYPE_DEBUG_UTILS_OBJECT_NAME_INFO_EXT;
        nameInfo.objectType = objectType;
        nameInfo.objectHandle = objectHandle;
        nameInfo.pObjectName = name;

        SetDebugUtilsObjectNameEXT(instance, device, &nameInfo);
    }
```

It returns at once without the validation layer: the extension is only enabled together with the layer (see
`getRequiredExtensions()`). Now do the task **object-names**: add both functions, and name the two shader modules in
`createPipeline()` after their files and the texture image in `loadTexture()` after its path:

```cpp
        setObjectName(VK_OBJECT_TYPE_SHADER_MODULE, (uint64_t) vertShaderModule, vertShaderFile.c_str());
        setObjectName(VK_OBJECT_TYPE_SHADER_MODULE, (uint64_t) fragShaderModule, fragShaderFile.c_str());
```

Build and run. The message now says which shader it means:

```text
validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0x…, name = shaders/debugging.vert.spv, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location. …
```

Now the message is a complete description of the mistake: the vertex shader `shaders/debugging.vert.spv` has an input
at location 1, but the pipeline's vertex input state has no attribute description for location 1. The shader:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;
```

and `Vertex::getAttributeDescriptions()` in the start describes only one attribute, the position at location 0. The
pipeline is created anyway, and what the shader reads from an input nobody feeds is undefined; here it reads (0, 0).
Every fragment then samples the texel at (0, 0) – a dark seam of the wood – and the cube is one flat brown. The OpenGL
equivalent of this mistake is a vertex attribute that is never enabled with `glEnableVertexAttribArray`.

Now do the task **fix-attribute**: give the array two elements and describe the texture coordinates:

```cpp
        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, texCoord);
```

Build and run: **the wooden cube**, the boards running up its front face – and nothing is printed any more.

### Labels

The extension has more for graphics debuggers: `vkCmdBeginDebugUtilsLabelEXT` / `vkCmdEndDebugUtilsLabelEXT` mark a
region of a command buffer with a name and a colour (a "shadow pass", a "UI pass"), and `vkCmdInsertDebugUtilsLabelEXT`
a single point. RenderDoc and similar tools show the commands grouped by these labels. They are the counterpart of
OpenGL's `glPushDebugGroup` / `glPopDebugGroup`, as object names are of `glObjectLabel`.
:::
:::d3d12
The info queue gives the program the messages *after* the fact: `CheckDebugMessages()` prints what has accumulated
since the last check. That is the `glGetError` way. learnopengl's better tool is the *debug output*, a callback the
driver calls with each message right when it happens. Direct3D 12 has the same two things, plus one the debugger
offers. Before them, one improvement to the messages themselves.

### Names

The heap in message #708 is called `'Unnamed ID3D12DescriptorHeap Object'`. In a program with many heaps, buffers and
textures, that is not much help. Every Direct3D 12 object (everything derived from `ID3D12Object`) can be given a name
with `SetName`, a wide string; the debug layer's messages then use it, and so do graphics debuggers like PIX (the
OpenGL counterpart is `glObjectLabel`, Vulkan's `vkSetDebugUtilsObjectNameEXT`). Now do the task **set-name**: name
the three heaps when they are created,

```cpp
        m_rtvHeap->SetName(L"RTV heap");
        m_dsvHeap->SetName(L"DSV heap");
        m_cbvSrvHeap->SetName(L"CBV/SRV heap");
```

each render target in the loop that creates them (`std::wstring name = L"Render target " + std::to_wstring(n);` and
`m_renderTargets[n]->SetName(name.c_str());`), and at the end of `LoadAssets` the root signature, the pipeline state,
the vertex buffer, the texture (`L"wood.png"`), the constant buffer and the depth buffer. Run it: message #708 now says
`The descriptor heap (0x…:'CBV/SRV heap') containing handle 0x… is different from currently set descriptor heap
0x0000000000000000:'(nullptr)'.`

### The first mistake

Read the message: the descriptor table points into the heap `'CBV/SRV heap'`, but the descriptor heap set on the
command list is `(nullptr)` – none. A descriptor table is only a GPU handle, an address *inside* a shader-visible
descriptor heap, and a draw can only use descriptors from the heaps the command list has with `SetDescriptorHeaps`. The
start's `PopulateCommandList` sets the root signature and the two tables, but never the heap. So root parameters 1 (the
constant buffer with the projection) and 2 (the texture) point nowhere the draw can follow – formally undefined
behaviour; here nothing is drawn, as with learnopengl's projection that never reaches the shader.

Now do the task **descriptor-heaps**: set the heap before the tables:

```cpp
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());
```

Run it: the cube appears – **all black**. Message #708 is gone; #31 is still printed once at the start. The texture's
view is still invalid, and what a shader reads through it is black here. This is where the teal clear colour pays off.

### The message callback

Newer versions of Direct3D 12 (Windows 11, or a program that ships the Agility SDK) have
`ID3D12InfoQueue1`, and with it learnopengl's debug output: `RegisterMessageCallback` registers a function the debug
layer calls with each message, at the moment the call that causes it is made.

```cpp
void CALLBACK D3D12DebugOutput(D3D12_MESSAGE_CATEGORY category,
                               D3D12_MESSAGE_SEVERITY severity,
                               D3D12_MESSAGE_ID id,
                               LPCSTR description,
                               void* context)
{
    std::string text = "---------------\nDebug message (" + std::to_string(id) + "): " + description + "\n";

    text += "Category: ";
    switch (category)
    {
        case D3D12_MESSAGE_CATEGORY_APPLICATION_DEFINED:   text += "Application defined"; break;
        case D3D12_MESSAGE_CATEGORY_MISCELLANEOUS:         text += "Miscellaneous"; break;
        case D3D12_MESSAGE_CATEGORY_INITIALIZATION:        text += "Initialization"; break;
        case D3D12_MESSAGE_CATEGORY_CLEANUP:               text += "Cleanup"; break;
        case D3D12_MESSAGE_CATEGORY_COMPILATION:           text += "Compilation"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_CREATION:        text += "State creation"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_SETTING:         text += "State setting"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_GETTING:         text += "State getting"; break;
        case D3D12_MESSAGE_CATEGORY_RESOURCE_MANIPULATION: text += "Resource manipulation"; break;
        case D3D12_MESSAGE_CATEGORY_EXECUTION:             text += "Execution"; break;
        case D3D12_MESSAGE_CATEGORY_SHADER:                text += "Shader"; break;
        default:                                           text += "Other"; break;
    }
    text += "\nSeverity: " + std::string(SeverityName(severity)) + "\n\n";

    OutputDebugStringA(text.c_str());    // the debugger's Output window
}
```

It is learnopengl's `glDebugOutput` with Direct3D 12's fields: a category instead of OpenGL's source and type, the
severity, the message's ID and its description; `context` is the pointer given at registration (`nullptr` here).

The second tool is the debugger itself. `SetBreakOnSeverity(severity, TRUE)` makes the debug layer break into the
debugger whenever a message of that severity is produced – exactly like hitting a breakpoint at the guilty call: the
call stack shows the line of your code that made it. That is learnopengl's "backtracking the debug error source"
without having to set the breakpoint yourself. Without a debugger attached, though, the break raises an exception
nobody handles and the program ends – hence `IsDebuggerPresent()`.

Now do the task **debug-callback**: write `D3D12DebugOutput`, and in `LoadPipeline`, after getting the info queue:

```cpp
    if (m_infoQueue)
    {
        if (IsDebuggerPresent())
        {
            m_infoQueue->SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_CORRUPTION, TRUE);
            m_infoQueue->SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_ERROR, TRUE);
        }

        ComPtr<ID3D12InfoQueue1> infoQueue1;
        if (SUCCEEDED(m_infoQueue.As(&infoQueue1)))
        {
            DWORD callbackCookie = 0;
            infoQueue1->RegisterMessageCallback(D3D12DebugOutput, D3D12_MESSAGE_CALLBACK_FLAG_NONE, nullptr, &callbackCookie);
        }
    }
```

(The cookie identifies the registration for `UnregisterMessageCallback`.) Run it. The picture is the same black cube,
but message #31 now arrives the moment `CreateShaderResourceView` is called:

```text
---------------
Debug message (31): ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.
Category: State creation
Severity: ERROR
```

– and with a debugger attached the program stops right at that line of `LoadTexture`. (Started without the debugger,
`IsDebuggerPresent()` returns false, so the program writes the message and carries on.) (The messages also stay in the
queue, so `CheckDebugMessages()` prints them once more afterwards.)

### The second mistake

The message says it plainly: the view asks for `MipLevels` 0, and it must be between 1 and 1 – the texture has one mip
level – or -1 for "all of them". The start fills `srvDesc` like this:

```cpp
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = textureDesc.Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
```

`= {}` sets every field to zero, and `Texture2D.MipLevels` is never set – a view of zero mip levels, which is not a
valid view. `CreateShaderResourceView` returns nothing, the descriptor in heap slot 1 stays invalid, and the shader
reads black through it: learnopengl's incomplete texture. Now do the task **fix-texture**:

```cpp
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
```

Run it: **the wooden cube**, the boards running up its front face – and no messages any more.

### Filtering messages

Like OpenGL's `glDebugMessageControl`, the info queue can filter: `PushStorageFilter` / `PushRetrievalFilter` take a
`D3D12_INFO_QUEUE_FILTER` with lists of categories, severities and message IDs to allow or deny – a message denied by
the storage filter is not stored (nor does it break into the debugger). Real programs often deny a few known,
harmless messages this way.
:::

:::opengl
```quiz
Why does the project enable `GL_DEBUG_OUTPUT_SYNCHRONOUS`?
- [x] So that the driver calls `glDebugOutput` inside the OpenGL call that caused the message: a breakpoint in the callback then shows the guilty call on the call stack
- [ ] Because without it the callback is never called in a core profile context
- [ ] So that the messages are printed in the order of their severity
- [ ] Because it makes every OpenGL call wait until the GPU has finished drawing
---
Without it, a driver may deliver the messages later, from another thread – you would still get the text, but not the place. The price is speed, which is one more reason to drop the debug context in a release build.
```
:::
:::vulkan
```quiz
What does naming the shader module with `vkSetDebugUtilsObjectNameEXT` change?
- [ ] The pipeline is created correctly now, because the layer can find the shader by its name
- [ ] Nothing in the messages; the name is only stored in the SPIR-V file
- [x] Messages about that object show the name next to its handle (`name = shaders/debugging.vert.spv`), and graphics debuggers show it too – the mistake itself stays
- [ ] The name replaces the VUID, so the message gets shorter
---
A name is debugging information only. It costs nothing in a release build: `setObjectName` returns at once when the validation layer (and with it the extension) is not enabled.
```
:::
:::d3d12
```quiz
Why does the project call `SetBreakOnSeverity` only `if (IsDebuggerPresent())`?
- [ ] Because `SetBreakOnSeverity` fails with an `HRESULT` when no debugger is attached
- [ ] Because the info queue only exists while a debugger runs
- [ ] Because otherwise the message callback would no longer be called
- [x] Because the break raises a breakpoint exception: with a debugger it stops at the guilty call, without one nobody handles it and the program ends
---
With a debugger attached, the break is the quickest way to the cause: the call stack shows the line of your code that made the call. Without one, the program prints the messages and keeps running.
```
:::

:::opengl
```quiz
With the uniforms fixed but the texture still broken, the cube was drawn completely black. Why black?
- [ ] Because the debug context draws every object without a texture in black
- [x] Because the texture never got an image: an incomplete texture samples as (0, 0, 0, 1)
- [ ] Because the projection matrix was still all zeros
- [ ] Because `glGenerateMipmap` filled the texture with zeros
---
"Incomplete" means the texture cannot be sampled as it is set up – here it has no image at all; often it is a texture with a mipmap filter but no mipmaps. OpenGL then returns black instead of an error, which is why a black object is a classic hint to check the textures.
```
:::
:::vulkan
```quiz
Before the fix, the cube was one flat brown – the colour of the texel at (0, 0). Why that texel everywhere?
- [ ] Because the sampler's address mode was CLAMP_TO_EDGE
- [ ] Because the image's layout transition was missing
- [x] Because no attribute fed location 1: the shader read the texture coordinates as (0, 0) at every vertex, so every fragment sampled the same texel
- [ ] Because the descriptor set pointed at an empty image
---
What a shader reads from an input that no attribute describes is undefined – (0, 0) on one driver, something else on another. A wrong colour that is the same everywhere often means that the inputs a value is computed from are not varying.
```
:::
:::d3d12
```quiz
Message #708 said the tables point into `'CBV/SRV heap'` while the heap set on the command list is `(nullptr)`. Why does a descriptor table need that heap to be set?
- [ ] Because `SetGraphicsRootDescriptorTable` copies the descriptors out of the heap that is set
- [ ] Because the root signature stores which heap it was created with
- [ ] It doesn't: the message is only a warning
- [x] Because a table is only a GPU handle to a place inside a shader-visible heap, and the shaders can only read descriptors from the heaps set with `SetDescriptorHeaps`
---
At most one CBV/SRV/UAV heap and one sampler heap can be set at a time, and changing them can be costly on some hardware – which is why programs usually put all their descriptors into one big shader-visible heap and set it once per command list.
```
:::

## Debugging shader output

When it comes to GLSL (or HLSL), we unfortunately don't have access to a function like `glGetError` nor the ability to
step through the shader code. When you end up with a black screen or the completely wrong visuals, it's often
difficult to figure out if something's wrong with the shader code. Yes, we have the compilation error reports that
report syntax errors, but catching the semantic errors is another beast.

One frequently used trick to figure out what is wrong with a shader is to evaluate all the relevant variables in a
shader program by sending them directly to the fragment shader's output channel. By outputting shader variables
directly to the output color channels, we can convey interesting information by inspecting the visual results. For
instance, let's say we want to check if a model has correct normal vectors. We can pass them (either transformed or
untransformed) from the vertex shader to the fragment shader where we'd then output the normals as follows:

```glsl
#version 330 core
out vec4 FragColor;
in vec3 Normal;
[...]

void main()
{
    [...]
    FragColor.rgb = Normal;
    FragColor.a = 1.0f;
}
```

By outputting a (non-color) variable to the output color channel like this we can quickly inspect if the variable is,
as far as you can tell, displaying correct values. If, for instance, the visual result is completely black it is clear
the normal vectors aren't correctly passed to the shaders; and when they are displayed it's relatively easy to check if
they're (sort of) correct or not: for world-space normals, surfaces facing right (+x) should be reddish, those facing
up (+y) greenish. Keep in mind that a colour is clamped to 0..1 when it is written: negative components show as 0, so
a normal pointing down the -x axis is as black as no normal at all. For signed values `Normal * 0.5 + 0.5` shows the
whole range.

The cube has no normals, but it has texture coordinates – and they are what the Vulkan project got wrong. Now do the
task **shader-output**: write the texture coordinates as the colour instead of the texture, u as red and v as green,
and keep the texture line as a comment:

:::opengl
```glsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    FragColor = vec4(TexCoords, 0.0, 1.0);
    // FragColor = texture(tex, TexCoords);
```

Build and run: the cube shows a **red–green gradient** on each face: black at a face's bottom-left corner (u, v = 0, 0),
red at the bottom-right (1, 0), green at the top-left (0, 1) and yellow at the top-right (1, 1). The texture coordinates
are what they should be.
:::
:::vulkan
```glsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    outColor = vec4(fragTexCoord, 0.0, 1.0);
    // outColor = texture(texSampler, fragTexCoord);
```

Build and run: the cube shows a **red–green gradient** on each face: black at a face's bottom-left corner (u, v = 0, 0),
red at the bottom-right (1, 0), green at the top-left (0, 1) and yellow at the top-right (1, 1) – the texture is loaded
flipped (`stbi_set_flip_vertically_on_load(true)`), so the coordinates are OpenGL's. Had you done this before the fix,
the whole cube would have been black: (0, 0) everywhere – which points straight at the texture coordinates.
:::
:::d3d12
```hlsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    return float4(input.texCoord, 0.0f, 1.0f);
    // return tex.Sample(wrapSampler, input.texCoord);
```

Run it: the cube shows a **red–green gradient** on each face: black at a face's top-left corner (u, v = 0, 0), red at
the top-right (1, 0), green at the bottom-left (0, 1) and yellow at the bottom-right (1, 1). This differs from the
OpenGL picture on purpose: in Direct3D v = 0 is the top row of an image, so the course's vertex data uses OpenGL's
1 - v to keep the wood upright – and green, which is v, grows towards the bottom of each face here. The task shows the
value the shader really has.
:::

```quiz
A lit model comes out completely black. You write its normal as the fragment colour (`FragColor.rgb = Normal;`) and the model is still completely black. What is the most likely conclusion?
- [ ] The lighting code is wrong, the normals are fine
- [ ] The model is too far away from the light
- [ ] The texture is incomplete
- [x] The normals don't reach the fragment shader (they are zero) – check the vertex attribute and how the vertex shader passes them on
---
Normals of a real model point in all directions, so at least some faces would show red, green or blue. All black means zero (or only negative components – which is why `Normal * 0.5 + 0.5` is the safer test).
```

## OpenGL GLSL reference compiler

Each driver has its own quirks and tidbits; for instance, NVIDIA drivers are more flexible and tend to overlook some
restrictions on the specification, while ATI/AMD drivers tend to better enforce the OpenGL specification (the
better approach, in the view of learnopengl's author). The result of this is that shaders on one machine may not work on the other due to
driver differences.

With years of experience you'll eventually get to learn the minor differences between GPU vendors, but if you want to
be sure your shader code runs on all kinds of machines you can directly check your shader code against the official
specification using OpenGL's GLSL reference compiler, **glslangValidator** (part of Khronos' glslang project and of the
Vulkan SDK). Given a shader file, it tells you whether the code is valid GLSL: `glslangValidator debugging.vert`. It
picks the shader stage from the file's extension – `.vert`, `.frag`, `.geom`, `.tesc`, `.tese`, `.comp` – so a file
with another extension needs the stage given explicitly, for example `glslangValidator -S vert debugging.vs`. Note
that it validates against the specification, not against your driver: code it accepts can still hit a driver bug, but
code it rejects should not be relied on anywhere.

:::opengl
The course's OpenGL shaders are `.vs` and `.fs` files, so `-S vert` and `-S frag` are needed for them.
:::
:::vulkan
In Vulkan you use this compiler already: GLSL is compiled to SPIR-V before the program runs (with `glslc` or
`glslangValidator -V`, the course's build does it for you), so every syntax and type error is reported at build time,
never by the driver. What the compiler cannot know is how the shader is *used* – which attributes the pipeline feeds,
which descriptors are bound – and that is exactly the kind of mistake the validation layer reported in this chapter.
:::
:::d3d12
In Direct3D 12 the HLSL compiler is Microsoft's own, the same for every driver: `D3DCompileFromFile` (and the offline
compilers `fxc` and `dxc`) reports errors with the line and column, and the course's projects print them through the
error blob – the last argument of `D3DCompileFromFile`. Drivers receive compiled bytecode, not source, so there is far
less room for vendor differences in the language itself. What the compiler cannot check is how the shader is *used*:
that is the debug layer's job, as in this chapter.
:::

## Framebuffer output

:::opengl
When a framebuffer is not complete, nothing you draw into it arrives. Since the Framebuffers chapter the course has
checked every framebuffer it makes:

```cpp
if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
    std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
```

The returned status names the reason (`GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT`, `…_MISSING_ATTACHMENT`, …), and drawing
or reading an incomplete framebuffer sets `GL_INVALID_FRAMEBUFFER_OPERATION` – the last row of `glGetError`'s table.
:::
:::vulkan
Vulkan has no completeness check to call: a framebuffer, its attachments and the render pass it is used with are
checked by the validation layer when they are created and used (wrong formats, sizes, usage flags, a framebuffer that
is not compatible with the render pass …) – one more reason to keep the layer on during development.
:::
:::d3d12
Direct3D 12 has no completeness check to call: render target and depth-stencil views are checked by the debug layer
when they are created and bound (formats, dimensions, a view that does not fit its resource, a PSO whose `RTVFormats`
differ from the bound targets …) – one more reason to keep the layer on during development.
:::

Another useful trick in your debugging toolkit is displaying the contents of a framebuffer (or a render target) in some
pre-defined region of your screen. You're likely to use framebuffers quite often and, as most of their magic happens
behind the scenes, it's sometimes difficult to figure out what's going on. Displaying the contents of a framebuffer on
your screen is a useful trick to quickly see if things look correct.

Note that displaying the contents (attachments) of a framebuffer as explained here only works on texture attachments,
not render buffer objects (or other targets you cannot sample).

The idea is learnopengl's: a small screen-filling quad shader with a vertex shader that only passes the position and
texture coordinates on, and a fragment shader that samples the texture. A helper function draws that quad in a corner
of the screen – for example the top-right – with the texture you want to see bound:

```cpp
void DisplayFramebufferTexture(unsigned int textureID)
{
    if (!initialized)
    {
        // initialize shader and vao w/ NDC vertex coordinates at top-right of the screen
        [...]
    }

    glActiveTexture(GL_TEXTURE0);
    glUseProgram(shaderDisplayFBOOutput);
        glBindTexture(GL_TEXTURE_2D, textureID);
        glBindVertexArray(vaoDebugTexturedRect);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);
    glUseProgram(0);
}

int main()
{
    [...]
    while (!glfwWindowShouldClose(window))
    {
        [...]
        DisplayFramebufferTexture(fboAttachment0);

        glfwSwapBuffers(window);
    }
}
```

This will give you a nice little window at the corner of your screen for debugging framebuffer output – useful, for
example, when you're trying to figure out if the normal vectors of the geometry pass in a deferred renderer look
correct. You can of course extend such a utility function to support rendering more than one texture. This is a quick
and dirty way to get continuous feedback from whatever is in your framebuffer(s). The same works in every API: draw a
quad with the render target's texture – the course did exactly that in the Shadow Mapping chapter, with the depth map
on the screen.

## External debugging software

When all else fails there is still the option to use a 3rd party tool to help us in our debugging efforts. Third
party applications often inject themselves in the graphics drivers and are able to intercept all kinds of API calls
to give you a large array of interesting data. These tools can help you in all kinds of ways like: profiling the
usage of API functions, finding bottlenecks, inspecting buffer memory, and displaying textures and framebuffer
attachments. When you're working on (large) production code, these kinds of tools can become invaluable in your
development process.

The workflow is the same in all of them: you start your program from the tool (or attach the tool to it), *capture* a
frame, and then step through that frame's API calls one by one – with the state of the pipeline at every draw, the
contents of every buffer and texture, and for a chosen pixel its whole history: which draws touched it and what each
shader returned.

- **RenderDoc** is a great (completely free and open source) standalone debugging tool for Vulkan, Direct3D 11 and 12,
  OpenGL (core profile, 3.2 and up) and OpenGL ES. It shows the object names this chapter gave (`glObjectLabel`,
  `vkSetDebugUtilsObjectNameEXT`, `SetName`) and the groups and labels of command buffer regions.
- **NVIDIA Nsight Graphics** is NVIDIA's graphics debugger and profiler for Direct3D, Vulkan and OpenGL; it works best
  on NVIDIA hardware, where it also shows what the GPU's units are doing.
- **PIX on Windows** is Microsoft's tool for Direct3D 12 programs: GPU captures of frames, and timing captures that
  show where a frame's time goes on the CPU and the GPU.

learnopengl also lists AMD's CodeXL, which AMD no longer develops; its successors are AMD's Radeon developer tools.

:::d3d12
The debug layer itself has more than this chapter used. **GPU-based validation** (`ID3D12Debug1::SetEnableGPUBasedValidation(TRUE)`,
before the device is created) patches the shaders so that the GPU checks, while it runs, what the CPU-side layer cannot
see: descriptors that are uninitialized or of the wrong type, resources in the wrong state, indexing past the end of a
heap. It is slow, so it is meant for occasional test runs. And **DRED** (*Device Removed Extended Data*) records, when
the GPU crashes and the device is removed, which command list operations had run and which page fault address was hit –
the answer to "where did it crash?" when `DXGI_ERROR_DEVICE_REMOVED` is all you get otherwise.
:::
:::vulkan
The validation layer itself has more than this chapter used: *synchronization validation* (missing barriers and
hazards between commands), *GPU-assisted validation* (checks inside the shaders, for example of descriptor indexing),
*best practices* warnings, and *debug printf*, a `printf` for shaders. They are switched on with
`VkValidationFeaturesEXT` or with the Vulkan Configurator (`vkconfig`) of the Vulkan SDK.
:::

```quiz
What does a frame capture in RenderDoc (or Nsight Graphics, or PIX) give you that the debug messages of this chapter don't?
- [ ] A list of every API call that broke a rule of the specification
- [ ] Faster rendering, because the tool replaces the driver
- [x] Every call of one frame in order, with the pipeline state, the bound resources, the contents of buffers and textures at each draw and the history of a pixel – for mistakes that are perfectly legal API use but give the wrong picture
- [ ] The shader source code of every program running on the computer
---
The messages find *illegal* use of the API. A wrong matrix, a wrong blend state or a texture bound to the wrong slot is legal – it just draws the wrong thing. That is where stepping through a captured frame helps.
```

## Additional resources

- [Debugging](https://learnopengl.com/In-Practice/Debugging): learnopengl's chapter this chapter follows.

:::opengl
- [glGetError](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetError.xhtml) and
  [glDebugMessageCallback](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDebugMessageCallback.xhtml): the
  reference pages, with the error codes and the callback's parameters.
- [KHR_debug](https://registry.khronos.org/OpenGL/extensions/KHR/KHR_debug.txt): the extension debug output was made
  from, with the default state of every message.
:::
:::vulkan
- [Validation layers](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Validation_layers): vulkan-tutorial's
  chapter on the layer, the messenger and the callback.
- [Debugging (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/debugging.html): object names,
  labels and the messenger in the specification.
:::
:::d3d12
- [Understanding the D3D12 debug layer](https://learn.microsoft.com/en-us/windows/win32/direct3d12/understanding-the-d3d12-debug-layer)
  and [GPU-based validation](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-d3d12-debug-layer-gpu-based-validation):
  Microsoft's documentation of the debug layer.
- [ID3D12InfoQueue::GetMessage](https://learn.microsoft.com/en-us/windows/win32/api/d3d12sdklayers/nf-d3d12sdklayers-id3d12infoqueue-getmessage):
  reading the stored messages.
:::
