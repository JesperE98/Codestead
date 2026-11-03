namespace Codestead.Hub.Core;

// The error for a catalog that cannot be used.

public sealed class CatalogException : Exception
{
    public CatalogException(string message, Exception? inner = null) : base(message, inner) { }
}
