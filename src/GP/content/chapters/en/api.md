# {{api}}

Before you write any code, it helps to know what {{api}} actually is, how it is organised and what kind of
programming it asks of you. This chapter has no tasks: it is the theory you need for the next chapters. The project
on the right is still the triangle program from the introduction, so you can build and run it and find the code
this chapter talks about.

:::opengl
## What OpenGL is

People usually call OpenGL an API (an *Application Programming Interface*): a large set of functions for drawing
graphics. Strictly speaking, though, OpenGL is not a library at all but a **specification**, written and maintained
by the [Khronos Group](https://www.khronos.org/opengl/).

The specification states precisely what every function has to do and what its result must be – but not *how* that
is achieved. That part is left to whoever *implements* the specification. Two implementations may work completely
differently inside, as long as you, the user, get the results the specification promises.

In practice the implementations are written by the graphics card manufacturers and shipped as part of their
drivers; each card supports certain OpenGL versions. On macOS, Apple maintains the implementation itself, and on
Linux there are both the manufacturers' drivers and open-source implementations. So when you call `glDrawArrays`,
the code that runs is the driver's. A consequence: when OpenGL does something strange that the specification does
not allow, the cause is most likely a bug in the driver, and the usual fix is to install a newer driver. That is one
reason why it is a good idea to keep your graphics drivers up to date.

Khronos publicly hosts all specification documents for all the OpenGL versions in the
[OpenGL registry](https://registry.khronos.org/OpenGL/index_gl.php). If you are interested in the exact behaviour
of a function, the specification of version 3.3 (which is what this course uses) is a good, if technical,
reference.

```quiz
Strictly speaking, what is OpenGL?
- [x] A specification: it says what each function must do, and graphics card manufacturers implement it in their drivers
- [ ] A library written by the Khronos Group that you install next to your program
- [ ] A part of the operating system that works the same on every graphics card
---
OpenGL itself is only a specification. The code that runs when you call `glDrawArrays` is the driver's implementation, which is why bugs in OpenGL are usually fixed by updating the driver.
```

## Core-profile vs Immediate mode

Older OpenGL was used in **immediate mode**, often called the *fixed-function pipeline*. You described your
geometry vertex by vertex with simple calls, and the library did most of the work out of sight: how vertices were
transformed and lit was largely fixed, and you could only switch options on and off. That was easy to learn, but it
was inefficient, and it gave you little control. As graphics hardware became programmable, developers wanted that
control, and the specification grew more flexible. OpenGL 3.0 marked the old immediate-mode functionality as
deprecated, and since version 3.2 the specification is split into profiles: the **core profile** contains only the
modern functionality, without the deprecated parts.

In a core-profile context the deprecated functions are simply not there, and using them is an error, so you are
forced to work the modern way: you put your data in buffers on the GPU and write shaders that process it. That is
harder at first than immediate mode, which hid what OpenGL actually does. But it is far more flexible and efficient,
and because nothing is hidden, you end up really understanding how graphics programming works.

This is also the reason why this course is geared at core-profile OpenGL **version 3.3**. You can see the request
for exactly that in the project, right after GLFW is initialised:

```cpp
glfwInit();
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
```

Later versions of OpenGL, up to 4.6, add useful features without changing the core mechanics: they offer more
efficient or more convenient ways to do the same things. Everything you learn with 3.3 therefore stays valid, and
when you are ready you can pick up the newer functionality where you need it. Keep in mind that the newer the
version you require, the fewer graphics cards can run your program – which is why many programs target an older
version and only use newer features when they are available.

```quiz
Your program asks for an OpenGL 3.3 core profile context. What happens with the old immediate-mode functions?
- [ ] They still work, but run more slowly
- [x] They are not part of the core profile: they are not available, and trying to use them is an error
- [ ] The driver converts them to modern calls automatically
---
The core profile is the part of the specification without the deprecated functionality. That forces you to use the modern, flexible way of drawing – which is what this course teaches.
```

## Extensions

OpenGL can be extended. When a manufacturer develops a new rendering technique or optimisation, it often ships
it as an **extension** in its driver before it is part of any OpenGL version. A program can use that functionality
on hardware whose driver offers the extension, without waiting for the next version of the specification. Useful
extensions are often adopted by later OpenGL versions; much of what is core in 3.3 started out as an extension.

Because not every driver offers every extension, a program has to check that an extension is available before it
uses it, and fall back to another way when it is not. Function loaders such as GLAD, which this course uses, can be
generated with the extensions you want and then tell you at run time which of them are present. For most techniques
in this course OpenGL 3.3 is enough; where an extension is needed, the chapter says so.

```quiz
What is an OpenGL extension?
- [ ] A newer OpenGL version that every graphics card supports
- [x] Functionality a driver offers beyond the core specification, which your program has to check for before using it
- [ ] A file type for OpenGL shaders
---
Extensions let manufacturers ship new features before they are part of the specification. Since not every driver has them, you check for an extension before you use it; popular extensions often become part of a later OpenGL version.
```

## State machine

OpenGL is one big **state machine**: a large collection of settings that determine how OpenGL operates right now.
This state is called the OpenGL **context**. Working with OpenGL mostly means changing that state – setting
options, binding buffers – and then issuing commands that work with whatever the current state is.

Say you want to draw lines instead of filled triangles: you change a setting in the context, and from then on every
draw command draws lines, until you change the setting back. Nothing is passed to the draw call itself; it simply
uses the current state.

OpenGL functions therefore come in two kinds: **state-changing** functions that set something in the context, and
**state-using** functions that do some work based on the current state. The render loop of the project has one of
each:

```cpp
glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);
```

`glClearColor` draws nothing: it only sets the clear colour in the context. `glClear` then *uses* that state and
fills the window with the colour that is currently set. Keep this picture of one large state machine in mind, and
much of OpenGL's design will make sense.

```quiz
In the render loop, `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` is followed by `glClear(GL_COLOR_BUFFER_BIT);`. Which statement is right?
- [ ] Both calls fill the window, so one of them could be removed
- [x] `glClearColor` only changes the state (the clear colour); `glClear` uses that state and fills the window with it
- [ ] `glClearColor` fills the window, and `glClear` makes the result visible
---
`glClearColor` is a state-changing function and `glClear` a state-using function. The colour stays set in the context until you change it again.
```

## Objects

OpenGL's interface is a C interface, so that it can be called from many languages. It therefore has no classes;
instead, it groups related state into **objects**. An OpenGL object is a bundle of settings (and often data) that
forms part of the state: a *buffer object* is a piece of GPU memory with its settings, and a *vertex array object*
remembers how the vertex data in buffers is laid out. You never get a pointer or a C++ object for them: OpenGL gives
you a number, an **id**, that refers to the object.

Using an object nearly always follows the same pattern: you *generate* the object and keep its id, you *bind* it
to a target of the context, you set its options or data through that target, and you un-bind it again by binding
id 0. This is exactly what the project does with its vertex data:

```cpp
unsigned int VBO, VAO;
glGenVertexArrays(1, &VAO);
glGenBuffers(1, &VBO);
// bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
glBindVertexArray(VAO);

glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

`glGenBuffers` creates a buffer object and stores its id in `VBO`. `glBindBuffer(GL_ARRAY_BUFFER, VBO)` binds it to
the `GL_ARRAY_BUFFER` target, and from then on, every call that works on `GL_ARRAY_BUFFER` works on *this* buffer:
`glBufferData` copies the vertices into it, without even mentioning `VBO`. Afterwards the project un-binds it:

```cpp
glBindBuffer(GL_ARRAY_BUFFER, 0);
```

The point of objects is that you can create as many as you like, configure each one once, and later just bind the
one you need. A program that draws a house and a character keeps the data and settings of each model in its own
objects; to draw one of them, it binds that model's objects and draws, without setting every option again.

```quiz
What does `glBindBuffer(GL_ARRAY_BUFFER, VBO);` do?
- [ ] It copies the vertex data to the GPU
- [x] It makes the buffer with the id `VBO` the current `GL_ARRAY_BUFFER`, so the following calls on that target work on it
- [ ] It creates a new buffer object
---
Binding attaches an object to a target of the context. `glGenBuffers` creates the object, and `glBufferData` copies data into whatever buffer is bound to the target.
```
:::
:::vulkan
## What Vulkan is

Vulkan is a graphics and compute API from the [Khronos Group](https://www.khronos.org/), the same consortium that
maintains OpenGL. Like OpenGL it is a **specification**: Khronos describes exactly what every function must do, and
the graphics card manufacturers implement it in their drivers. Your program talks to those drivers through the
**Vulkan loader**, which finds the installed drivers and the optional layers. Vulkan 1.0 was released in 2016;
newer versions (1.1, 1.2, 1.3, 1.4) added features, but the basic model you learn here is the same in all of them.
Like vulkan-tutorial.com, the project asks for version 1.0 (`VK_API_VERSION_1_0`), because everything it uses
exists since then.

Vulkan runs on Windows, Linux and Android; on macOS and iOS it runs on top of Apple's Metal through a translation
layer (MoltenVK).

## Origin of Vulkan

OpenGL and the early versions of Direct3D were designed when GPUs were largely fixed-function hardware with a few
configurable options. GPUs then became highly programmable, and the old APIs were extended again and again to expose the new
features. The result was an abstraction that no longer matched the hardware: the driver had to work out from a
stream of state changes what the program actually meant, and then translate it into what the GPU needs. That
guesswork costs CPU time, and it is why new drivers so often bring big performance gains in specific games. It also
makes drivers complex, so the behaviour differs between vendors – for example in which shader code their compilers
accept. And because OpenGL keeps all its state in one context that belongs to one thread, it is hard to use several
CPU threads to prepare work for the GPU.

Vulkan was designed from scratch for modern GPUs, including the tile-based GPUs in phones. It is **explicit**: you
describe exactly what you intend, in detail, so the driver doesn't have to guess and can be much simpler and
faster. Several threads can record and submit commands in parallel. Shaders are handed to the driver in a
standardised bytecode, SPIR-V, instead of source code, which removes the differences between vendors' compilers.
And graphics and compute work go through the same API.

```quiz
Why was Vulkan designed as an explicit API?
- [ ] Because it only has to run on Windows
- [ ] To make the first triangle shorter to write than in OpenGL
- [x] So that the driver no longer has to guess the programmer's intent: you state exactly what you want, which reduces driver overhead and allows recording commands on several threads
---
Older APIs left the driver to work out what you meant, which cost performance and caused differences between vendors. Vulkan makes you spell it out – more code, but predictable behaviour.
```

## Objects and create infos

Vulkan has no hidden global state like OpenGL's context. Everything is an explicit object with a handle type
(`VkInstance`, `VkDevice`, `VkBuffer` …), and you pass the objects you mean to every function. Objects are created
with `vkCreateXXX` (or allocated from another object with `vkAllocateXXX`) and destroyed with `vkDestroyXXX` (or
`vkFreeXXX`). The parameters are passed in a *create info* structure: you fill a struct, set its `sType` member to
say which structure it is, and pass a pointer to it. This is how the project describes the application and creates
the **instance**, the connection between your program and the Vulkan library:

```cpp
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
```

```cpp
if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS) {
    throw std::runtime_error("failed to create instance!");
}
```

Almost every function returns a `VkResult` that is either `VK_SUCCESS` or an error code; the project turns errors
into exceptions. The `nullptr` is an optional custom memory allocator for the driver's CPU-side memory, which this
course never uses. Everything you create, you also destroy yourself: `cleanup()` destroys all objects in reverse
order.

## What it takes to draw a triangle

Here are all the steps it takes to render a triangle in a well-behaved Vulkan program. You will build each of them
in the coming chapters; this is just the big picture to relate them to. It is the list of calls in the project's
`initVulkan()`:

```cpp
void initVulkan() {
    createInstance();
    setupDebugMessenger();
    createSurface();
    pickPhysicalDevice();
    createLogicalDevice();
    createSwapChain();
    createImageViews();
    createRenderPass();
    createGraphicsPipeline();
    createFramebuffers();
    createCommandPool();
    createVertexBuffer();
    createCommandBuffer();
    createSyncObjects();
}
```

- **Instance and physical device.** After the `VkInstance`, you look for the graphics cards with Vulkan support
  and choose one: a `VkPhysicalDevice`. You can query its properties and features to pick the best one.
- **Logical device and queues.** You then create a `VkDevice`, the *logical device*: your connection to the chosen
  card, with the features you want to use enabled. Most work in Vulkan – drawing, memory transfers – is not executed
  immediately but submitted to a `VkQueue`. Queues come from *queue families*, each supporting a specific set of
  operations (graphics, compute, transfer, presentation). The project needs a queue that can draw and one that can
  present to the window (often the same family).
- **Window surface and swap chain.** Vulkan itself knows nothing about windows. The `VkSurfaceKHR` (made by GLFW
  from the window) and the `VkSwapchainKHR` come from the window system integration *extensions* – that is what the
  `KHR` suffix means. The swap chain is a set of images to render into; while you draw into one, another one is on
  the screen.
- **Image views and framebuffers.** An image from the swap chain is wrapped in a `VkImageView` (which part of the
  image to use, and how) and a `VkFramebuffer` (which image views the render pass draws into).
- **Render pass.** A `VkRenderPass` describes the images used while rendering and what happens to their contents –
  here: one colour image that is cleared at the start.
- **Graphics pipeline.** The `VkPipeline` contains *all* the configurable state of the GPU: the shaders, the vertex
  layout, the viewport, rasterisation, blending. Almost nothing can be changed later; a different configuration is a
  different pipeline. This lets the driver compile and optimise everything up front.
- **Command pool and command buffers.** Drawing commands are recorded into a `VkCommandBuffer`, allocated from a
  `VkCommandPool`.
- **Main loop.** Each frame, `drawFrame()` acquires an image from the swap chain, records a command buffer that
  draws into it, submits that to the graphics queue and presents the image.

Even the memory of the vertex buffer is explicit: the project creates the `VkBuffer`, asks which memory types it
can live in, allocates a `VkDeviceMemory` itself and binds the two together.

```quiz
What is the difference between a `VkPhysicalDevice` and a `VkDevice`?
- [x] The physical device is a graphics card you can choose; the logical device is your connection to it, with the features and queues you asked for
- [ ] They are two names for the same object
- [ ] The physical device is for drawing, the logical device for presenting to the window
---
You pick a `VkPhysicalDevice` with `pickPhysicalDevice()` and then create a `VkDevice` for it in `createLogicalDevice()`. Almost every other object is created from the logical device.
```

## Command buffers and queues

In OpenGL, `glDrawArrays` looks as if it draws immediately (the driver collects and sends the commands behind your
back). In Vulkan you do that yourself: you **record** commands into a command buffer – begin the render pass, bind
the pipeline, bind the vertex buffer, draw, end the render pass – and then **submit** the command buffer to a queue
with `vkQueueSubmit`. The GPU executes it asynchronously, while your program continues. Because recording is just
filling a buffer, several threads can record command buffers at the same time, and a command buffer can be
recorded once and submitted many times.

```quiz
How does a draw command reach the GPU in Vulkan?
- [ ] The driver collects all calls and sends them to the GPU on its own
- [ ] `vkCmdDraw` draws the triangle immediately
- [x] It is recorded into a command buffer, which is submitted to a queue with `vkQueueSubmit` and executed asynchronously
---
The `vkCmd…` functions only record. Nothing happens on the GPU until the command buffer is submitted to a queue.
```

## Explicit synchronisation

Because the GPU works asynchronously, you have to tell Vulkan in which order things must happen – the driver
doesn't do it for you. Vulkan has two main tools for that:

- A **semaphore** (`VkSemaphore`) orders work *on the GPU*: one queue operation signals it, another waits for it.
  The project uses `imageAvailableSemaphore` so that rendering waits until the swap chain image is available, and
  `renderFinishedSemaphores` so that presentation waits until rendering is done.
- A **fence** (`VkFence`) lets *the CPU* wait for the GPU. The project waits on `inFlightFence` at the start of
  every frame, so it doesn't re-record the command buffer while the GPU is still using it:

```cpp
void drawFrame() {
    vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
    vkResetFences(device, 1, &inFlightFence);

    uint32_t imageIndex;
    vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);
```

Getting synchronisation wrong doesn't necessarily give an error – it can give flickering, corrupted images or a
program that works on one GPU and not on another. That is why the next tool is so important.

```quiz
What does the fence `inFlightFence` do in `drawFrame()`?
- [ ] It makes the GPU wait until the swap chain image is available
- [ ] It limits the frame rate to the refresh rate of the screen
- [x] It makes the CPU wait until the GPU has finished the previous frame, so the command buffer is not re-recorded while it is still in use
---
Fences are for the CPU waiting on the GPU. Ordering between operations on the GPU – acquiring, rendering, presenting – is done with semaphores.
```

## Extensions and validation layers

Like OpenGL, Vulkan has **extensions**: functionality outside the core specification that you have to enable
explicitly. Their names have a suffix for who made them: `KHR` for Khronos-ratified extensions such as the surface
and the swap chain, `EXT` for multi-vendor extensions such as the debug messenger. The project enables the swap
chain extension on the device:

```cpp
const std::vector<const char*> deviceExtensions = {
    VK_KHR_SWAPCHAIN_EXTENSION_NAME
};
```

Vulkan is designed for high performance and low driver overhead, so by default it does **very little error
checking**. A wrong parameter or a forgotten synchronisation can crash the program, or silently work on your
graphics card and fail on another. Instead, you can enable **validation layers**: code that sits between your
program and the driver and checks every call against the specification. The standard one is
`VK_LAYER_KHRONOS_validation`, which comes with the Vulkan SDK from LunarG:

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

In debug builds the layer is enabled, and the project's `debugCallback` prints its messages to the output as
`validation layer: …`. In release builds you switch it off and pay nothing for it. A correct program produces no
validation errors – treat every one as a bug.

```quiz
You make a mistake in a Vulkan call, and the validation layers are not enabled. What happens?
- [ ] The driver corrects the mistake automatically
- [ ] Vulkan always reports the error with a clear message
- [x] Possibly nothing visible: the behaviour is undefined, so the program may crash, draw wrongly or happen to work on your GPU
---
Vulkan itself checks very little to keep the driver fast. The validation layers do the checking during development and print a message for every misuse they find.
```

## Shaders: SPIR-V

Vulkan doesn't take shader source code. It takes **SPIR-V**, a binary intermediate format. You still write the
shaders in a high-level language – in this course GLSL, as in OpenGL – and compile them to SPIR-V before the
program runs (normally with `glslc` from the Vulkan SDK; here **Build & run** does it for you). The program then
loads the compiled files:

```cpp
auto vertShaderCode = readFile("shaders/vert.spv");
auto fragShaderCode = readFile("shaders/frag.spv");
```

Because every driver gets the same, already compiled bytecode, you no longer depend on each vendor's GLSL
compiler and its quirks.

## A thousand lines for a triangle

The project's `main.cpp` is about a thousand lines long – for one triangle. That is the honest reality of Vulkan:
before anything appears on the screen, you have to set up everything that OpenGL's driver did for you, and say
explicitly how memory, images, pipelines and synchronisation should work.

It pays off. Nothing happens behind your back, so performance is predictable; the work is spread over several
threads; the same code behaves the same on every vendor's driver (with the validation layers to keep you honest);
and you learn how modern GPUs really work. Also, most of those lines are one-time setup: once the triangle is on
the screen, adding textures, a camera or lighting takes about as much new code as in OpenGL.
:::
:::d3d12
## What Direct3D 12 is

Direct3D 12 is the 3D graphics API of Microsoft's DirectX 12, introduced with Windows 10 in 2015. Unlike OpenGL and
Vulkan it is not an open specification: Microsoft makes the API and the runtime (`d3d12.dll`), and the graphics card
manufacturers write drivers for it. It runs on Windows 10 and 11 and on Xbox. Direct3D 12 works together with
**DXGI** (the DirectX Graphics Infrastructure), the part of Windows that knows the graphics adapters and creates
swap chains for windows.

Direct3D 12 provides a lower level of hardware abstraction than earlier versions. Direct3D 11 managed memory,
tracked resource states and synchronised the CPU and the GPU for you; in Direct3D 12 your program does that
itself. In return it is faster and more efficient: there is less driver overhead, and the work of recording
commands can be spread over several CPU threads. Direct3D 12 is an **explicit** API, like Vulkan: more code and more
responsibility, but full control.

```quiz
What is the main difference between Direct3D 12 and Direct3D 11?
- [ ] Direct3D 12 only adds new shader features; the programming model is the same
- [x] Direct3D 12 is lower-level: your program manages memory, resource states and CPU/GPU synchronisation itself, in return for less driver overhead
- [ ] Direct3D 12 also runs on Linux and Android
---
Microsoft describes Direct3D 12 as a return to low-level programming: faster and more efficient, but you are responsible for more of the work.
```

## COM and ComPtr

Direct3D is built on **COM** (the Component Object Model). Every object – the device, a queue, a resource – is an
*interface* whose name starts with `I` (`ID3D12Device`, `ID3D12CommandQueue`, `IDXGISwapChain3` …). Objects are
created by functions or by methods of other objects, which fill in a pointer for you; `IID_PPV_ARGS(&pointer)`
passes both the interface ID and the address of the pointer. COM objects count their references: every object has
`AddRef` and `Release`, and it deletes itself when the last reference is released.

Calling `Release` by hand is error-prone, so the project (like Microsoft's samples) uses the smart pointer
`ComPtr`:

```cpp
// ComPtr is a smart pointer for COM objects: it releases the object when it goes away.
// It knows nothing about the GPU, though: OnDestroy() waits until the GPU is done
// before the objects are released.
using Microsoft::WRL::ComPtr;
```

The methods return an `HRESULT`, a result code that tells whether the call succeeded. The project wraps every call
that can fail in `ThrowIfFailed`, which turns a failed `HRESULT` into an exception:

```cpp
inline void ThrowIfFailed(HRESULT hr)
{
    if (FAILED(hr))
    {
        char message[64] = {};
        snprintf(message, sizeof(message), "HRESULT of 0x%08X", static_cast<unsigned int>(hr));
        throw std::runtime_error(message);
    }
}
```

```quiz
What does a `ComPtr<ID3D12Device>` do for you?
- [x] It calls `Release` on the COM object automatically when the `ComPtr` goes away, so you don't leak references
- [ ] It waits until the GPU has finished with the device before it is deleted
- [ ] It creates the device when it is declared
---
`ComPtr` handles COM reference counting. It knows nothing about the GPU, which is why the program waits for the GPU (in `OnDestroy()`) before its objects are released.
```

## The device and feature levels

The **device** (`ID3D12Device`) represents the graphics card and creates almost every other object. The project
first asks DXGI for a hardware adapter that supports Direct3D 12 and then creates the device on it:

```cpp
ThrowIfFailed(D3D12CreateDevice(
    hardwareAdapter.Get(),
    D3D_FEATURE_LEVEL_11_0,
    IID_PPV_ARGS(&m_device)
    ));
```

`D3D_FEATURE_LEVEL_11_0` is the minimum **feature level** the program needs. A feature level is a well-defined set
of GPU functionality (11_0, 11_1, 12_0, 12_1, 12_2); a card that supports a level supports everything of the levels
below it. Direct3D 12 works with cards from feature level 11_0 up, so asking for 11_0 lets the program run on as
many cards as possible. A feature level says what a card can do, not how fast it is.

## Command queues, command lists and command allocators

In Direct3D 12 you don't call "draw" on the device. You **record** commands into a **command list**
(`ID3D12GraphicsCommandList`) and hand the list to a **command queue** (`ID3D12CommandQueue`), which sends it to the
GPU. The GPU executes it asynchronously while your program continues. The project creates one *direct* queue, the
kind that can execute every type of command:

```cpp
D3D12_COMMAND_QUEUE_DESC queueDesc = {};
queueDesc.Flags = D3D12_COMMAND_QUEUE_FLAG_NONE;
queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;

ThrowIfFailed(m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue)));
```

The memory the recorded commands are stored in belongs to a **command allocator** (`ID3D12CommandAllocator`).
Every frame, `PopulateCommandList()` resets the allocator and the list and records the frame's commands; then
`OnRender()` executes the list:

```cpp
// Command list allocators can only be reset when the associated
// command lists have finished execution on the GPU; apps should use
// fences to determine GPU execution progress.
ThrowIfFailed(m_commandAllocator->Reset());

// However, when ExecuteCommandList() is called on a particular command
// list, that command list can then be reset at any time and must be before
// re-recording.
ThrowIfFailed(m_commandList->Reset(m_commandAllocator.Get(), m_pipelineState.Get()));
```

```cpp
ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);
```

Because recording is just filling memory, several threads can record their own command lists at the same time.

```quiz
Which object owns the memory that recorded commands are stored in, and may only be reset once the GPU has finished those commands?
- [ ] The command queue
- [ ] The command list
- [x] The command allocator
---
The command list can be reset right after `ExecuteCommandLists`, but the allocator still holds the commands the GPU may be executing. It can only be reset when a fence shows that the GPU is done.
```

## Resource states and barriers

Direct3D 12 also makes you say how a resource is being used. The back buffer of the swap chain is in the
`PRESENT` state while it is shown; before drawing into it, the command list moves it to the `RENDER_TARGET` state
with a **resource barrier**, and back again before it is presented. Direct3D 11 did this tracking for you.

## Descriptor heaps

Shaders and the pipeline don't use resources directly; they use **descriptors** (also called *views*): small
records that describe a resource and how to use it, for example a *render target view* (RTV) that says "draw into
this texture". Descriptors live in **descriptor heaps**, arrays of descriptors that you create and fill yourself.
The project creates a heap with one RTV for each of the two back buffers:

```cpp
// Describe and create a render target view (RTV) descriptor heap.
D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
rtvHeapDesc.NumDescriptors = FrameCount;
rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
ThrowIfFailed(m_device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&m_rtvHeap)));
```

## Root signatures and pipeline state objects

The **root signature** (`ID3D12RootSignature`) describes which resources the shaders get – constant buffers,
textures, samplers – and where they come from. The triangle's shaders use no resources, so the project creates an
empty root signature that only allows the vertex input layout.

The **pipeline state object** (PSO, `ID3D12PipelineState`) contains almost all of the GPU's state in one object:
the compiled shaders, the input layout of the vertices, the rasterizer, blend and depth/stencil state, the
primitive topology type and the format of the render target. It is created once, up front, so that the driver can
compile and optimise everything together; at draw time, switching state is just switching PSOs. A part of the
project's PSO description:

```cpp
D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
psoDesc.pRootSignature = m_rootSignature.Get();
psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
```

The `CD3DX12_…` types come from `d3dx12.h`, Microsoft's header of helper structures that fill in Direct3D 12's
descriptions with sensible defaults.

## Fences

Because the GPU runs asynchronously, your program has to know when the GPU has finished something – for example,
before resetting the command allocator. For that Direct3D 12 has the **fence** (`ID3D12Fence`): an object holding
a 64-bit value. The command queue *signals* the fence (sets a new value once all work submitted before has
finished), and the CPU checks the value or waits for it with an event. The project waits for each frame to finish:

```cpp
// Signal and increment the fence value.
const UINT64 fence = m_fenceValue;
ThrowIfFailed(m_commandQueue->Signal(m_fence.Get(), fence));
m_fenceValue++;

// Wait until the previous frame is finished.
if (m_fence->GetCompletedValue() < fence)
{
    ThrowIfFailed(m_fence->SetEventOnCompletion(fence, m_fenceEvent));
    WaitForSingleObject(m_fenceEvent, INFINITE);
}
```

Waiting for every frame is simple but not the fastest way – the GPU sits idle while the CPU records the next frame.
Later chapters keep it this way for simplicity, as Microsoft's HelloWorld samples do.

```quiz
Why does `WaitForPreviousFrame()` wait on the fence before the next frame is recorded?
- [ ] Because `ExecuteCommandLists` only returns after the GPU has finished
- [ ] To limit the frame rate to the refresh rate of the screen
- [x] So that the command allocator and the back buffer are not reused while the GPU is still working on the previous frame
---
`ExecuteCommandLists` returns at once; the GPU works on its own. The fence tells the CPU when the GPU has reached the point where the queue signalled it.
```

## The debug layer

Direct3D 12 checks very little by itself, to keep the runtime fast: a mistake can crash the program or just give a
wrong picture. During development you enable the **debug layer**, which validates every call and reports errors
and warnings in the debugger's output. It has to be enabled *before* the device is created, and it requires the
Windows "Graphics Tools" optional feature. The project enables it in debug builds:

```cpp
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

```quiz
When must the debug layer be enabled?
- [x] Before the device is created: enabling it afterwards invalidates the device
- [ ] Only in release builds
- [ ] At any time, for example when an error has occurred
---
`EnableDebugLayer()` has to be called before `D3D12CreateDevice`. The project does it at the start of `LoadPipeline()`, and only in debug builds.
```

## Shaders: HLSL, DXBC and DXIL

Direct3D shaders are written in **HLSL** (the High-Level Shading Language) and compiled to bytecode that the driver
turns into GPU code. There are two compilers: the older **FXC** compiles shader models up to 5.1 to **DXBC**
bytecode, and the newer **DXC** compiles shader model 6.0 and later to **DXIL**. Shaders can be compiled ahead of
time (with `fxc.exe` or `dxc.exe`) or while the program runs. The project, like Microsoft's HelloWorld samples,
compiles `shaders.hlsl` at start-up with `D3DCompileFromFile`, which uses FXC – shader model 5.0 (`vs_5_0`,
`ps_5_0`), so the bytecode is DXBC:

```cpp
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

## About 500 lines for a triangle

The project's `main.cpp` is a bit over 500 lines – for one triangle. Before anything appears on the screen you set
up the window, the device, the queue, the swap chain, the descriptor heap, the root signature, the PSO, the vertex
buffer and the fence, all of which Direct3D 11 or OpenGL largely did for you. It pays off: nothing happens behind
your back, so performance is predictable, the work can be spread over threads, and you learn how modern GPUs really
work. Most of it is one-time setup: once the triangle is on the screen, new features take about as much code as in
OpenGL.
:::

## Let's get started

You now know a bit about what {{api}} is and how it works. In the next chapters you build the triangle program
yourself: first a window, then a window cleared to a colour, then the triangle. Before you go on, you can build and
run the project once more and find the code from this chapter in the editor.

## Additional resources

:::opengl
- [learnopengl.com: OpenGL](https://learnopengl.com/Getting-started/OpenGL): the chapter of the original tutorial
  this chapter follows.
- [Khronos: OpenGL](https://www.khronos.org/opengl/): the official home of OpenGL.
- [OpenGL registry](https://registry.khronos.org/OpenGL/index_gl.php): the OpenGL specifications and extensions.
:::
:::vulkan
- [vulkan-tutorial.com: Overview](https://vulkan-tutorial.com/Overview): the chapter of the Vulkan tutorial this
  chapter follows.
- [Vulkan Guide](https://docs.vulkan.org/guide/latest/index.html): Khronos' guide to Vulkan's concepts.
- [Vulkan specification](https://docs.vulkan.org/spec/latest/index.html): the exact rules for every function.
:::
:::d3d12
- [What is Direct3D 12?](https://learn.microsoft.com/en-us/windows/win32/direct3d12/what-is-directx-12-): Microsoft's
  overview.
- [Important changes from Direct3D 11 to Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/important-changes-from-directx-11-to-directx-12):
  what an explicit API makes you do yourself.
- [D3D12HelloWorld samples](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld):
  the samples this course's code is modelled on.
:::
