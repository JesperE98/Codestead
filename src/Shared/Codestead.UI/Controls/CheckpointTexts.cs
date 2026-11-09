namespace Codestead.UI.Controls;

// The localised texts of the checkpoint controls.

/// <summary>Localised texts used by the checkpoint controls.</summary>
public sealed record CheckpointTexts(
    string Check,
    string Correct,
    string Wrong,
    string PredictPrompt,
    string TryPrompt,
    string Done,
    string AnswerPlaceholder,
    string Question,
    string ShowAnswer = "Show the answer",
    string AlmostPath = "Almost! Look at how the paths are written: ls shows each name the way you gave it, with the directory in front.");
