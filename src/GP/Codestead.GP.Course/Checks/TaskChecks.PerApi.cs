using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// A task id that means different code in different APIs gets one check per API.
public static partial class TaskChecks
{
    private static TaskCheck PerApi(TaskCheck? opengl = null, TaskCheck? vulkan = null, TaskCheck? d3d12 = null) => c => c.Api switch
    {
        Apis.OpenGL => opengl?.Invoke(c) ?? false,
        Apis.Vulkan => vulkan?.Invoke(c) ?? false,
        Apis.D3D12 => d3d12?.Invoke(c) ?? false,
        _ => false,
    };
}
