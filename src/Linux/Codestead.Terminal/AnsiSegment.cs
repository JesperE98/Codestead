namespace Codestead.Terminal;

// A piece of terminal text with its ANSI attributes.

/// <summary>A piece of terminal text with the same ANSI attributes.</summary>
public readonly record struct AnsiSegment(string Text, int Fg, int Bg, bool Bold, bool Dim);
