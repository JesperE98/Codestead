namespace Codestead.GP.Gpu.Scene;

/// <summary>Clearing a target (null = the window): the colour, the depth and/or the stencil value.</summary>
public sealed record ClearOp(int BeforeDraw, string? Target, double[]? Color, double? Depth, int? Stencil) : FrameOp(BeforeDraw);
