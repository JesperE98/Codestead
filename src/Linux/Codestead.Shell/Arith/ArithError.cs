namespace Codestead.Shell;

// Error in an arithmetic expression ($(( ... )), (( ... ))).

public partial class ArithError(string message) : Exception(message);
