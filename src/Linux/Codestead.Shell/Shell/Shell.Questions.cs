namespace Codestead.Shell;

// Shell: questions to the user (yes/no and text answers) and Ctrl+C.

public partial class Shell
{
    /// <summary>Asks the user yes/no. The answer is handled on the next Execute().</summary>
    public void Ask(string question, bool defaultYes, Func<bool, Sink, int> onAnswer)
    {
        PendingQuestion = new Pending
        {
            Question = question,
            DefaultYes = defaultYes,
            OnAnswer = (yes, io, _) => onAnswer(yes, io),
            User = CurrentUser().Name,
            Line = currentLine,
        };
    }

    /// <summary>Asks the user to type a line of text (used by `read`). With secret the answer is not shown (passwords).</summary>
    public void AskText(string prompt, Func<string, Sink, int> onText, bool secret = false)
    {
        PendingQuestion = new Pending
        {
            Question = prompt,
            DefaultYes = false,
            OnAnswer = (_, io, text) => onText(text, io),
            User = CurrentUser().Name,
            Line = currentLine,
            Secret = secret,
        };
    }

    /// <summary>Can `read` ask the user directly? Only on the command line, not inside scripts.</summary>
    public bool CanAskInteractively() => ScriptDepth == 0 && substDepth == 0;

    /// <summary>Cancels a question or a started multi-line command line (Ctrl+C).</summary>
    public void Cancel()
    {
        PendingQuestion = null;
        partial = null;
    }
}
