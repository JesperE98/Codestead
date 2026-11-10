# Hello Window (Vulkan) – vulkan-tutorial 05–15 without pipeline, shaders and draw

Start: the solution of "Creating a window" (instance, validation layers + debug messenger, physical device,
logical device) plus everything this chapter needs, as stubs: `initVulkan()` already calls `createSurface()`,
`createSwapChain()`, `createImageViews()`, `createRenderPass()`, `createFramebuffers()`, `createCommandPool()`,
`createCommandBuffer()`, `createSyncObjects()`, and `mainLoop()` calls `drawFrame()` every frame and
`vkDeviceWaitIdle(device)` after the loop. The stub bodies are `// TODO:` comments, other places (members,
`cleanup()`, helper functions) have `// TODO:` lines. Every intermediate state builds and runs with no validation
message; the window opens and stays open, but its content stays black/undefined until the last task
(`draw-frame`) presents the first image.

Solution: the window cleared to `(0.2, 0.3, 0.3, 1.0)` = RGB (51, 76, 76) every frame.

Deviations from vulkan-tutorial `15_hello_triangle.cpp` (deliberate):
- `chooseSwapSurfaceFormat` prefers `VK_FORMAT_B8G8R8A8_UNORM` (the tutorial: `_SRGB`), so the colours appear
  exactly as written, like OpenGL's default framebuffer and the DirectX 12 samples (with SRGB the clear colour
  would show as RGB (124, 149, 149)).
- One "render finished" semaphore per swap chain image (`std::vector<VkSemaphore> renderFinishedSemaphores`,
  indexed with `imageIndex`): the presentation engine can still be waiting on it after the frame's fence has
  signalled, and newer validation layers (1.4.3xx) report the tutorial's single semaphore as an error. The local
  layer (1.3.275) is silent either way.

## surface
- **Task:** Create the window surface: add `VkSurfaceKHR surface;`, fill `createSurface()` with
  `glfwCreateWindowSurface`, and destroy it with `vkDestroySurfaceKHR` in `cleanup()` (after the debug messenger,
  before the instance).
- **Hint:** `glfwCreateWindowSurface(instance, window, nullptr, &surface)`; throw "failed to create window surface!" on failure.
- **When done:** window opens and stays open (still not drawn). Code has `glfwCreateWindowSurface` and
  `vkDestroySurfaceKHR(instance, surface, nullptr);`.

## present-queue
- **Task:** Find a queue family that can present to the surface: add `presentFamily` to `QueueFamilyIndices`
  (and to `isComplete()`), check `vkGetPhysicalDeviceSurfaceSupportKHR` in `findQueueFamilies()`, create one
  queue per unique family in `createLogicalDevice()` (a `std::set`) and get `presentQueue`.
- **Hint:** The graphics and the present family are often the same index – the set avoids creating it twice.
- **When done:** window opens and stays open. Code has `std::optional<uint32_t> presentFamily;`,
  `vkGetPhysicalDeviceSurfaceSupportKHR`, `std::set<uint32_t> uniqueQueueFamilies` and
  `vkGetDeviceQueue(device, indices.presentFamily.value(), 0, &presentQueue);`.

## swap-chain-support
- **Task:** Check swap chain support: add `deviceExtensions` (`VK_KHR_SWAPCHAIN_EXTENSION_NAME`),
  `struct SwapChainSupportDetails`, `checkDeviceExtensionSupport()` and `querySwapChainSupport()`; make
  `isDeviceSuitable()` require the extension and at least one format and present mode; enable the extension in
  `createLogicalDevice()`.
- **Hint:** `vkGetPhysicalDeviceSurfaceCapabilitiesKHR`, `vkGetPhysicalDeviceSurfaceFormatsKHR`,
  `vkGetPhysicalDeviceSurfacePresentModesKHR` (count first, then the data).
- **When done:** window opens and stays open. The device is created with
  `createInfo.ppEnabledExtensionNames = deviceExtensions.data();`.

## swap-chain
- **Task:** Create the swap chain: add the members `swapChain`, `swapChainImages`, `swapChainImageFormat`,
  `swapChainExtent`; write `chooseSwapSurfaceFormat()` (B8G8R8A8_UNORM + SRGB_NONLINEAR), `chooseSwapPresentMode()`
  (MAILBOX, else FIFO) and `chooseSwapExtent()`; fill `createSwapChain()` (`minImageCount + 1` images,
  `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`, concurrent sharing only if the two families differ) and get the images;
  destroy it in `cleanup()` before the device.
- **Hint:** `vkCreateSwapchainKHR`, then `vkGetSwapchainImagesKHR` twice.
- **When done:** window opens and stays open (nothing presented yet). Code has
  `vkCreateSwapchainKHR(device, &createInfo, nullptr, &swapChain)`, `vkGetSwapchainImagesKHR` and
  `vkDestroySwapchainKHR(device, swapChain, nullptr);`.

## image-views
- **Task:** Create one `VkImageView` per swap chain image in `createImageViews()` (2D, the swap chain format,
  identity swizzle, colour aspect, 1 mip level, 1 layer); add `swapChainImageViews` and destroy them in `cleanup()`.
- **Hint:** Resize `swapChainImageViews` to `swapChainImages.size()` and loop.
- **When done:** window opens and stays open. Code has `vkCreateImageView` and `vkDestroyImageView`.

## render-pass
- **Task:** Create the render pass in `createRenderPass()`: one colour attachment (swap chain format, 1 sample,
  `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR`, `storeOp = STORE`, `initialLayout = UNDEFINED`,
  `finalLayout = PRESENT_SRC_KHR`), one subpass using it, and the dependency on `VK_SUBPASS_EXTERNAL`
  (colour attachment output stage); add `renderPass` and destroy it in `cleanup()`.
- **Hint:** The attachment reference uses layout `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`.
- **When done:** window opens and stays open. Code has `colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;`,
  `vkCreateRenderPass` and `vkDestroyRenderPass`.

## framebuffers
- **Task:** Create a framebuffer per image view in `createFramebuffers()` (the render pass, one attachment, the
  swap chain extent, 1 layer); add `swapChainFramebuffers` and destroy them in `cleanup()`.
- **Hint:** Like the image views: resize, loop, `vkCreateFramebuffer`.
- **When done:** window opens and stays open. Code has `vkCreateFramebuffer` and `vkDestroyFramebuffer`.

## command-buffer
- **Task:** Create the command pool (`VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT`, graphics family) in
  `createCommandPool()` and allocate one primary command buffer in `createCommandBuffer()`; add `commandPool` and
  `commandBuffer`, destroy the pool in `cleanup()`.
- **Hint:** Command buffers are freed with their pool.
- **When done:** window opens and stays open. Code has `vkCreateCommandPool`, `vkAllocateCommandBuffers` and
  `vkDestroyCommandPool(device, commandPool, nullptr);`.

## record-commands
- **Task:** Write `recordCommandBuffer(VkCommandBuffer commandBuffer, uint32_t imageIndex)`: begin the command buffer,
  begin the render pass on `swapChainFramebuffers[imageIndex]` with
  `VkClearValue clearColor = {{{0.2f, 0.3f, 0.3f, 1.0f}}};`, end the render pass, end the command buffer.
- **Hint:** The clear happens because of the render pass's `loadOp = CLEAR`; the clear value comes from
  `renderPassInfo.pClearValues`. Nothing calls this function yet.
- **When done:** window opens and stays open, still not drawn (the function is not called until `draw-frame`).
  Code has `vkCmdBeginRenderPass`, `vkCmdEndRenderPass` and the clear value `{{{0.2f, 0.3f, 0.3f, 1.0f}}}`.

## draw-frame
- **Task:** Create the synchronisation objects in `createSyncObjects()` (`imageAvailableSemaphore`, one
  `renderFinishedSemaphores` entry per swap chain image, `inFlightFence` created signalled) and fill `drawFrame()`:
  wait for and reset the fence, acquire the next image, reset and record the command buffer, submit it (wait on
  `imageAvailableSemaphore` at the colour-output stage, signal `renderFinishedSemaphores[imageIndex]`, fence
  `inFlightFence`) and present it on `presentQueue`. Destroy the semaphores and the fence in `cleanup()`.
- **Hint:** `vkWaitForFences`, `vkResetFences`, `vkAcquireNextImageKHR`, `vkResetCommandBuffer`,
  `recordCommandBuffer`, `vkQueueSubmit`, `vkQueuePresentKHR`. The fence starts signalled so the first frame does
  not wait forever.
- **When done:** the whole window is cleared to teal `(0.2, 0.3, 0.3)` = RGB (51, 76, 76) every frame; it closes
  cleanly (no validation message). Code has `vkQueueSubmit(graphicsQueue, 1, &submitInfo, inFlightFence)` and
  `vkQueuePresentKHR(presentQueue, &presentInfo)`.
