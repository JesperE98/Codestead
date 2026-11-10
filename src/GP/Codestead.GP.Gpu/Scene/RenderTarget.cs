namespace Codestead.GP.Gpu.Scene;

/// <summary>
/// An off-screen render target (a framebuffer object, a Vulkan image rendered to, a D3D12 render target texture): its
/// size (0 = the window's), its colour attachments (0 for a depth-only shadow map), whether it has depth and stencil, multisampling, and whether its colour is stored as
/// floating point (GL_RGBA16F …, not clamped to 0–1).
/// </summary>
public sealed record RenderTarget(string Id, int Width = 0, int Height = 0, int ColorAttachments = 1, bool Depth = true, bool Stencil = true, int Samples = 1, bool Float = false, int Layers = 1);
