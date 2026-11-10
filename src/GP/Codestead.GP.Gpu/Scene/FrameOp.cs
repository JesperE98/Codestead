namespace Codestead.GP.Gpu.Scene;

/// <summary>Something done to the targets between draws, before draw number <see cref="BeforeDraw"/> (or after the last).</summary>
public abstract record FrameOp(int BeforeDraw);
