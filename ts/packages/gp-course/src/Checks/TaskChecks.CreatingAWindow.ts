import { type Checks } from "./TaskChecks.PerApi.js";

// Creating a window: OpenGL (GLFW + GLAD), Vulkan (instance, validation layers, devices), DirectX 12 (Win32
// window, debug layer, factory, device, command queue).

export function creatingAWindow(): Checks {
  return {
    // OpenGL
    "glfw-init": c => c.built && c.has("glfwInit \\( \\)") && c.has("GLFW_CONTEXT_VERSION_MAJOR , 3") && c.has("GLFW_CONTEXT_VERSION_MINOR , 3") && c.has("GLFW_OPENGL_CORE_PROFILE"),
    "create-window": c => c.built && c.scene?.windowCreated === true && c.has("glfwMakeContextCurrent \\( window \\)"),
    "glad": c => c.built && c.has("gladLoadGLLoader \\( \\( GLADloadproc \\) glfwGetProcAddress \\)"),
    "terminate": c => c.built && c.has("glfwTerminate \\( \\) ; return 0 ; \\}"),
    // Vulkan
    "instance": c => c.built && c.has("vkCreateInstance \\( & createInfo , nullptr , & instance \\)") && c.has("glfwGetRequiredInstanceExtensions") && c.has("vkDestroyInstance \\( instance , nullptr \\)"),
    "validation-layers": c => c.built && c.has("\"VK_LAYER_KHRONOS_validation\"") && c.has("ppEnabledLayerNames = validationLayers \\. data \\( \\)") && c.has("vkEnumerateInstanceLayerProperties"),
    "debug-messenger": c => c.built && c.has("CreateDebugUtilsMessengerEXT \\( instance , & createInfo , nullptr , & debugMessenger \\)") && c.has("DestroyDebugUtilsMessengerEXT \\( instance , debugMessenger , nullptr \\)") && c.has("VK_EXT_DEBUG_UTILS_EXTENSION_NAME"),
    "physical-device": c => c.built && c.has("vkEnumeratePhysicalDevices") && c.has("VK_QUEUE_GRAPHICS_BIT") && c.has("pickPhysicalDevice \\( \\) ;"),
    "logical-device": c => c.built && c.has("vkCreateDevice \\( physicalDevice , & createInfo , nullptr , & device \\)") && c.has("vkGetDeviceQueue \\( device ,") && c.has("vkDestroyDevice \\( device , nullptr \\)"),
    // DirectX 12
    "factory": c => c.built && c.has("CreateDXGIFactory2 \\(") && c.has("IDXGIFactory4"),
    "debug-layer": c => c.built && c.has("D3D12GetDebugInterface \\(") && c.has("EnableDebugLayer \\( \\)") && c.has("DXGI_CREATE_FACTORY_DEBUG"),
    "device": c => c.built && c.has("EnumAdapters1") && c.has("DXGI_ADAPTER_FLAG_SOFTWARE") && c.has("D3D12CreateDevice \\( hardwareAdapter \\. Get \\( \\) , D3D_FEATURE_LEVEL_11_0"),
    "command-queue": c => c.built && c.has("CreateCommandQueue \\( & queueDesc") && c.has("D3D12_COMMAND_LIST_TYPE_DIRECT"),
  };
}
