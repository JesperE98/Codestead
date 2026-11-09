namespace Codestead.GP.Course.Checks;

// Transformations: a transform matrix in the vertex shader; the container spinning in the bottom right; orbiting;
// a second container. Checked at time 1 s (the window centre is (0.5, 0.5); NDC (0.5, -0.5) is (0.75, 0.75)).
public static partial class TaskChecks
{
    private static Dictionary<string, TaskCheck> Transformations => new()
    {
        // Rotated 90° and scaled by 0.5: the rectangle's corners are empty now, its middle drawn.
        ["transform-uniform"] = c => c.DrawnAt(0.5, 0.5) && c.IsClear(0.3, 0.3) && c.HasInShaders(@"(?i)transform"),
        // translate(0.5, -0.5) * rotate(time): centred in the bottom-right quarter.
        ["translate-rotate"] = c => c.DrawnAt(0.75, 0.75) && c.IsClear(0.845, 0.4245) && c.IsClear(0.25, 0.25),
        // rotate(time) * translate(0.5, -0.5): it orbits; at 1 s its centre is at (0.845, 0.4245).
        ["rotate-first"] = c => c.DrawnAt(0.845, 0.4245) && c.IsClear(0.75, 0.75),
        // A second container in the top-left quarter, scaled by sin(time).
        ["second-container"] = c => c.DrawnAt(0.25, 0.25) && c.Scene!.Draws.Count >= 2,
    };

    private static Dictionary<string, TaskCheck> CoordinateSystems => new()
    {
        // Vulkan: the uniform buffer for view and projection, its descriptor, the depth image.
        ["uniform-buffer"] = c => c.Built && c.Has("VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT") && c.Has(@"vkMapMemory \(") && c.Has(@"updateUniformBuffer \("),
        ["uniform-descriptor"] = c => c.Built && c.Has("VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER") && c.Has(@"pBufferInfo = &"),
        ["depth-image"] = c => c.Built && c.Has(@"createDepthResources \( \) ;") && c.Has("VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT"),
        ["plane"] = c => c.DrawnAt(0.5, 0.5) && c.IsClear(0.1, 0.5) && c.Has(@"(?i)perspective"),
        ["cube"] = c => c.Drew && c.Scene!.Draws.Any(d => d.Count == 36),
        ["spin"] = c => c.Drew && c.Scene!.Animated && c.Scene.Draws.Any(d => d.Count == 36),
        ["depth-test"] = c => c.Drew && c.Scene!.Draws.Any(d => d.DepthTest),
        ["ten-cubes"] = c => c.Drew && c.Scene!.Draws.Count(d => d.Count == 36) >= 10,
        ["rotate-every-third"] = c => c.Drew && c.Has(@"% 3 == 0") && c.Scene!.Draws.Count(d => d.Count == 36) >= 10,
    };

    private static Dictionary<string, TaskCheck> Camera => new()
    {
        ["look-at"] = c => c.Drew && c.Has(@"(?i)lookAt"),
        ["circle"] = c => c.Drew && c.Has(@"(?i)radius") && c.Has(@"\bsin \(") && c.Has(@"\bcos \("),
        ["free-camera"] = c => c.Drew && c.Has("cameraPos") && c.Has("cameraFront") && c.Has("cameraUp"),
        ["wasd"] = c => c.Built && c.Has("deltaTime") && c.Has(@"(?:GLFW_KEY_W|'W')"),
        ["mouse-look"] = c => c.Built && c.Has(@"(?i)\byaw\b") && c.Has(@"(?i)\bpitch\b") && c.Has(@"(?i)firstMouse"),
        ["zoom"] = c => c.Drew && c.Has(@"(?i)\bfov\b") && c.Has(@"(?i)scroll|WM_MOUSEWHEEL"),
    };
}
