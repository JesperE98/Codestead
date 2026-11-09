namespace Codestead.GP.Course.Checks;

// Hello Window: a window that stays open, shows frames and is cleared to (0.2, 0.3, 0.3).
public static partial class TaskChecks
{
    private static Dictionary<string, TaskCheck> HelloWindow => new()
    {
        // OpenGL
        ["render-loop"] = c => c.Shows,
        ["viewport"] = c => c.Built && c.Has(@"glfwSetFramebufferSizeCallback \( window , framebuffer_size_callback \)") && c.Has(@"glViewport \( 0 , 0 , width , height \)"),
        ["input"] = c => c.Built && c.Has(@"glfwGetKey \( window , GLFW_KEY_ESCAPE \) == GLFW_PRESS") && c.Has(@"glfwSetWindowShouldClose \( window , true \)") && c.Has(@"while \( ! glfwWindowShouldClose \( window \) \) \{ processInput \( window \)"),
        ["clear"] = c => c.ClearedTo(0.2, 0.3, 0.3),
    };
}
