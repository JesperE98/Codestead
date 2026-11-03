namespace Codestead.Shell;

// Syntax tree: a redirection (> file, 2>&1, << END ...).

public partial class Redirect
{
    /// <summary>&gt; &gt;&gt; &lt; 2&gt; 2&gt;&gt; 2&gt;&amp;1 &gt;&amp;2 &amp;&gt; &lt;&lt; &lt;&lt;- &lt;&lt;&lt;</summary>
    public string Op { get; set; } = "";
    public Word? Target { get; set; }
    /// <summary>The text of a here-document (&lt;&lt; END ... END).</summary>
    public string? Body { get; set; }
    /// <summary>Should $VAR be expanded in the here-document? (Not if the end word is quoted.)</summary>
    public bool? Expand { get; set; }
}
