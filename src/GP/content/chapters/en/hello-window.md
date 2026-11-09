# Hello Window

In the previous chapter you created a window and set up {{api}}. A window that shows nothing is not much use,
though. In this chapter you keep the window open, react to the keyboard and – most importantly – give the window
its first colour: every frame, the whole window is cleared to a dark green-blue, `(0.2, 0.3, 0.3, 1.0)`.

:::opengl
Right now the program creates the window, loads GLAD and quits straight away, so the window disappears as soon as
it opens. You will add a *render loop* that keeps it open, a callback that keeps the viewport in step with the
window size, a function that closes the window when you press Escape, and finally the two calls that clear the
screen.
:::
:::vulkan
In OpenGL this chapter is short: the window you get from GLFW comes with a *default framebuffer* that OpenGL draws
into and GLFW shows. Vulkan has no such thing. Before you can show even a cleared window, you have to build the
whole chain from "an image in GPU memory" to "pixels in the window" yourself: a window surface, a presentation
queue, a swap chain with its images and image views, a render pass whose attachment is cleared, framebuffers, a
command buffer that records the clear, and the synchronisation that ties acquiring, rendering and presenting
together. That is vulkan-tutorial.com's "Presentation" and "Drawing" chapters – everything except the graphics
pipeline and the shaders, which clearing does not need and which come in the next chapter.

The project is the result of the previous chapter (instance, validation layers, physical and logical device)
grown into this chapter's shape: `initVulkan()` already calls `createSurface()`, `createSwapChain()`,
`createImageViews()`, `createRenderPass()`, `createFramebuffers()`, `createCommandPool()`, `createCommandBuffer()`
and `createSyncObjects()`, and `mainLoop()` already calls `drawFrame()` every frame. Their bodies are still empty.
The window opens and stays open, but nothing is ever presented to it, so its content is undefined (usually black)
until the very last task.
:::
:::d3d12
In OpenGL this chapter is short: the window you get from GLFW comes with a *default framebuffer* that OpenGL draws
into and GLFW shows. Direct3D 12 has no such thing. You follow Microsoft's **D3D12HelloWindow** sample, which
creates everything needed to show a cleared window: a swap chain with two back buffers, a descriptor heap with a
render target view for each of them, a command allocator and a command list, and a fence to wait for the GPU. Then
every frame it records a few commands – "make the back buffer a render target, clear it, make it presentable
again" – executes them and presents the result.

The project is the result of the previous chapter (factory, adapter, device, command queue) grown into the
sample's shape: the class `D3D12App` already declares every member of the sample (`m_swapChain`,
`m_renderTargets[FrameCount]`, `m_rtvHeap`, `m_commandAllocator`, `m_commandList`, `m_fence` …) and the functions
`LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList` and `WaitForPreviousFrame`, but most bodies are still
empty. The window opens and stays open, but nothing is ever presented to it, so its client area stays unpainted
until you render the first frame.
:::

As before, the `// TODO:` comments in the project mark where your code goes, and **Build & run** (Ctrl+Enter)
compiles the program and runs it in the built-in simulator.

## Ready your engines

We don't want an application that draws a single image and then immediately quits and closes the window. We want
the application to keep drawing images and handling user input until the program has been explicitly told to
stop. For this reason we create a loop, which we now call the *render loop*, that keeps running until we tell it
to stop. One iteration of the render loop is more commonly called a *frame*.

:::opengl
Here is a very simple render loop:

```cpp
while (!glfwWindowShouldClose(window))
{
    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

- `glfwWindowShouldClose` checks at the start of each loop iteration whether GLFW has been instructed to close. If
  so, the function returns `true` and the render loop stops, after which we can close the application.
- `glfwPollEvents` checks whether any events are triggered (like keyboard input or mouse movement events), updates
  the window state, and calls the corresponding functions (which we can register via callback methods). Clicking
  the window's close button is such an event: it is what makes `glfwWindowShouldClose` return `true`.
- `glfwSwapBuffers` swaps the colour buffer (a large 2D buffer that contains colour values for each pixel in
  GLFW's window) that is used to render to during this render iteration and shows it as output to the screen.

Now do the first task, **render-loop**: replace the TODO in `main` with the render loop. Besides the two GLFW
calls, the loop contains two comments, `// input` and `// render`, each with a TODO – they mark the places for
the next tasks:

```cpp
while (!glfwWindowShouldClose(window))
{
    // input
    // -----
    // TODO: process the input (processInput)

    // render
    // ------
    // TODO: clear the screen with a colour

    // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
    // -------------------------------------------------------------------------------
    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

Build and run: the window now stays open until you close it. Its content is still undefined (most likely black),
because nothing clears or draws into it yet.
:::
:::vulkan
In the Vulkan project the render loop is already there, in `mainLoop()`:

```cpp
void mainLoop() {
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        drawFrame();
    }

    vkDeviceWaitIdle(device);
}
```

`glfwWindowShouldClose` and `glfwPollEvents` do exactly what they do for OpenGL: the loop runs until the window's
close button is clicked, and `glfwPollEvents` processes the window's events. What is missing is the counterpart of
OpenGL's `glfwSwapBuffers` – Vulkan has no buffers for GLFW to swap. `drawFrame()` will do that job (and
`vkDeviceWaitIdle` is explained at the end of the chapter), but first you need something to draw into and a way
to show it.
:::
:::d3d12
In the DirectX 12 project the loop is already there, at the end of `wWinMain`:

```cpp
MSG msg = {};
while (msg.message != WM_QUIT)
{
    if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    // TODO: when no messages are waiting, update and render a frame (app.OnUpdate, app.OnRender)
}
```

`PeekMessage` is the Win32 counterpart of `glfwPollEvents`: it takes the next message for the window (a key
press, a click on the close button …) out of the queue, and `DispatchMessage` passes it on to `WindowProc`.
Unlike `GetMessage`, `PeekMessage` does not wait when the queue is empty – it returns `FALSE` immediately, so the
loop can render a frame whenever there is nothing else to do. That is what the TODO is for; you fill it in once
there is something to render. The loop ends when the `WM_QUIT` message arrives, which `PostQuitMessage` sends when
the window is destroyed.
:::

**Double buffer.** When an application draws in a single buffer, the resulting image may display flickering
issues. This is because the output image is not drawn in an instant, but pixel by pixel and usually from left to
right and top to bottom. Because this image is not displayed at an instant to the user while still being
rendered to, the result may contain artifacts. To circumvent these issues, windowing applications apply a double
buffer for rendering. The *front* buffer contains the final output image that is shown on the screen, while all
the rendering commands draw to the *back* buffer. As soon as all the rendering commands are finished, we *swap*
the back buffer to the front buffer so the image can be displayed without still being rendered to, removing all
the aforementioned artifacts.

```quiz
Why do windowing applications render into a back buffer instead of directly into the image that is on screen?
- [ ] Because the GPU can only write to buffers that are not visible
- [ ] Because two buffers double the resolution of the window
- [ ] So the application can skip clearing the screen every frame
- [x] So the viewer never sees a half-finished image: the frame is shown only once it is completely drawn
---
Drawing takes time and happens piece by piece. With a front and a back buffer the screen only ever shows a
finished frame, while the next one is drawn out of sight.
```

:::opengl
```quiz
What happens if you leave out `glfwPollEvents()` in the render loop?
- [x] The window's events are never processed, so clicking the close button does nothing and the window stops responding
- [ ] The window closes immediately
- [ ] Nothing changes, GLFW polls events automatically
- [ ] Nothing is shown, because `glfwPollEvents` presents the frame
---
`glfwPollEvents` is what processes the events and updates the window state – including the flag that
`glfwWindowShouldClose` reads. Without it the loop never ends and the operating system considers the window
unresponsive.
```
:::
:::vulkan
In Vulkan, the double buffer is an object you create explicitly: the **swap chain**. Before you can create it, you
need a surface to present to and a queue that can present.

### Window surface

Since Vulkan is a platform agnostic API, it cannot interface directly with the window system on its own. To
establish the connection between Vulkan and the window system to present results to the screen, we need to use
the WSI (Window System Integration) extensions. The first one is `VK_KHR_surface`. It exposes a `VkSurfaceKHR`
object that represents an abstract type of surface to present rendered images to. The surface in our program will
be backed by the window that we've already opened with GLFW.

The `VK_KHR_surface` extension is an instance-level extension, and you have actually already enabled it: it is
included in the list returned by `glfwGetRequiredInstanceExtensions`, together with the platform-specific
extension (such as `VK_KHR_win32_surface` on Windows) that creating a surface for a window needs. GLFW hides those
platform differences behind one function, `glfwCreateWindowSurface`:

```cpp
void createSurface() {
    if (glfwCreateWindowSurface(instance, window, nullptr, &surface) != VK_SUCCESS) {
        throw std::runtime_error("failed to create window surface!");
    }
}
```

The parameters are the instance, the GLFW window pointer, custom allocators and a pointer to the `VkSurfaceKHR`
variable. The surface needs to be created right after the instance (and the debug messenger), because it can
actually influence the physical device selection – which is why `initVulkan()` calls `createSurface()` before
`pickPhysicalDevice()`. A surface is a child of the instance, so it is destroyed with `vkDestroySurfaceKHR` before
the instance:

```cpp
vkDestroySurfaceKHR(instance, surface, nullptr);
```

Now do the task **surface**: add the member `VkSurfaceKHR surface;`, fill in `createSurface()` and destroy the
surface in `cleanup()` (after the debug messenger, before the instance).

### Presentation queue

Although the Vulkan implementation may support window system integration, that does not mean that every device in
the system supports it. It is actually possible that the queue families supporting drawing commands and the ones
supporting presentation do not overlap. So you need a queue family that can present to *your* surface, and you
look for it next to the graphics family in `findQueueFamilies()`:

```cpp
struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;
    std::optional<uint32_t> presentFamily;

    bool isComplete() {
        return graphicsFamily.has_value() && presentFamily.has_value();
    }
};
```

```cpp
VkBool32 presentSupport = false;
vkGetPhysicalDeviceSurfaceSupportKHR(device, i, surface, &presentSupport);

if (presentSupport) {
    indices.presentFamily = i;
}
```

It is very likely that the graphics and the present family end up being the same index, but the program treats
them as if they were separate queues for a uniform approach. In `createLogicalDevice()` you therefore create one
`VkDeviceQueueCreateInfo` per *unique* family – a `std::set` drops the duplicate:

```cpp
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
```

Then `createInfo.queueCreateInfoCount` and `createInfo.pQueueCreateInfos` use this vector, and after creating the
device you retrieve the queue handle (if the families are the same, both handles will most likely have the same
value):

```cpp
vkGetDeviceQueue(device, indices.presentFamily.value(), 0, &presentQueue);
```

Now do the task **present-queue**.

### Checking for swap chain support

Not all graphics cards are capable of presenting images directly to a screen, for example because they are
designed for servers and don't have any display outputs. Since image presentation is heavily tied into the window
system and the surfaces associated with windows, it is not part of the Vulkan core. You have to enable the
`VK_KHR_swapchain` *device* extension after querying for its support. First, declare the list of required device
extensions:

```cpp
const std::vector<const char*> deviceExtensions = {
    VK_KHR_SWAPCHAIN_EXTENSION_NAME
};
```

`checkDeviceExtensionSupport()` enumerates the extensions of a device with `vkEnumerateDeviceExtensionProperties`
and ticks off the required ones in a `std::set<std::string>`; if the set is empty at the end, everything is there.
Enabling the extension takes two lines in `createLogicalDevice()`:

```cpp
createInfo.enabledExtensionCount = static_cast<uint32_t>(deviceExtensions.size());
createInfo.ppEnabledExtensionNames = deviceExtensions.data();
```

Just checking that the extension is available is not sufficient, because it may not actually be compatible with
your window surface. There are basically three kinds of properties to check:

- basic surface capabilities (min/max number of images in the swap chain, min/max width and height of images),
- surface formats (pixel format, colour space),
- available presentation modes.

They are collected in a struct:

```cpp
struct SwapChainSupportDetails {
    VkSurfaceCapabilitiesKHR capabilities;
    std::vector<VkSurfaceFormatKHR> formats;
    std::vector<VkPresentModeKHR> presentModes;
};
```

`querySwapChainSupport()` fills it with `vkGetPhysicalDeviceSurfaceCapabilitiesKHR`,
`vkGetPhysicalDeviceSurfaceFormatsKHR` and `vkGetPhysicalDeviceSurfacePresentModesKHR` (the last two with the
usual two calls: first the count, then the data). All three take the physical device *and the surface*, because
both are the core components of the swap chain. For this program, swap chain support is sufficient if there is at
least one supported image format and one supported presentation mode, so `isDeviceSuitable()` becomes:

```cpp
bool isDeviceSuitable(VkPhysicalDevice device) {
    QueueFamilyIndices indices = findQueueFamilies(device);

    bool extensionsSupported = checkDeviceExtensionSupport(device);

    bool swapChainAdequate = false;
    if (extensionsSupported) {
        SwapChainSupportDetails swapChainSupport = querySwapChainSupport(device);
        swapChainAdequate = !swapChainSupport.formats.empty() && !swapChainSupport.presentModes.empty();
    }

    return indices.isComplete() && extensionsSupported && swapChainAdequate;
}
```

It is important that you only query for swap chain support after verifying that the extension is available. Now
do the task **swap-chain-support**.

### Choosing the right settings for the swap chain

If `swapChainAdequate` is true, the support is sufficient, but there may still be many different modes of varying
optimality. There are three settings to determine, each with its own helper function.

**Surface format.** Each `VkSurfaceFormatKHR` contains a `format` (the colour channels and types) and a
`colorSpace`. vulkan-tutorial prefers `VK_FORMAT_B8G8R8A8_SRGB`. This project deliberately prefers
`VK_FORMAT_B8G8R8A8_UNORM` instead (with the usual `VK_COLOR_SPACE_SRGB_NONLINEAR_KHR` colour space):

```cpp
VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& availableFormats) {
    // A UNORM format shows the colours we write unchanged (like OpenGL's default framebuffer).
    for (const auto& availableFormat : availableFormats) {
        if (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
            return availableFormat;
        }
    }

    return availableFormats[0];
}
```

The reason: when you write to an `_SRGB` image, the hardware treats the values as *linear* colours and converts
them to sRGB on the way in. That is the correct thing for lighting calculations, but it means that the clear
colour `(0.2, 0.3, 0.3)` would appear noticeably lighter on screen – about RGB (124, 149, 149) instead of
(51, 76, 76). OpenGL's default framebuffer and the DirectX 12 samples (`DXGI_FORMAT_R8G8B8A8_UNORM`) write the
values unchanged, so with a `UNORM` format all three APIs show the same colours throughout the course. Gamma and
sRGB get a chapter of their own later on.

**Presentation mode.** The presentation mode is arguably the most important setting for the swap chain, because it
represents the actual conditions for showing images to the screen. There are four possible modes:

- `VK_PRESENT_MODE_IMMEDIATE_KHR`: images submitted by your application are transferred to the screen right away,
  which may result in tearing.
- `VK_PRESENT_MODE_FIFO_KHR`: the swap chain is a queue where the display takes an image from the front of the
  queue when the display is refreshed, and the program inserts rendered images at the back of the queue. If the
  queue is full, the program has to wait. This is most similar to vertical sync as found in modern games. The
  moment that the display is refreshed is known as the "vertical blank".
- `VK_PRESENT_MODE_FIFO_RELAXED_KHR`: differs from FIFO only if the application is late and the queue was empty at
  the last vertical blank. Instead of waiting for the next vertical blank, the image is transferred right away when
  it finally arrives, which may result in visible tearing.
- `VK_PRESENT_MODE_MAILBOX_KHR`: another variation of FIFO. Instead of blocking the application when the queue is
  full, the images that are already queued are simply replaced with the newer ones. This is commonly known as
  "triple buffering".

Only `VK_PRESENT_MODE_FIFO_KHR` is guaranteed to be available, so `chooseSwapPresentMode()` looks for MAILBOX and
falls back to FIFO:

```cpp
VkPresentModeKHR chooseSwapPresentMode(const std::vector<VkPresentModeKHR>& availablePresentModes) {
    for (const auto& availablePresentMode : availablePresentModes) {
        if (availablePresentMode == VK_PRESENT_MODE_MAILBOX_KHR) {
            return availablePresentMode;
        }
    }

    return VK_PRESENT_MODE_FIFO_KHR;
}
```

**Swap extent.** The swap extent is the resolution of the swap chain images, and it is almost always exactly equal
to the resolution of the window in *pixels*. The range of possible resolutions is defined in
`VkSurfaceCapabilitiesKHR`. Vulkan tells us to match the resolution of the window by setting the width and height
in `currentExtent`. However, some window managers allow us to differ here, which is indicated by setting the width
and height in `currentExtent` to the maximum value of `uint32_t`. In that case you pick the resolution that best
matches the window within the `minImageExtent` and `maxImageExtent` bounds – in pixels, which is why the code asks
GLFW for the *framebuffer* size (on high-DPI displays screen coordinates and pixels differ):

```cpp
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
```

### Creating the swap chain

`createSwapChain()` starts by calling the three helpers. Then it decides how many images the swap chain should
have. Simply sticking to the minimum means that we may sometimes have to wait on the driver to complete internal
operations before we can acquire another image to render to, so it requests at least one more image than the
minimum (and a `maxImageCount` of 0 means that there is no maximum):

```cpp
uint32_t imageCount = swapChainSupport.capabilities.minImageCount + 1;
if (swapChainSupport.capabilities.maxImageCount > 0 && imageCount > swapChainSupport.capabilities.maxImageCount) {
    imageCount = swapChainSupport.capabilities.maxImageCount;
}
```

The `VkSwapchainCreateInfoKHR` structure gets the surface, the image count, the chosen format, colour space and
extent, and a few more fields:

- `imageArrayLayers` is always 1 unless you are developing a stereoscopic 3D application.
- `imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`: we render directly to the images, so they are used as colour
  attachments.
- `imageSharingMode`: if the graphics and the present queue families differ, the images are used across two
  families. `VK_SHARING_MODE_CONCURRENT` (with both family indices) lets them be used by both without explicit
  ownership transfers. If the families are the same – which is the case on most hardware – the program uses
  `VK_SHARING_MODE_EXCLUSIVE`, which offers the best performance.
- `preTransform = currentTransform` says we don't want any transformation (like a 90 degree rotation) applied.
- `compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR` ignores the alpha channel when blending with other windows.
- `presentMode` is the chosen mode, and `clipped = VK_TRUE` means we don't care about the colour of pixels that
  are obscured, for example because another window is in front of them.
- `oldSwapchain = VK_NULL_HANDLE`: this field is only needed when a swap chain is recreated (for instance after a
  resize), which this program does not do.

Then the swap chain is created, and you retrieve the handles of its images – again with two calls, because the
implementation is allowed to create more images than you asked for:

```cpp
if (vkCreateSwapchainKHR(device, &createInfo, nullptr, &swapChain) != VK_SUCCESS) {
    throw std::runtime_error("failed to create swap chain!");
}

vkGetSwapchainImagesKHR(device, swapChain, &imageCount, nullptr);
swapChainImages.resize(imageCount);
vkGetSwapchainImagesKHR(device, swapChain, &imageCount, swapChainImages.data());

swapChainImageFormat = surfaceFormat.format;
swapChainExtent = extent;
```

The images are owned by the swap chain and are destroyed with it. The swap chain itself is destroyed in
`cleanup()`, before the device, with `vkDestroySwapchainKHR(device, swapChain, nullptr);`.

```quiz
The swap chain uses `VK_PRESENT_MODE_FIFO_KHR` and its queue of images waiting to be shown is full. What happens when the program wants to present another image?
- [ ] The image is shown immediately, possibly with tearing
- [x] The program has to wait until the display takes an image from the queue at the next vertical blank
- [ ] The oldest queued image is replaced with the new one
- [ ] `vkQueuePresentKHR` fails and the image is lost
---
FIFO is a queue that the display empties once per refresh – just like vertical sync. Replacing queued images is
what MAILBOX does, and showing the image at once is IMMEDIATE (or FIFO_RELAXED when the application is late).
```

Now do the task **swap-chain**: add the members (`swapChain`, `swapChainImages`, `swapChainImageFormat`,
`swapChainExtent`), write the three helpers, fill in `createSwapChain()` and destroy the swap chain in
`cleanup()`.

### Image views

To use any `VkImage`, including those in the swap chain, you have to create a `VkImageView` object. An image view
is quite literally a view into an image: it describes how to access the image and which part of the image to
access, for example whether it should be treated as a 2D texture or a depth texture without any mipmapping levels.
`createImageViews()` creates one view per swap chain image:

```cpp
VkImageViewCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
createInfo.image = swapChainImages[i];
createInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
createInfo.format = swapChainImageFormat;
createInfo.components.r = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.g = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.b = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.a = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
createInfo.subresourceRange.baseMipLevel = 0;
createInfo.subresourceRange.levelCount = 1;
createInfo.subresourceRange.baseArrayLayer = 0;
createInfo.subresourceRange.layerCount = 1;

if (vkCreateImageView(device, &createInfo, nullptr, &swapChainImageViews[i]) != VK_SUCCESS) {
    throw std::runtime_error("failed to create image views!");
}
```

The `components` field lets you swizzle the colour channels around (the identity mapping keeps them as they are),
and the `subresourceRange` says that the images are colour targets without any mipmapping levels or multiple
layers. Unlike images, the image views were explicitly created by us, so they are destroyed in `cleanup()` with
`vkDestroyImageView` in a loop.

Now do the task **image-views**: add `std::vector<VkImageView> swapChainImageViews;`, resize it to
`swapChainImages.size()` and create a view for every image.
:::
:::d3d12
In DirectX 12, the double buffer is an object you create explicitly: the **swap chain**.

### The swap chain

A swap chain is a set of buffers that DXGI shows in the window in turn. At the end of `LoadPipeline` you describe
it with a `DXGI_SWAP_CHAIN_DESC1`:

```cpp
// Describe and create the swap chain.
DXGI_SWAP_CHAIN_DESC1 swapChainDesc = {};
swapChainDesc.BufferCount = FrameCount;
swapChainDesc.Width = m_width;
swapChainDesc.Height = m_height;
swapChainDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
swapChainDesc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
swapChainDesc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
swapChainDesc.SampleDesc.Count = 1;
```

- `BufferCount = FrameCount`, and `FrameCount` is 2: one buffer is on screen (the front buffer) while you draw
  into the other (the back buffer) – exactly the double buffer described above.
- `Width` and `Height` are the size of the buffers: the window's 800×600 client area.
- `DXGI_FORMAT_R8G8B8A8_UNORM` stores 8 bits per channel, as values from 0.0 to 1.0 that are written unchanged –
  so `(0.2, 0.3, 0.3)` looks the same as in OpenGL.
- `DXGI_USAGE_RENDER_TARGET_OUTPUT` says that the buffers will be rendered to.
- `DXGI_SWAP_EFFECT_FLIP_DISCARD` selects the *flip model*: on `Present` the buffers swap roles instead of being
  copied, and the content of a back buffer is discarded after it has been presented – you have to redraw the
  whole buffer every frame. Direct3D 12 only supports the flip model (`FLIP_SEQUENTIAL` or `FLIP_DISCARD`), which
  requires at least two buffers.
- `SampleDesc.Count = 1`: no multisampling (flip-model swap chains cannot be multisampled).

Then the factory creates the swap chain for the window:

```cpp
ComPtr<IDXGISwapChain1> swapChain;
ThrowIfFailed(factory->CreateSwapChainForHwnd(
    m_commandQueue.Get(),        // Swap chain needs the queue so that it can force a flush on it.
    m_hwnd,
    &swapChainDesc,
    nullptr,
    nullptr,
    &swapChain
    ));

// This program does not support fullscreen transitions (Alt+Enter).
ThrowIfFailed(factory->MakeWindowAssociation(m_hwnd, DXGI_MWA_NO_ALT_ENTER));

ThrowIfFailed(swapChain.As(&m_swapChain));
m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();
```

Note the first parameter: in Direct3D 12, `CreateSwapChainForHwnd` takes the **command queue**, not the device.
Presenting is work that has to happen in order with the rendering work on that queue. The two `nullptr`s are an
optional full-screen description and an output to restrict the swap chain to. `MakeWindowAssociation` with
`DXGI_MWA_NO_ALT_ENTER` stops DXGI from switching to full screen on Alt+Enter, which this program does not handle.

`CreateSwapChainForHwnd` returns an `IDXGISwapChain1`; `swapChain.As(&m_swapChain)` asks it for the newer
interface `IDXGISwapChain3` (a COM `QueryInterface`), which has `GetCurrentBackBufferIndex`. That index – 0 or 1
– tells you which buffer is the back buffer right now; it is stored in `m_frameIndex`.

```quiz
The swap chain uses `DXGI_SWAP_EFFECT_FLIP_DISCARD`. What does that mean for your rendering?
- [x] After `Present` the content of the back buffer is discarded, so every frame has to draw the whole buffer again
- [ ] The swap chain copies the back buffer to the window and keeps its content for the next frame
- [ ] The swap chain only works with a single buffer
- [ ] Frames that are not ready by the next vertical blank are discarded
---
With the flip model the buffers swap roles on `Present`; "discard" means DXGI keeps nothing of the back buffer's
old content for you. Clearing the whole render target every frame takes care of that.
```

Now do the task **swap-chain**: create the swap chain at the end of `LoadPipeline`, as above.

### Render target views

The swap chain owns the two buffers, but the GPU does not render into a resource just because it exists. It needs
a **descriptor**: a small block of data that fully describes a resource to the GPU and how it is used. A *render
target view* (RTV) is a descriptor that says "this texture is a render target". Descriptors live in a
**descriptor heap**, which can be thought of as an array of descriptors. You create a heap with room for
`FrameCount` RTVs:

```cpp
// Create descriptor heaps.
{
    // Describe and create a render target view (RTV) descriptor heap.
    D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
    rtvHeapDesc.NumDescriptors = FrameCount;
    rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    ThrowIfFailed(m_device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&m_rtvHeap)));

    m_rtvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
}
```

The size of a descriptor depends on the hardware, so you ask the device for it with
`GetDescriptorHandleIncrementSize` and keep it in `m_rtvDescriptorSize`: descriptor *n* sits *n* ×
`m_rtvDescriptorSize` bytes after the start of the heap. Then you fetch each back buffer from the swap chain with
`GetBuffer` and write an RTV for it into the heap:

```cpp
// Create frame resources.
{
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart());

    // Create a RTV for each frame.
    for (UINT n = 0; n < FrameCount; n++)
    {
        ThrowIfFailed(m_swapChain->GetBuffer(n, IID_PPV_ARGS(&m_renderTargets[n])));
        m_device->CreateRenderTargetView(m_renderTargets[n].Get(), nullptr, rtvHandle);
        rtvHandle.Offset(1, m_rtvDescriptorSize);
    }
}
```

`CD3DX12_CPU_DESCRIPTOR_HANDLE` is a helper from `d3dx12.h` around a plain `D3D12_CPU_DESCRIPTOR_HANDLE`;
`Offset(1, m_rtvDescriptorSize)` moves it to the next descriptor. The `nullptr` in `CreateRenderTargetView` means
"a default view of the whole resource in its own format".

Now do the task **render-targets**.
:::

## One last thing

As soon as we exit the render loop we would like to properly clean up all of the resources that were allocated.

:::opengl
This is done via the `glfwTerminate` function, which the project already calls at the end of `main`:

```cpp
glfwTerminate();
return 0;
```

This cleans up all the resources and properly exits the application.
:::
:::vulkan
In Vulkan that is your job, object by object: every `vkCreate…` in this chapter gets a matching `vkDestroy…` in
`cleanup()`, in the reverse order of creation (the swap chain before the device, the surface before the
instance …). Each task tells you which object to destroy where. One more thing is needed before `cleanup()` may
destroy anything: the GPU must have finished using it. That is what the `vkDeviceWaitIdle(device)` after the
render loop is for – more on it at the end of the chapter.
:::
:::d3d12
In DirectX 12 the `ComPtr`s release their objects automatically when `app` goes away. But the GPU runs behind the
CPU: when the loop ends, it may still be working on the last frame, using the very objects that are about to be
released. So `OnDestroy()` – called right after the loop – first waits until the GPU is done, and then closes the
event handle used for that waiting. You write it together with the fence, further down.
:::

## Viewport

:::opengl
Before we can start rendering we have to tell OpenGL the size of the rendering window, so OpenGL knows how we want
to display the data and coordinates with respect to the window. We set those dimensions via the `glViewport`
function:

```cpp
glViewport(0, 0, 800, 600);
```

The first two parameters of `glViewport` set the location of the lower left corner of the window. The third and
fourth parameter set the width and height of the rendering window in pixels. We could actually set the viewport
dimensions at values smaller than the window's dimensions; then all the OpenGL rendering would be displayed in a
smaller window and we could for example display other elements outside the OpenGL viewport.

Behind the scenes OpenGL uses the data specified via `glViewport` to transform the 2D coordinates it processed to
coordinates on your screen. For example, a processed point of location `(-0.5, 0.5)` would (as its final
transformation) be mapped to `(200, 450)` in screen coordinates. Note that processed coordinates in OpenGL are
between -1 and 1, so we effectively map from the range (-1 to 1) to (0, 800) and (0, 600).

When the context is first made current, OpenGL sets the viewport to the size of the window, which is why the
project needs no `glViewport` call up front. However, the moment a user resizes the window the viewport should be
adjusted as well. We can register a callback function on the window that gets called each time the window is
resized. This resize callback function has the following prototype:

```cpp
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
```

The framebuffer size function takes a `GLFWwindow` as its first argument and two integers indicating the new
window dimensions. Whenever the window changes in size, GLFW calls this function and fills in the proper arguments
for you to process:

```cpp
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
```

We do have to tell GLFW we want to call this function on every window resize by registering it:

```cpp
glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
```

For retina displays, `width` and `height` will end up significantly higher than the
original input values – that is why it is the *framebuffer* size (in pixels) and not the window size (in screen
coordinates) that matters here.

There are many callback functions we can set to register our own functions. For example, we can make a callback
function to process joystick input changes, process error messages etc. We register the callback functions after
we've created the window and before the render loop is initiated.

Now do the task **viewport**: declare `framebuffer_size_callback` at the top of the file, register it right
after `glfwMakeContextCurrent(window);`, and write its definition at the bottom. Nothing visible changes yet,
since nothing is drawn.

```quiz
The viewport is set with `glViewport(0, 0, 800, 600)`. Where does a processed point at `(-0.5, 0.5)` end up in window coordinates?
- [x] (200, 450)
- [ ] (400, 300)
- [ ] (600, 150)
- [ ] (-400, 300)
---
The viewport maps x from -1…1 to 0…800 and y from -1…1 to 0…600: x = (-0.5 + 1) / 2 × 800 = 200 and
y = (0.5 + 1) / 2 × 600 = 450 (measured from the lower left corner).
```
:::
:::vulkan
Vulkan has a viewport too, with the same job as in OpenGL: it maps the processed coordinates (-1 to 1) onto the
framebuffer. But it is part of the graphics pipeline, which you create in the next chapter – there you will set
it to the swap chain extent. Clearing, which is all this chapter does, does not use the viewport: the render pass
clears its whole render area.

What about resizing? The size of the swap chain images is fixed when the swap chain is created
(`swapChainExtent`). If the window changes size, the swap chain no longer matches it and has to be *recreated*
together with everything that depends on it. vulkan-tutorial handles that in a later chapter ("Swap chain
recreation"). Until then the window is simply created non-resizable, which you can see in `initWindow()`:

```cpp
glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);
```

So the Vulkan project needs no counterpart of OpenGL's `framebuffer_size_callback` yet, and there is no task in
this section.

```quiz
Why does the Vulkan program in this chapter not need a `framebuffer_size_callback`?
- [ ] The swap chain extent is always the size of the screen, not of the window
- [ ] `glfwPollEvents` updates the viewport itself
- [ ] Vulkan resizes the swap chain images automatically when the window changes size
- [x] The window is created non-resizable, and handling a new size would mean recreating the swap chain – that comes later
---
The swap chain images keep the extent they were created with. A size change requires recreating the swap chain
(and its image views and framebuffers); until that is covered, `GLFW_RESIZABLE` is `GLFW_FALSE`.
```
:::
:::d3d12
Direct3D 12 has a viewport too, with the same job as in OpenGL: a `D3D12_VIEWPORT` maps the processed coordinates
(-1 to 1) onto the render target. It is not set once but recorded into the command list every frame with
`RSSetViewports` (together with a scissor rectangle), because a command list starts with no state of its own. You
will add both in the next chapter, Hello Triangle, when you start drawing. Clearing does not use the viewport:
`ClearRenderTargetView` clears the whole render target.

What about resizing? The size of the back buffers is fixed when the swap chain is created (`m_width` ×
`m_height`). Like the D3D12HelloWindow sample, this program does not react to a new window size; DXGI then simply
stretches the 800×600 back buffers to the window's client area. A program that wants its buffers to follow the
window handles the `WM_SIZE` message: it waits for the GPU, releases its references to the back buffers, calls
`IDXGISwapChain::ResizeBuffers` and creates the render target views again. There is no task in this section.

```quiz
Where does a Direct3D 12 program set the viewport?
- [ ] Once on the device, like OpenGL's `glViewport`
- [x] In the command list, with `RSSetViewports`, every time the list is recorded
- [ ] In the `DXGI_SWAP_CHAIN_DESC1`, when the swap chain is created
- [ ] Nowhere: Direct3D 12 always draws to the whole render target
---
A command list carries no state over from earlier recordings, so the viewport (and scissor rectangle) is recorded
into it every frame – from the next chapter on, when something is drawn.
```
:::

## Input

We also want to have some form of input control.

:::opengl
This can be achieved with several of GLFW's input functions. We'll be using GLFW's `glfwGetKey` function that
takes the window as input together with a key. The function returns whether this key is currently being pressed.
We're creating a `processInput` function to keep all input code organized:

```cpp
void processInput(GLFWwindow *window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
}
```

Here we check whether the user has pressed the escape key (if it's not pressed, `glfwGetKey` returns
`GLFW_RELEASE`). If the user did press the escape key, we close GLFW by setting its `WindowShouldClose` property
to `true` using `glfwSetWindowShouldClose`. The next condition check of the main `while` loop will then fail and
the application closes.

We then call `processInput` every iteration of the render loop:

```cpp
while (!glfwWindowShouldClose(window))
{
    processInput(window);

    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

This gives us an easy way to check for specific key presses and react accordingly every frame.

Now do the task **input**: declare `processInput` at the top, write it at the bottom of the file, and call it as
the first thing in the render loop (it replaces the input TODO). Build and run, and press **Escape**: the window
closes.
:::
:::vulkan
In Vulkan programs the input comes from GLFW as well, exactly as in OpenGL: `glfwPollEvents` in the render loop
processes the events, and you could check a key every frame with `glfwGetKey(window, GLFW_KEY_ESCAPE)` and call
`glfwSetWindowShouldClose(window, true)`. vulkan-tutorial does not add any input handling, and neither does this
project: the window is closed with its close button, which ends the loop in `mainLoop()`. There is no task in this
section.
:::
:::d3d12
Without GLFW, input arrives as Win32 *messages*. When a key is pressed, Windows puts a `WM_KEYDOWN` message in the
window's queue; `PeekMessage` takes it out and `DispatchMessage` calls `WindowProc` with it. For `WM_KEYDOWN`, the
`wParam` parameter holds the *virtual-key code* of the key, such as `VK_ESCAPE`. To close the window on Escape,
`WindowProc` handles the message:

```cpp
case WM_KEYDOWN:
    // Escape closes the window.
    if (wParam == VK_ESCAPE)
    {
        DestroyWindow(hWnd);
    }
    return 0;
```

`DestroyWindow` destroys the window, which sends `WM_DESTROY`; the existing handler answers that with
`PostQuitMessage(0)`, which puts `WM_QUIT` in the queue. The main loop sees it and ends, and `OnDestroy()` waits
for the GPU before the program exits – the same path as clicking the close button.

Unlike GLFW's `glfwGetKey`, which you *poll* once per frame, this is event-driven: `WindowProc` is called once per
key press. This is the chapter's last task (**input**); you do it after the window shows its colour, at the end of
the next section.
:::

## Rendering

We want to place all the rendering commands in the render loop, since we want to execute all the rendering
commands each iteration or frame of the loop. At the start of each frame we want to clear the screen. Otherwise
we would still see the results from the previous frame (this could be the effect you're looking for, but usually
you don't).

:::opengl
We can clear the screen's colour buffer using `glClear`, where we pass in buffer bits to specify which buffer we
would like to clear. The possible bits we can set are `GL_COLOR_BUFFER_BIT`, `GL_DEPTH_BUFFER_BIT` and
`GL_STENCIL_BUFFER_BIT`. Right now we only care about the colour values, so we only clear the colour buffer.

```cpp
glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);
```

Note that we also specify the colour to clear the screen with using `glClearColor`. Whenever we call `glClear`
and clear the colour buffer, the entire colour buffer will be filled with the colour as configured by
`glClearColor`. The four values are red, green, blue and alpha, each between 0.0 and 1.0; this results in a dark
green-blueish colour.

As you may recall from the OpenGL chapter, the `glClearColor` function is a *state-setting* function and `glClear`
is a *state-using* function, in that it uses the current state to retrieve the clearing colour from. OpenGL is a
large state machine: `glClearColor` changes the state, and every later `glClear` reads it, until the clear colour
is changed again. (Strictly speaking, you could set the clear colour once before the loop – it stays the same – but
keeping both calls together in the render section is clearer.)

Now do the task **clear**: put the two calls in the render section of the loop, replacing the TODO, before
`glfwSwapBuffers`. Build and run: the whole window is now dark green-blue.

```quiz
Which of these calls is a *state-using* function?
- [x] `glClear`
- [ ] `glClearColor`
- [ ] `glViewport`
---
`glClearColor` and `glViewport` only change OpenGL's state. `glClear` actually does something – fill the colour
buffer – and takes the colour from the current state.
```

```quiz
What would you see if the render loop never called `glClear`, while the program draws a moving object?
- [ ] An error from OpenGL
- [x] Leftovers of earlier frames, because each frame draws on top of whatever is already in the buffer
- [ ] Exactly the same, because `glfwSwapBuffers` clears the buffer
- [ ] An empty window, because nothing is shown without clearing
---
Swapping does not clear anything, so without `glClear` each frame starts with old (or undefined) content. That is
why rendering usually begins with clearing the screen.
```
:::
:::vulkan
In OpenGL, clearing is two calls. In Vulkan, nothing is executed directly: you *record* commands into a command
buffer and *submit* it to a queue. And the commands don't operate on a "current framebuffer" either, but inside a
**render pass** on an explicitly given framebuffer. What remains is the render pass, the framebuffers, the command
buffer and its recording, and finally the frame itself.

### Render pass

Before we can render, we need to tell Vulkan about the framebuffer attachments that will be used while rendering:
how many colour and depth buffers there will be, how many samples to use for each of them and how their contents
should be handled throughout the rendering operations. All of this information is wrapped in a render pass object.
In our case there is just a single colour attachment, represented by one of the images from the swap chain:

```cpp
VkAttachmentDescription colorAttachment{};
colorAttachment.format = swapChainImageFormat;
colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
colorAttachment.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
```

The `loadOp` and `storeOp` determine what to do with the data in the attachment before and after rendering. The
`loadOp` choices are `LOAD` (preserve the existing contents), `CLEAR` (clear the values to a constant at the
start) and `DONT_CARE` (existing contents are undefined; we don't care about them). **`VK_ATTACHMENT_LOAD_OP_CLEAR`
is how Vulkan clears the screen in this chapter**: every time the render pass begins, the attachment is cleared to
a clear value that you pass in when you begin it. `STORE` keeps the rendered contents in memory afterwards,
because we want to see them on the screen. We have no stencil buffer, so the stencil operations don't matter.

Images need to be in a specific *layout* for the operation they are used in next. `initialLayout = UNDEFINED`
means we don't care what layout the image was in before – fine, since we clear it anyway (the contents are not
guaranteed to be preserved). `finalLayout = PRESENT_SRC_KHR` means the image should be ready for presentation
using the swap chain after rendering.

A render pass consists of one or more *subpasses*. Ours has one, which uses the attachment as its colour output:

```cpp
VkAttachmentReference colorAttachmentRef{};
colorAttachmentRef.attachment = 0;
colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

VkSubpassDescription subpass{};
subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
subpass.colorAttachmentCount = 1;
subpass.pColorAttachments = &colorAttachmentRef;
```

`attachment = 0` is the index into the render pass's attachment array, and the layout is the one the image is
transitioned to during the subpass – `COLOR_ATTACHMENT_OPTIMAL` gives the best performance for a colour
attachment.

The subpasses in a render pass automatically take care of these layout transitions, and the transitions are
controlled by *subpass dependencies*. The operations right before and right after our subpass count as implicit
"subpasses" (`VK_SUBPASS_EXTERNAL`). The built-in dependency at the start of the render pass assumes that the
transition occurs at the start of the pipeline, but at that point we haven't necessarily acquired the image yet!
So we add a dependency that makes the transition – and the clear – wait for the colour attachment output stage,
the same stage at which the frame will wait for the image to be available (you'll see that in `drawFrame()`):

```cpp
VkSubpassDependency dependency{};
dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
dependency.dstSubpass = 0;
dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
dependency.srcAccessMask = 0;
dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
```

The `VkRenderPassCreateInfo` then takes the attachment, the subpass and the dependency, and `vkCreateRenderPass`
creates the render pass. It is destroyed in `cleanup()` with `vkDestroyRenderPass`.

In vulkan-tutorial the render pass is part of the graphics pipeline chapters. Note that clearing needs no pipeline
at all: the `loadOp` alone clears the attachment, even if nothing is drawn in the render pass.

Now do the task **render-pass**: add `VkRenderPass renderPass;`, fill in `createRenderPass()` and destroy it in
`cleanup()`.

### Framebuffers

The attachments specified during render pass creation are bound by wrapping them into a `VkFramebuffer` object. A
framebuffer object references all of the `VkImageView` objects that represent the attachments. In our case that
is only a single one: the colour attachment. However, the image that we have to use for the attachment depends on
which image the swap chain returns when we retrieve one for presentation. That means we have to create a
framebuffer for all of the images in the swap chain and use the one that corresponds to the retrieved image at
drawing time:

```cpp
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
```

A framebuffer can only be used with a render pass that is compatible with the one it was created for, which
roughly means that they use the same number and type of attachments. The framebuffers are destroyed in `cleanup()`
before the render pass and the image views they are based on.

Now do the task **framebuffers**: add `std::vector<VkFramebuffer> swapChainFramebuffers;` and create one
framebuffer per image view in `createFramebuffers()`.

### Command pool and command buffer

Commands in Vulkan, like drawing operations and memory transfers, are not executed directly using function calls.
You have to record all of the operations you want to perform in command buffer objects. The advantage of this is
that when we are ready to tell Vulkan what we want to do, all of the commands are submitted together and Vulkan
can more efficiently process the commands since all of them are available together.

Command buffers are allocated from a **command pool**, which manages the memory that is used to store the buffers.
A pool can only allocate command buffers that are submitted on a single type of queue – here the graphics queue,
since clearing happens in a render pass:

```cpp
VkCommandPoolCreateInfo poolInfo{};
poolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
poolInfo.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
poolInfo.queueFamilyIndex = queueFamilyIndices.graphicsFamily.value();
```

We will record a command buffer every frame, so we want to be able to reset and re-record it:
`VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT` allows command buffers to be reset individually. Then
`createCommandBuffer()` allocates one command buffer from the pool:

```cpp
VkCommandBufferAllocateInfo allocInfo{};
allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
allocInfo.commandPool = commandPool;
allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
allocInfo.commandBufferCount = 1;
```

`VK_COMMAND_BUFFER_LEVEL_PRIMARY` means the buffer can be submitted to a queue for execution (secondary buffers can
only be called from primary ones). Command buffers are freed automatically when their pool is destroyed, so
`cleanup()` only needs `vkDestroyCommandPool(device, commandPool, nullptr);`.

Now do the task **command-buffer**: add `commandPool` and `commandBuffer`, fill in `createCommandPool()` and
`createCommandBuffer()`, and destroy the pool in `cleanup()`.

### Command buffer recording

`recordCommandBuffer` writes the commands we want to execute into a command buffer, for the swap chain image with
the given index. Recording always begins with `vkBeginCommandBuffer`:

```cpp
void recordCommandBuffer(VkCommandBuffer commandBuffer, uint32_t imageIndex) {
    VkCommandBufferBeginInfo beginInfo{};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;

    if (vkBeginCommandBuffer(commandBuffer, &beginInfo) != VK_SUCCESS) {
        throw std::runtime_error("failed to begin recording command buffer!");
    }
```

Drawing – and in our case clearing – starts by beginning the render pass with `vkCmdBeginRenderPass`. The render
pass is configured with a `VkRenderPassBeginInfo`:

```cpp
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = renderPass;
    renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = swapChainExtent;

    VkClearValue clearColor = {{{0.2f, 0.3f, 0.3f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
```

The first parameters are the render pass itself and the framebuffer to bind – the one for the swap chain image
that we are about to render to. The render area defines where shader loads and stores will take place; it should
match the size of the attachments for best performance. The last two fields define the clear values to use for
`VK_ATTACHMENT_LOAD_OP_CLEAR`, which we used as the load operation for the colour attachment: the same
`(0.2, 0.3, 0.3, 1.0)` as in OpenGL. The triple braces are there because `VkClearValue` is a union (of a colour
and a depth/stencil value), whose colour member `VkClearColorValue` is again a union, holding a `float32[4]`
array.

`VK_SUBPASS_CONTENTS_INLINE` means the render pass commands are embedded in the primary command buffer itself.
There is nothing to draw yet, so the render pass is ended right away, and so is the recording:

```cpp
    vkCmdEndRenderPass(commandBuffer);

    if (vkEndCommandBuffer(commandBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to record command buffer!");
    }
}
```

Compare this with OpenGL's state machine: in Vulkan there is no "current clear colour" that a state-setting
function changes and a state-using function reads. The clear colour is passed directly with the command that uses
it.

```quiz
In the Vulkan program, what actually clears the swap chain image to `(0.2, 0.3, 0.3, 1.0)`?
- [x] Beginning the render pass: the attachment's `loadOp` is `VK_ATTACHMENT_LOAD_OP_CLEAR`, and the colour comes from `pClearValues` in `VkRenderPassBeginInfo`
- [ ] The swap chain, which clears every image with the colour from `VkSwapchainCreateInfoKHR`
- [ ] `vkQueuePresentKHR`, which fills the image before showing it
- [ ] A `vkCmdClearColorImage` command recorded after `vkCmdBeginRenderPass`
---
The load operation runs when the render pass begins and uses the clear value passed to `vkCmdBeginRenderPass`.
That's why an empty render pass is enough to clear the window.
```

Now do the task **record-commands**: write `recordCommandBuffer` as above. Nothing calls it yet, so the window
still looks the same.

### Rendering and presentation

This is the part where everything comes together. At a high level, rendering a frame in Vulkan consists of a
common set of steps:

1. Wait for the previous frame to finish.
2. Acquire an image from the swap chain.
3. Record a command buffer which clears (later: draws the scene onto) that image.
4. Submit the recorded command buffer.
5. Present the swap chain image.

**Synchronisation.** A core design philosophy in Vulkan is that synchronisation of execution on the GPU is
explicit. Many Vulkan API calls which start executing work on the GPU are asynchronous: the functions return
before the operation has finished. Acquiring the image, executing the command buffer and presenting are three such
operations that depend on each other, so we have to order them:

- A **semaphore** is used to add order between queue operations, on the GPU. One operation *signals* it when it
  finishes; another operation *waits* on it before it begins. The CPU is not blocked.
- A **fence** has a similar purpose, but it is used to synchronise execution on the CPU (the "host"). If the host
  needs to know when the GPU has finished something, we use a fence; `vkWaitForFences` blocks until it is
  signalled, and the host has to reset it manually.

We need a semaphore to signal that an image has been acquired from the swap chain and is ready for rendering, a
semaphore to signal that rendering has finished and presentation can happen, and a fence to make sure only one
frame is rendering at a time:

```cpp
VkSemaphore imageAvailableSemaphore;
std::vector<VkSemaphore> renderFinishedSemaphores;
VkFence inFlightFence;
```

Here the project deliberately differs from vulkan-tutorial, which uses a single `renderFinishedSemaphore`. The
"render finished" semaphore is waited on by the *presentation* engine, and the frame's fence only tells you that
the command buffer has finished – not that the presentation has stopped waiting on the semaphore. With a single
semaphore the next frame could signal it again while the previous present still waits on it, and newer versions
of the validation layers report exactly that as an error. One semaphore per swap chain image, indexed with
`imageIndex`, avoids it: by the time the swap chain hands out the same image again, its previous presentation –
and with it the wait on that image's semaphore – is over.

```cpp
void createSyncObjects() {
    // One "render finished" semaphore per swap chain image: the presentation engine may still
    // be waiting on it after the fence of the frame has signaled.
    renderFinishedSemaphores.resize(swapChainImages.size());

    VkSemaphoreCreateInfo semaphoreInfo{};
    semaphoreInfo.sType = VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;

    VkFenceCreateInfo fenceInfo{};
    fenceInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    fenceInfo.flags = VK_FENCE_CREATE_SIGNALED_BIT;
```

followed by `vkCreateSemaphore` for `imageAvailableSemaphore`, `vkCreateFence` for `inFlightFence` and a loop that
creates each of the `renderFinishedSemaphores`. Note the `VK_FENCE_CREATE_SIGNALED_BIT`; you'll see why in a
moment. All of them are destroyed at the top of `cleanup()` with `vkDestroySemaphore` and `vkDestroyFence`.

**Waiting for the previous frame.** At the start of the frame, we want to wait until the previous frame has
finished, so that the command buffer and semaphores are available to use:

```cpp
void drawFrame() {
    vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
    vkResetFences(device, 1, &inFlightFence);
```

`vkWaitForFences` waits on the host for the fence (`VK_TRUE`: all of the given fences; with one fence it doesn't
matter), with the timeout disabled by `UINT64_MAX`. After waiting, the fence is reset to the unsignalled state.
On the very first frame there is no previous frame that could signal the fence, so `vkWaitForFences` would block
forever – unless the fence is created in the signalled state, which is exactly what
`VK_FENCE_CREATE_SIGNALED_BIT` does.

**Acquiring an image from the swap chain.**

```cpp
    uint32_t imageIndex;
    vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);
```

After the device and the swap chain come a timeout and the synchronisation objects that are to be signalled when
the presentation engine is finished using the image – that is the point in time where we can start drawing to
it. The function returns the index of the swap chain image that has become available in `imageIndex`; it is the
index into `swapChainImages`, and so also into `swapChainFramebuffers` and `renderFinishedSemaphores`.

**Recording the command buffer.** With the image index you can record the commands. First reset the command
buffer to make sure it is able to be recorded, then call your function:

```cpp
    vkResetCommandBuffer(commandBuffer, /*VkCommandBufferResetFlagBits*/ 0);
    recordCommandBuffer(commandBuffer, imageIndex);
```

**Submitting the command buffer.**

```cpp
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
```

The first three parameters specify which semaphores to wait on before execution begins and in which stage of the
pipeline to wait. We want to wait with writing colours to the image until it's available, so we specify the
stage of the graphics pipeline that writes to the colour attachment – the same stage as in the subpass dependency.
Then come the command buffer to submit and the semaphore to signal once it has finished executing. The last
parameter of `vkQueueSubmit` is the fence that is signalled when the command buffer finishes executing; that is
what the next frame's `vkWaitForFences` waits for.

**Presentation.** The last step is submitting the result back to the swap chain to have it eventually show up on
the screen:

```cpp
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
```

The presentation waits on the "render finished" semaphore of this image, and names the swap chain and the index
of the image to present. `vkQueuePresentKHR` is Vulkan's counterpart of `glfwSwapBuffers`. Note that this program
only ever has one frame "in flight": the CPU waits for the previous frame before it starts the next.
vulkan-tutorial lifts that restriction in a later chapter ("Frames in flight").

```quiz
Why is `inFlightFence` created with `VK_FENCE_CREATE_SIGNALED_BIT`?
- [ ] Because only signalled fences can be reset with `vkResetFences`
- [x] So that the `vkWaitForFences` at the start of the first frame returns immediately instead of waiting forever
- [ ] So that `vkQueueSubmit` doesn't need a fence on the first frame
- [ ] So that the GPU can start rendering before the image is acquired
---
`drawFrame()` waits for the previous frame's fence before anything else. On the first frame no submit has
signalled it yet, so it is created already signalled.
```

**Waiting for the device at the end.** All of the operations in `drawFrame` are asynchronous. That means that when
we exit the loop in `mainLoop`, drawing and presentation operations may still be going on, and cleaning up
resources while that is happening is a bad idea. That's why `mainLoop()` calls `vkDeviceWaitIdle(device)` after
the loop: it waits for the logical device to finish its operations before `cleanup()` destroys anything.

Now do the last task, **draw-frame**: add the synchronisation members, fill in `createSyncObjects()` and
`drawFrame()`, and destroy the semaphores and the fence in `cleanup()`. Build and run: the whole window is now
dark green-blue, and when you close it, it closes cleanly without a validation message.
:::
:::d3d12
In OpenGL, clearing is two calls. In Direct3D 12, nothing is executed directly: you *record* commands into a
command list and *execute* it on the command queue. And the GPU works asynchronously, so you need a way to find
out when it is done. Four steps remain: the command list, the fence, recording the commands and, finally,
rendering the frame.

### Command allocator and command list

A **command list** records commands for the GPU; the memory those commands are stored in comes from a **command
allocator**. Create the allocator at the end of `LoadPipeline`:

```cpp
ThrowIfFailed(m_device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&m_commandAllocator)));
```

`D3D12_COMMAND_LIST_TYPE_DIRECT` is the type that the GPU can execute directly and that may contain any command
(drawing, clearing, copying), matching the type of the command queue. In `LoadAssets` you create the command list
that records into this allocator:

```cpp
// Create the command list.
ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), nullptr, IID_PPV_ARGS(&m_commandList)));

// Command lists are created in the recording state, but there is nothing
// to record yet. The main loop expects it to be closed, so close it now.
ThrowIfFailed(m_commandList->Close());
```

The `0` is the node mask (for a single GPU), and `nullptr` is the initial pipeline state object. A pipeline state
describes the shaders and the fixed-function settings for drawing; this chapter draws nothing, so
`m_pipelineState` stays null, just as in the sample – it gets its value in the next chapter. A new command list is
open for recording; the render loop resets it every frame, and only a closed list may be reset, so it is closed
right away.

Now do the task **command-list**.

### Fence

The GPU runs behind the CPU: `ExecuteCommandLists` only hands the commands to the queue and returns. To know when
the GPU has finished, Direct3D 12 uses a **fence**: an object holding a 64-bit value. You ask the *queue* to
`Signal` the fence with a value; when the GPU gets to that point in the queue – after all the work submitted
before it – it sets the fence to that value. The CPU can read the value with `GetCompletedValue`, or ask for an
event to be set when the value is reached. Create both in `LoadAssets`:

```cpp
// Create synchronization objects.
{
    ThrowIfFailed(m_device->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&m_fence)));
    m_fenceValue = 1;

    // Create an event handle to use for frame synchronization.
    m_fenceEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (m_fenceEvent == nullptr)
    {
        ThrowIfFailed(HRESULT_FROM_WIN32(GetLastError()));
    }
}
```

The fence starts at 0, and `m_fenceValue` – the next value to signal – at 1. `WaitForPreviousFrame` uses them:

```cpp
void D3D12App::WaitForPreviousFrame()
{
    // WAITING FOR THE FRAME TO COMPLETE BEFORE CONTINUING IS NOT BEST PRACTICE.
    // This is code implemented as such for simplicity. The D3D12HelloFrameBuffering
    // sample illustrates how to use fences for efficient resource usage and to
    // maximize GPU utilization.

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

    m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();
}
```

It puts a `Signal` at the end of the queue, then checks whether the GPU has already got there. If not,
`SetEventOnCompletion` arranges for the event to be set when the fence reaches the value, and
`WaitForSingleObject` puts the CPU to sleep until then. Afterwards, everything submitted so far is finished, and
the function picks up the index of the back buffer for the next frame. As the comment says, waiting for the GPU
after every frame is simple but not fast – the CPU and the GPU take turns instead of working at the same time.
Microsoft's samples do it this way to keep the first steps simple.

`OnDestroy` uses the same function to make sure the GPU no longer uses any object before the `ComPtr`s release
them, and then closes the event:

```cpp
void D3D12App::OnDestroy()
{
    // Ensure that the GPU is no longer referencing resources that are about to be
    // cleaned up by the destructor.
    WaitForPreviousFrame();

    CloseHandle(m_fenceEvent);
}
```

Now do the task **fence**: create the fence and the event in `LoadAssets`, and fill in `WaitForPreviousFrame` and
`OnDestroy`.

### Recording the commands

`PopulateCommandList` records one frame. First the allocator and the list are reset:

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

Resetting the allocator reuses the memory of the previous frame's commands – allowed only because
`WaitForPreviousFrame` made sure the GPU is finished with them.

Next, **resource barriers**. Every resource is in a *state* that says how it is being used. A back buffer that is
handed to the swap chain is in `D3D12_RESOURCE_STATE_PRESENT`; to render into it, it must be in
`D3D12_RESOURCE_STATE_RENDER_TARGET`. A transition barrier tells the GPU about the change, so it can finish
earlier work and prepare the memory. The `CD3DX12_RESOURCE_BARRIER::Transition` helper from `d3dx12.h` builds
one:

```cpp
// Indicate that the back buffer will be used as a render target.
CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
m_commandList->ResourceBarrier(1, &barrier);
```

(Microsoft's sample passes `&CD3DX12_RESOURCE_BARRIER::Transition(...)` directly. Taking the address of a
temporary only compiles with MSVC, so the project stores the barrier in a local variable first.)

Then the clear itself. `ClearRenderTargetView` takes the RTV of the current back buffer – descriptor number
`m_frameIndex` in the heap – and the colour:

```cpp
CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);

// Record commands.
const float clearColor[] = { 0.2f, 0.3f, 0.3f, 1.0f };
m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
```

The last two parameters are a number of rectangles and the rectangles themselves; `0, nullptr` clears the whole
view. Compare this with OpenGL's state machine: there is no "current clear colour" that a state-setting function
changes and a state-using function reads – the colour is passed directly with the command.

Finally the back buffer goes back to the `PRESENT` state, because a back buffer must be in that state when it is
presented, and the list is closed:

```cpp
// Indicate that the back buffer will now be used to present.
barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT);
m_commandList->ResourceBarrier(1, &barrier);

ThrowIfFailed(m_commandList->Close());
```

```quiz
Why does `PopulateCommandList` record a resource barrier before `ClearRenderTargetView`?
- [ ] Because `ClearRenderTargetView` only works on resources that are shared between queues
- [ ] To copy the back buffer into the front buffer
- [ ] To wait until the previous frame has been presented
- [x] The back buffer is in the `PRESENT` state; it has to be transitioned to `RENDER_TARGET` before it can be rendered into
---
Resources have states. The swap chain needs the buffer in `PRESENT`, rendering needs `RENDER_TARGET`, so the
list transitions it there and back again.
```

Now do the task **clear**: fill in `PopulateCommandList`. Nothing calls it yet, so the window still looks the
same.

### Rendering the frame

`OnRender` puts it all together:

```cpp
void D3D12App::OnRender()
{
    // Record all the commands we need to render the scene into the command list.
    PopulateCommandList();

    // Execute the command list.
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);

    // Present the frame.
    ThrowIfFailed(m_swapChain->Present(1, 0));

    WaitForPreviousFrame();
}
```

`ExecuteCommandLists` submits an array of command lists to the queue. `Present` is DirectX 12's counterpart of
`glfwSwapBuffers`: it hands the back buffer to the swap chain to be shown and makes the other buffer the back
buffer. Its first parameter, the *sync interval*, is 1: present at the next vertical blank (vsync), so the
program renders no faster than the display refreshes. The second parameter holds flags; 0 means none. Then
`WaitForPreviousFrame` waits for the GPU and fetches the new back buffer index.

The main loop has to call `OnRender`: when `PeekMessage` finds no message, update and render a frame:

```cpp
if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
{
    TranslateMessage(&msg);
    DispatchMessage(&msg);
}
else
{
    // No messages waiting: update and render a frame.
    app.OnUpdate();
    app.OnRender();
}
```

`OnUpdate` is empty in this chapter; it is where later chapters change things from frame to frame.

```quiz
Why does `OnRender` call `WaitForPreviousFrame()` after `Present`?
- [ ] To wait for the user's next message
- [ ] So that the fence value never changes
- [x] So that the GPU has finished this frame before the next `PopulateCommandList` resets the command allocator and records into it again
- [ ] `Present` only works once the GPU is idle
---
Recording reuses the allocator's memory, which is only allowed when the GPU no longer executes those commands.
Waiting every frame guarantees that – simple, but the CPU and GPU take turns instead of working in parallel.
```

Now do the task **render**: fill in `OnRender` and add the `else` branch to the main loop. Build and run: the
whole window is now dark green-blue.

Finally, do the last task, **input**: handle `WM_KEYDOWN` in `WindowProc` as described in the Input section above.
Build and run, and press **Escape**: the window closes.
:::

And that's it: a window cleared to a colour of your choice every frame, with {{api}}. Whatever you draw in the
following chapters goes in between clearing and presenting.

```quiz
In every API, one frame of this chapter's program follows the same order. Which one?
- [ ] Clear the front buffer while it is on screen, then process the events
- [ ] Present the image, then clear it
- [x] Process the window's events, clear the back buffer (image), then present it
- [ ] Create the swap chain (or default framebuffer), clear it, destroy it
---
Events first (input, close button), then render into the buffer that is not on screen, then show it:
`glfwSwapBuffers`, `vkQueuePresentKHR` or `Present`.
```
