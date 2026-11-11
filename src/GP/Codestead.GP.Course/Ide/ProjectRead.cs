using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Ide;

/// <summary>The learner's project as read from the folder, and the chapter's start files that were not found in it.</summary>
public sealed record ProjectRead(GpuProject Project, IReadOnlyList<string> Missing);
