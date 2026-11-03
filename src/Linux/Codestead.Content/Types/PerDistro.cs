namespace Codestead.Content;

// A value that may depend on the distribution.

/// <summary>
/// TS: <c>PerDistro&lt;T&gt; = T | ((d: Distro) =&gt; T)</c> – a value, or a function that picks the value for a distro.
/// Converts implicitly from both.
/// </summary>
public sealed partial class PerDistro<T>
{
    private readonly T? value;
    private readonly Func<Distro, T>? fn;

    public PerDistro(T value) => this.value = value;

    public PerDistro(Func<Distro, T> fn) => this.fn = fn;

    public static implicit operator PerDistro<T>(T value) => new(value);

    public static implicit operator PerDistro<T>(Func<Distro, T> fn) => new(fn);

    /// <summary>True when this is a function of the distro (rather than a plain value).</summary>
    public bool IsFunction => fn is not null;

    public T Resolve(Distro d) => fn is not null ? fn(d) : value!;

    /// <summary>JS truthiness of the raw value (a function is always truthy; a string must be non-empty).</summary>
    internal bool Truthy => fn is not null || (value is string s ? s.Length > 0 : value is not null);
}
