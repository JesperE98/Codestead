import { Apis } from "@codestead/gp-gpu";
import type { TaskCheck } from "../TaskCheck.js";

/** A chapter's checks by task id. */
export type Checks = Record<string, TaskCheck>;

/** Chapters and their checks (C#: IEnumerable&lt;(string Chapter, Dictionary&lt;string, TaskCheck&gt; Checks)&gt;). */
export type ChapterChecks = [chapter: string, checks: Checks][];

// A task id that means different code in different APIs gets one check per API.
export function perApi({ opengl, vulkan, d3d12 }: { opengl?: TaskCheck; vulkan?: TaskCheck; d3d12?: TaskCheck }): TaskCheck {
  return (c) => {
    switch (c.api) {
      case Apis.OpenGL:
        return opengl?.(c) ?? false;
      case Apis.Vulkan:
        return vulkan?.(c) ?? false;
      case Apis.D3D12:
        return d3d12?.(c) ?? false;
      default:
        return false;
    }
  };
}
