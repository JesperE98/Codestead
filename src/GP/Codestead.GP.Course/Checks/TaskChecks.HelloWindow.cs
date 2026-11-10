namespace Codestead.GP.Course.Checks;

// Hello Window: a window that stays open, shows frames and is cleared to (0.2, 0.3, 0.3).
public static partial class TaskChecks
{
    private static bool Teal(CheckContext c) => c.ClearedTo(0.2, 0.3, 0.3);

    private static Dictionary<string, TaskCheck> HelloWindow => new()
    {
        // OpenGL
        ["render-loop"] = c => c.Shows,
        ["viewport"] = c => c.Built && c.Has(@"glfwSetFramebufferSizeCallback \( window , framebuffer_size_callback \)") && c.Has(@"glViewport \( 0 , 0 , width , height \)"),
        ["input"] = PerApi(
            opengl: c => c.Built && c.Has(@"glfwGetKey \( window , GLFW_KEY_ESCAPE \) == GLFW_PRESS") && c.Has(@"glfwSetWindowShouldClose \( window , true \)") && c.Has(@"while \( ! glfwWindowShouldClose \( window \) \) \{ processInput \( window \)"),
            d3d12: c => c.Built && c.Has("WM_KEYDOWN") && c.Has("VK_ESCAPE") && c.Has(@"DestroyWindow \( hWnd \)")),
        ["clear"] = PerApi(opengl: Teal, d3d12: c => c.Built && c.Has(@"ClearRenderTargetView \(") && c.Has(@"clearColor \[ \] = \{ 0\.2f , 0\.3f , 0\.3f , 1\.0f \}") && c.Count(@"ResourceBarrier \(") >= 2),
        // Vulkan
        ["surface"] = c => c.Built && c.Has(@"glfwCreateWindowSurface \( instance , window , nullptr , & surface \)") && c.Has(@"vkDestroySurfaceKHR \( instance , surface , nullptr \)"),
        ["present-queue"] = c => c.Built && c.Has("vkGetPhysicalDeviceSurfaceSupportKHR") && c.Has(@"presentFamily \. value \( \) , 0 , & presentQueue"),
        ["swap-chain-support"] = c => c.Built && c.Has("VK_KHR_SWAPCHAIN_EXTENSION_NAME") && c.Has(@"ppEnabledExtensionNames = deviceExtensions \. data \( \)") && c.Has("querySwapChainSupport"),
        ["swap-chain"] = PerApi(
            vulkan: c => c.Built && c.Has(@"vkCreateSwapchainKHR \( device , & createInfo , nullptr , & swapChain \)") && c.Has("vkGetSwapchainImagesKHR") && c.Has("vkDestroySwapchainKHR"),
            d3d12: c => c.Built && c.Has(@"CreateSwapChainForHwnd \(") && c.Has("DXGI_SWAP_EFFECT_FLIP_DISCARD") && c.Has(@"GetCurrentBackBufferIndex \( \)")),
        ["image-views"] = c => c.Built && c.Has("vkCreateImageView") && c.Has("vkDestroyImageView"),
        ["render-pass"] = c => c.Built && c.Has(@"loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR") && c.Has("vkCreateRenderPass") && c.Has("vkDestroyRenderPass"),
        ["framebuffers"] = c => c.Built && c.Has("vkCreateFramebuffer") && c.Has("vkDestroyFramebuffer"),
        ["command-buffer"] = c => c.Built && c.Has("vkCreateCommandPool") && c.Has("vkAllocateCommandBuffers") && c.Has("vkDestroyCommandPool"),
        ["record-commands"] = c => c.Built && c.Has("vkCmdBeginRenderPass") && c.Has("vkCmdEndRenderPass") && c.Has(@"\{ \{ \{ 0\.2f , 0\.3f , 0\.3f , 1\.0f \} \} \}"),
        ["draw-frame"] = Teal,
        // DirectX 12
        ["render-targets"] = c => c.Built && c.Has("D3D12_DESCRIPTOR_HEAP_TYPE_RTV") && c.Has(@"CreateRenderTargetView \(") && c.Has(@"GetBuffer \("),
        ["command-list"] = c => c.Built && c.Has(@"CreateCommandAllocator \(") && c.Has(@"CreateCommandList \(") && c.Has(@"m_commandList -> Close \( \)"),
        ["fence"] = c => c.Built && c.Has(@"CreateFence \(") && c.Has(@"Signal \(") && c.Has("SetEventOnCompletion"),
        ["render"] = Teal,
    };
}
