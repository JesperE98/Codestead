using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Reads a Vulkan program written like vulkan-tutorial.com's HelloTriangleApplication: which objects it creates
/// (in initVulkan's order), whether drawFrame presents, the clear value, the graphics pipeline's fixed functions
/// and shaders, the vertex and index buffers and the draw command. Missing pieces become the notes a validation
/// layer or a crash would give.
/// </summary>
public sealed partial class VulkanReader
{
    private readonly GpuProject project;
    private readonly CppSource src;
    private readonly Scene.Scene scene = new() { Api = Apis.Vulkan };

    private VulkanReader(GpuProject project)
    {
        this.project = project;
        var main = project.MainFile;
        src = new CppSource(main, project.Files.TryGetValue(main, out var t) ? t : "");
    }

    public static Scene.Scene Read(GpuProject project) => new VulkanReader(project).Run();

    /// <summary>Is a function called (somewhere in the program)? The tutorial calls its create* functions from initVulkan.</summary>
    private bool Called(string fn) => src.HasCall(fn);

    /// <summary>A Vulkan function is used inside a function body that is itself reached from main.</summary>
    private bool Reached(string vkFunction)
    {
        foreach (var call in src.Calls(vkFunction))
        {
            var fn = src.FunctionAt(call.Offset);
            if (fn is null || fn == "main" || IsReachable(fn, new HashSet<string>())) return true;
        }
        return false;
    }

    private bool IsReachable(string fn, HashSet<string> seen)
    {
        if (!seen.Add(fn)) return false;
        if (fn is "main" or "run") return true;
        foreach (var (caller, _) in src.Functions)
            if (caller != fn && src.Calls(caller, fn) && IsReachable(caller, seen)) return true;
        return false;
    }

    private Scene.Scene Run()
    {
        if (!src.Functions.ContainsKey("main"))
        {
            scene.Notes.Add(SimNote.Error("noMain"));
            return scene;
        }
        Window();
        if (!scene.WindowCreated) return scene;
        bool instance = Reached("vkCreateInstance");
        if (!instance)
        {
            scene.Notes.Add(SimNote.Info("vkNoInstance"));
            return scene;
        }
        scene.Log.Add("vkCreateInstance: VK_SUCCESS");
        if (Reached("vkCreateDebugUtilsMessengerEXT") || src.Uses("CreateDebugUtilsMessengerEXT")) scene.Log.Add("validation layer: VK_LAYER_KHRONOS_validation enabled");
        if (!Reached("vkEnumeratePhysicalDevices")) return Done("vkNoPhysicalDevice");
        scene.Log.Add("GPU: Codestead Virtual GPU (simulated)");
        if (!Reached("vkCreateDevice")) return Done("vkNoDevice");
        if (!Reached("glfwCreateWindowSurface") && !Reached("vkCreateWin32SurfaceKHR")) return Done("vkNoSurface");
        if (!Reached("vkCreateSwapchainKHR")) return Done("vkNoSwapchain");
        if (!Reached("vkCreateImageView")) return Done("vkNoImageViews");
        bool dynamicRendering = src.HasCall("vkCmdBeginRendering") || src.HasCall("vkCmdBeginRenderingKHR");
        if (!dynamicRendering && !Reached("vkCreateRenderPass")) return Done("vkNoRenderPass");
        if (!dynamicRendering && !Reached("vkCreateFramebuffer")) return Done("vkNoFramebuffers");
        if (!Reached("vkCreateCommandPool") || !Reached("vkAllocateCommandBuffers")) return Done("vkNoCommandBuffer");
        if (!Reached("vkQueueSubmit")) return Done("vkNoSubmit");
        if (!Reached("vkQueuePresentKHR") || !Reached("vkAcquireNextImageKHR")) return Done("vkNoPresent");
        scene.Presents = scene.RenderLoop;
        if (!src.HasCall("vkDeviceWaitIdle")) scene.Notes.Add(SimNote.Warning("vkNoWaitIdle"));
        if (!src.HasCall("vkWaitForFences")) scene.Notes.Add(SimNote.Warning("vkNoFenceWait"));
        Frame(dynamicRendering);
        return scene;
    }

    private Scene.Scene Done(string note)
    {
        scene.Notes.Add(SimNote.Info(note));
        return scene;
    }

    private void Window()
    {
        var create = src.Calls("glfwCreateWindow").FirstOrDefault();
        if (create is null || !src.HasCall("glfwInit"))
        {
            scene.Notes.Add(SimNote.Info("noWindow"));
            return;
        }
        scene.WindowCreated = true;
        scene.Width = src.Int(create.Arg(0)) ?? 800;
        scene.Height = src.Int(create.Arg(1)) ?? 600;
        scene.WindowTitle = CppSource.StringArg(create.Arg(2)) ?? "";
        scene.RenderLoop = Regex.IsMatch(src.Code, @"while\s*\(\s*!\s*glfwWindowShouldClose\s*\(");
        if (!scene.RenderLoop) scene.Notes.Add(SimNote.Warning("noLoop"));
        else if (!src.HasCall("glfwPollEvents")) scene.Notes.Add(SimNote.Warning("noPollEvents"));
        if (!src.Code.Contains("GLFW_NO_API", StringComparison.Ordinal)) scene.Notes.Add(SimNote.Warning("vkNoApiHint"));
    }
}
