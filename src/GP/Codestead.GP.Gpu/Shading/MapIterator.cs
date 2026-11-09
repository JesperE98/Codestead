namespace Codestead.GP.Gpu.Shading;

/// <summary>A position in a std::map, forwards (begin) or backwards (rbegin); Position == Count is end()/rend().</summary>
public sealed record MapIterator(SortedDictionary<double, ShaderValue> Map, int Position, bool Reverse)
{
    public KeyValuePair<double, ShaderValue>? Current =>
        Position >= 0 && Position < Map.Count ? Map.ElementAt(Reverse ? Map.Count - 1 - Position : Position) : null;
}
