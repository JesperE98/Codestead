namespace Codestead.GP.Gpu.Raster;

/// <summary>The sRGB transfer function (IEC 61966-2-1), as GPUs apply it for sRGB formats.</summary>
public static class SrgbCurve
{
    public static double ToLinear(double c) => c <= 0.04045 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);

    public static double FromLinear(double c)
    {
        c = Math.Clamp(c, 0, 1);
        return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.Pow(c, 1 / 2.4) - 0.055;
    }
}
