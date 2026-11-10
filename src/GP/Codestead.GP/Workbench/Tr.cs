namespace Codestead.GP.Workbench;

/// <summary>A user-interface text in the learner's language (LearningWindow.T).</summary>
public delegate string Tr(string key, params (string Name, object Value)[] args);
