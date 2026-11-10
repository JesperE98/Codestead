using Codestead.UI.Controls;

namespace Codestead.GP;

/// <summary>
/// Codestead GP's lessons only have quiz questions, which need no sandbox. This one answers the rare "try it" block
/// with an empty output.
/// </summary>
internal sealed class NoSandbox : ISandbox
{
    public string OutputOf(string command) => "";
}
