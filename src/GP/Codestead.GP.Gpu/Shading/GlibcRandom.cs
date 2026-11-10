namespace Codestead.GP.Gpu.Shading;

/// <summary>
/// rand() / srand() as glibc implements them (the additive feedback generator of random_r, TYPE_3), so a program that
/// seeds with srand(42) gets the same numbers as on Linux – learnopengl's asteroid field is built from them.
/// </summary>
public sealed class GlibcRandom
{
    private int i;
    private readonly List<int> state = new();

    public GlibcRandom(uint seed)
    {
        if (seed == 0) seed = 1;
        state.Add((int)seed);
        for (int k = 1; k < 31; k++)
        {
            // r[k] = (16807 * r[k-1]) % 2147483647, computed without overflow (Schrage), as glibc does.
            long hi = state[k - 1] / 127773, lo = state[k - 1] % 127773;
            long word = 16807 * lo - 2836 * hi;
            if (word < 0) word += 2147483647;
            state.Add((int)word);
        }
        for (int k = 31; k < 34; k++) state.Add(state[k - 31]);
        // The first 310 outputs are thrown away.
        for (int k = 34; k < 344; k++) state.Add(unchecked(state[k - 31] + state[k - 3]));
        i = 344;
    }

    public int Next()
    {
        int value = unchecked(state[i - 31] + state[i - 3]);
        state.Add(value);
        i++;
        if (state.Count > 4096)
        {
            state.RemoveRange(0, state.Count - 64);
            i = state.Count;
        }
        return (int)((uint)value >> 1);
    }
}
