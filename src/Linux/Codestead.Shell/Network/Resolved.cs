namespace Codestead.Shell;

// Network model: the result of a name lookup (ResolvedOk or ResolvedFail).

/// <summary>Result of <see cref="NetworkLib.ResolveHost"/>: <see cref="ResolvedOk"/> or <see cref="ResolvedFail"/>.</summary>
public abstract partial class Resolved
{
    public abstract bool Ok { get; }
}
