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
    };
}
