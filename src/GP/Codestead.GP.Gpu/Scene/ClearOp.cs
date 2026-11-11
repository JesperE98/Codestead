namespace Codestead.GP.Gpu.Scene;

/// <summary>
/// Clearing a target (null = the window): the colour, the depth and/or the stencil value. <paramref name="Attachment"/>:
/// only that colour attachment (glClearBufferfv(GL_COLOR, i, …), ClearRenderTargetView of one of several targets);
/// null: all of them.
/// </summary>
public sealed record ClearOp(int BeforeDraw, string? Target, double[]? Color, double? Depth, int? Stencil, int? Attachment = null) : FrameOp(BeforeDraw);
