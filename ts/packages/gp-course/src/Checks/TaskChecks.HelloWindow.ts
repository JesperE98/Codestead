import { type CheckContext } from "../CheckContext.js";
import { perApi, type Checks } from "./TaskChecks.PerApi.js";

// Hello Window: a window that stays open, shows frames and is cleared to (0.2, 0.3, 0.3).

/** C#: Teal(CheckContext), an overload of Teal(double[]) in TaskChecks.InPractice. */

export function tealClear(c: CheckContext): boolean {
  return c.clearedTo(0.2, 0.3, 0.3);
}

export function helloWindow(): Checks {
  return {
    // OpenGL
    "render-loop": c => c.shows,
    "viewport": c => c.built && c.has("glfwSetFramebufferSizeCallback \\( window , framebuffer_size_callback \\)") && c.has("glViewport \\( 0 , 0 , width , height \\)"),
    "input": perApi({
        opengl: c => c.built && c.has("glfwGetKey \\( window , GLFW_KEY_ESCAPE \\) == GLFW_PRESS") && c.has("glfwSetWindowShouldClose \\( window , true \\)") && c.has("while \\( ! glfwWindowShouldClose \\( window \\) \\) \\{ processInput \\( window \\)"),
        d3d12: c => c.built && c.has("WM_KEYDOWN") && c.has("VK_ESCAPE") && c.has("DestroyWindow \\( hWnd \\)")}),
    "clear": perApi({opengl: tealClear, d3d12: c => c.built && c.has("ClearRenderTargetView \\(") && c.has("clearColor \\[ \\] = \\{ 0\\.2f , 0\\.3f , 0\\.3f , 1\\.0f \\}") && c.count("ResourceBarrier \\(") >= 2}),
    // Vulkan
    "surface": c => c.built && c.has("glfwCreateWindowSurface \\( instance , window , nullptr , & surface \\)") && c.has("vkDestroySurfaceKHR \\( instance , surface , nullptr \\)"),
    "present-queue": c => c.built && c.has("vkGetPhysicalDeviceSurfaceSupportKHR") && c.has("presentFamily \\. value \\( \\) , 0 , & presentQueue"),
    "swap-chain-support": c => c.built && c.has("VK_KHR_SWAPCHAIN_EXTENSION_NAME") && c.has("ppEnabledExtensionNames = deviceExtensions \\. data \\( \\)") && c.has("querySwapChainSupport"),
    "swap-chain": perApi({
        vulkan: c => c.built && c.has("vkCreateSwapchainKHR \\( device , & createInfo , nullptr , & swapChain \\)") && c.has("vkGetSwapchainImagesKHR") && c.has("vkDestroySwapchainKHR"),
        d3d12: c => c.built && c.has("CreateSwapChainForHwnd \\(") && c.has("DXGI_SWAP_EFFECT_FLIP_DISCARD") && c.has("GetCurrentBackBufferIndex \\( \\)")}),
    "image-views": c => c.built && c.has("vkCreateImageView") && c.has("vkDestroyImageView"),
    "render-pass": c => c.built && c.has("loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR") && c.has("vkCreateRenderPass") && c.has("vkDestroyRenderPass"),
    "framebuffers": c => c.built && c.has("vkCreateFramebuffer") && c.has("vkDestroyFramebuffer"),
    "command-buffer": c => c.built && c.has("vkCreateCommandPool") && c.has("vkAllocateCommandBuffers") && c.has("vkDestroyCommandPool"),
    "record-commands": c => c.built && c.has("vkCmdBeginRenderPass") && c.has("vkCmdEndRenderPass") && c.has("\\{ \\{ \\{ 0\\.2f , 0\\.3f , 0\\.3f , 1\\.0f \\} \\} \\}"),
    "draw-frame": tealClear,
    // DirectX 12
    "render-targets": c => c.built && c.has("D3D12_DESCRIPTOR_HEAP_TYPE_RTV") && c.has("CreateRenderTargetView \\(") && c.has("GetBuffer \\("),
    "command-list": c => c.built && c.has("CreateCommandAllocator \\(") && c.has("CreateCommandList \\(") && c.has("m_commandList -> Close \\( \\)"),
    "fence": c => c.built && c.has("CreateFence \\(") && c.has("Signal \\(") && c.has("SetEventOnCompletion"),
    "render": tealClear,
  };
}
