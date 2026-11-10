namespace Codestead.GP.Gpu.Scene;

/// <summary>Copying one target into another (glBlitFramebuffer, resolving a multisampled image); null = the window.</summary>
/// <param name="Color">The colour is copied (GL_COLOR_BUFFER_BIT; a resolve).</param>
/// <param name="Depth">The depth (and stencil) is copied (GL_DEPTH_BUFFER_BIT: deferred shading's G-buffer depth into the window).</param>
/// <param name="Average">A smaller copy is the average of the pixels it covers (a mip level made from the one above:
/// glGenerateMipmap, a linear blit), not the nearest pixel.</param>
public sealed record CopyOp(int BeforeDraw, string? From, string? To, bool Color = true, bool Depth = false, bool Average = false) : FrameOp(BeforeDraw);
