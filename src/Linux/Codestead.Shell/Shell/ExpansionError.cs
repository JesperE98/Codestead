namespace Codestead.Shell;

// Error thrown while expanding a word (e.g. ${X:?message}); stops the command.

internal sealed class ExpansionError(string message) : Exception(message);
