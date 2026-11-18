import type { GpuProject } from "@codestead/gp-gpu";

/** The learner's project as read from the folder, and the chapter's start files that were not found in it. */
export class ProjectRead {
  constructor(
    readonly project: GpuProject,
    readonly missing: readonly string[],
  ) {}
}
