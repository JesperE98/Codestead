namespace Codestead.GP.Course.Checks;

// Creating a window: OpenGL (GLFW + GLAD), Vulkan (instance, validation layers, devices), DirectX 12 (Win32
// window, debug layer, factory, device, command queue).
public static partial class TaskChecks
{
    private static Dictionary<string, TaskCheck> CreatingAWindow => new()
    {
        // OpenGL
        ["glfw-init"] = c => c.Built && c.Has(@"glfwInit \( \)") && c.Has(@"GLFW_CONTEXT_VERSION_MAJOR , 3") && c.Has(@"GLFW_CONTEXT_VERSION_MINOR , 3") && c.Has("GLFW_OPENGL_CORE_PROFILE"),
        ["create-window"] = c => c.Built && c.Scene?.WindowCreated == true && c.Has(@"glfwMakeContextCurrent \( window \)"),
        ["glad"] = c => c.Built && c.Has(@"gladLoadGLLoader \( \( GLADloadproc \) glfwGetProcAddress \)"),
        ["terminate"] = c => c.Built && c.Has(@"glfwTerminate \( \) ; return 0 ; \}"),
        // Vulkan
        ["instance"] = c => c.Built && c.Has(@"vkCreateInstance \( & createInfo , nullptr , & instance \)") && c.Has("glfwGetRequiredInstanceExtensions") && c.Has(@"vkDestroyInstance \( instance , nullptr \)"),
        ["validation-layers"] = c => c.Built && c.Has("\"VK_LAYER_KHRONOS_validation\"") && c.Has(@"ppEnabledLayerNames = validationLayers \. data \( \)") && c.Has("vkEnumerateInstanceLayerProperties"),
        ["debug-messenger"] = c => c.Built && c.Has(@"CreateDebugUtilsMessengerEXT \( instance , & createInfo , nullptr , & debugMessenger \)") && c.Has(@"DestroyDebugUtilsMessengerEXT \( instance , debugMessenger , nullptr \)") && c.Has("VK_EXT_DEBUG_UTILS_EXTENSION_NAME"),
        ["physical-device"] = c => c.Built && c.Has("vkEnumeratePhysicalDevices") && c.Has("VK_QUEUE_GRAPHICS_BIT") && c.Has(@"pickPhysicalDevice \( \) ;"),
        ["logical-device"] = c => c.Built && c.Has(@"vkCreateDevice \( physicalDevice , & createInfo , nullptr , & device \)") && c.Has(@"vkGetDeviceQueue \( device ,") && c.Has(@"vkDestroyDevice \( device , nullptr \)"),
        // DirectX 12
        ["factory"] = c => c.Built && c.Has(@"CreateDXGIFactory2 \(") && c.Has("IDXGIFactory4"),
        ["debug-layer"] = c => c.Built && c.Has(@"D3D12GetDebugInterface \(") && c.Has(@"EnableDebugLayer \( \)") && c.Has("DXGI_CREATE_FACTORY_DEBUG"),
        ["device"] = c => c.Built && c.Has("EnumAdapters1") && c.Has("DXGI_ADAPTER_FLAG_SOFTWARE") && c.Has(@"D3D12CreateDevice \( hardwareAdapter \. Get \( \) , D3D_FEATURE_LEVEL_11_0"),
        ["command-queue"] = c => c.Built && c.Has(@"CreateCommandQueue \( & queueDesc") && c.Has("D3D12_COMMAND_LIST_TYPE_DIRECT"),
    };
}
