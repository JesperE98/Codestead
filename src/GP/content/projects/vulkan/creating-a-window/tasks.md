# Creating a window (Vulkan) – vulkan-tutorial "Setup" (base code … logical device)

Start: the base code of vulkan-tutorial.com (`00_base_code`): class `HelloTriangleApplication` with `run()`,
`initWindow()` (GLFW, `GLFW_CLIENT_API` = `GLFW_NO_API`, not resizable, 800×600, title "Vulkan"), an empty
`initVulkan()` with TODOs, `mainLoop()` (`glfwPollEvents` until the window is closed) and `cleanup()`.
It already builds and runs: the window opens and stays open until it is closed (its content stays black/undefined,
because nothing is ever presented to it in this chapter – that is expected for every task here).
Solution = vulkan-tutorial `04_logical_device.cpp`, character for character.

Debug output: from task `debug-messenger` on, every message of the validation layer is printed to stderr as
`validation layer: ...` (including harmless VERBOSE loader messages). A correct program prints no message
containing `Validation Error`, `Validation Warning`, `Validation Performance` or a `VUID-`.

## instance
- **Task:** Create the Vulkan instance: add the `VkInstance instance;` member, write `createInstance()` (fill a
  `VkApplicationInfo` and a `VkInstanceCreateInfo` with the extensions GLFW needs) and `getRequiredExtensions()`,
  call `createInstance()` in `initVulkan()` and `vkDestroyInstance` in `cleanup()`.
- **Hint:** `glfwGetRequiredInstanceExtensions(&glfwExtensionCount)` returns the names; throw
  `std::runtime_error("failed to create instance!")` if `vkCreateInstance` does not return `VK_SUCCESS`.
- **When done:** window still opens and stays open. Code has `vkCreateInstance(&createInfo, nullptr, &instance)`,
  `glfwGetRequiredInstanceExtensions`, `createInstance();` in `initVulkan`, `vkDestroyInstance(instance, nullptr);`
  in `cleanup`. `createInfo.enabledLayerCount = 0;` (no layers yet).

## validation-layers
- **Task:** Enable the Khronos validation layer in debug builds: add `validationLayers` (`"VK_LAYER_KHRONOS_validation"`)
  and `enableValidationLayers` (`#ifdef NDEBUG`), write `checkValidationLayerSupport()`, check it at the top of
  `createInstance()` and set `enabledLayerCount`/`ppEnabledLayerNames` when enabled.
- **Hint:** `vkEnumerateInstanceLayerProperties` lists the available layers; compare names with `strcmp`.
- **When done:** window opens and stays open; the instance is created with the layer
  (`createInfo.ppEnabledLayerNames = validationLayers.data();`). If the layer is missing the program throws
  "validation layers requested, but not available!".

## debug-messenger
- **Task:** Receive the validation messages: add the `CreateDebugUtilsMessengerEXT`/`DestroyDebugUtilsMessengerEXT`
  helpers, the `debugMessenger` member, `debugCallback`, `populateDebugMessengerCreateInfo()` and
  `setupDebugMessenger()`; add `VK_EXT_DEBUG_UTILS_EXTENSION_NAME` in `getRequiredExtensions()`, chain a messenger
  create info into `createInstance()` (`createInfo.pNext`), call `setupDebugMessenger()` after `createInstance()`
  and destroy the messenger in `cleanup()` before the instance.
- **Hint:** The extension functions are not exported by the loader: get them with `vkGetInstanceProcAddr`.
  The callback prints `"validation layer: " << pCallbackData->pMessage` to `std::cerr` and returns `VK_FALSE`.
- **When done:** window opens and stays open; stderr now shows `validation layer: ...` lines (verbose loader
  information only – no errors). Code has `CreateDebugUtilsMessengerEXT(instance, &createInfo, nullptr, &debugMessenger)`
  and `DestroyDebugUtilsMessengerEXT(instance, debugMessenger, nullptr)`.

## physical-device
- **Task:** Pick a graphics card: add `struct QueueFamilyIndices` (an `std::optional<uint32_t> graphicsFamily`),
  the member `VkPhysicalDevice physicalDevice = VK_NULL_HANDLE;`, and write `pickPhysicalDevice()`,
  `isDeviceSuitable()` and `findQueueFamilies()` (a queue family with `VK_QUEUE_GRAPHICS_BIT`); call
  `pickPhysicalDevice()` after `setupDebugMessenger()`.
- **Hint:** `vkEnumeratePhysicalDevices` twice (count, then the list); `vkGetPhysicalDeviceQueueFamilyProperties`
  the same way. Throw "failed to find a suitable GPU!" if none fits.
- **When done:** window opens and stays open; `physicalDevice` is set (on the checker's machine: lavapipe/llvmpipe).
  Code has `vkEnumeratePhysicalDevices`, `findQueueFamilies`, `VK_QUEUE_GRAPHICS_BIT`.

## logical-device
- **Task:** Create the logical device with one graphics queue: add the members `VkDevice device;` and
  `VkQueue graphicsQueue;`, write `createLogicalDevice()` (`VkDeviceQueueCreateInfo` with priority 1.0,
  `VkDeviceCreateInfo`, `vkCreateDevice`, `vkGetDeviceQueue`), call it after `pickPhysicalDevice()` and destroy the
  device first in `cleanup()`.
- **Hint:** No device extensions yet (`enabledExtensionCount = 0`); pass the validation layers like for the
  instance (older implementations need them).
- **When done:** window opens and stays open, no validation messages, clean exit. Code has
  `vkCreateDevice(physicalDevice, &createInfo, nullptr, &device)`,
  `vkGetDeviceQueue(device, indices.graphicsFamily.value(), 0, &graphicsQueue)` and `vkDestroyDevice(device, nullptr);`.
