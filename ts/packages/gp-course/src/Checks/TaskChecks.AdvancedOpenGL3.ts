import { type CheckContext, type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";

// Advanced OpenGL, round 3: geometry shaders (learnopengl's houses, the exploding planet, its normals), instancing (the
// quads, the asteroid field) and anti-aliasing (the green cube's edges) – the same pixels in every API.

/** The background, clear (0.1, 0.1, 0.1). */

export function background(p: Rgba): boolean {
  return Math.abs(p[0] - 0.1) < 0.03 && Math.abs(p[1] - 0.1) < 0.03 && Math.abs(p[2] - 0.1) < 0.03;
}

export function red(p: Rgba): boolean {
  return p[0] > 0.8 && p[1] < 0.2 && p[2] < 0.2;
}

export function yellow(p: Rgba): boolean {
  return p[0] > 0.8 && p[1] > 0.8 && p[2] < 0.2;
}

/** The planet's continents: green above red and blue. */

export function land(p: Rgba): boolean {
  return p[1] > p[0] + 0.05 && p[1] > p[2] + 0.05;
}

/** The rock: grey, a little warm (not the background's dark grey). */

export function rock(p: Rgba): boolean {
  return p[0] > 0.35 && Math.abs(p[0] - p[1]) < 0.05 && Math.abs(p[1] - p[2]) < 0.05;
}

/** The geometry stage is part of the program: a geometry shader created and used. */

export function usesGeometryShader(c: CheckContext): boolean {
  return (c.api === "opengl" ? c.has("GL_GEOMETRY_SHADER|\\.gs\"") : c.api === "vulkan" ? c.has("VK_SHADER_STAGE_GEOMETRY_BIT") && c.has("geometryShader = VK_TRUE") : c.has("gs_5_0") && c.has("\\.GS = ")) && c.hasInShaders("EmitVertex|\\.Append \\(");
}

/** The edge pixels of the green cube (or its grey picture): neither the background nor pure green / pure grey – with 4 samples per pixel a few hundred at 800 × 600, a few dozen in the small check frame. */

export function mixedEdges(c: CheckContext): number {
  return c.countPixels(p => !background(p) && !(p[0] < 0.05 && p[1] > 0.95 && p[2] < 0.05)
    && !(Math.abs(p[0] - 0.714) < 0.02 && Math.abs(p[1] - 0.714) < 0.02 && Math.abs(p[2] - 0.714) < 0.02));
}

export function smooth(c: CheckContext): boolean {
  return c.drew && mixedEdges(c) > 30;
}

export function advancedOpenGL3(): ChapterChecks {
  return [
    ["geometry-shader", {
        "pass-through": c => c.shows && usesGeometryShader(c),
        // The red house around the point (-0.5, 0.5), its roof up to y = 0.9.
        "houses": c => c.drew && usesGeometryShader(c) && at(c, 170, 170, red) && at(c, 230, 170, red) && at(c, 200, 40, red),
        "roof-white": c => c.drew && at(c, 170, 170, red) && at(c, 200, 38, p => p[0] > 0.9 && p[1] > 0.6 && p[2] > 0.6),
        "planet": c => c.drew && at(c, 400, 300, land) && at(c, 300, 300, land) && at(c, 170, 170, background),
        // At t = 1 s the triangles are 1.84 units out: the planet's middle is empty.
        "explode": c => c.drew && at(c, 400, 300, background) && c.hasInShaders("sin \\( (?:\\w+\\.)?time \\)"),
        "normals": c => c.drew && at(c, 400, 300, land) && c.countPixels(yellow) > 20,
    }],
    ["instancing", {
        // 100 quads: the corners of the grid, none in the middle any more.
        "offsets": c => c.drew && at(c, 40, 30, p => !background(p)) && at(c, 760, 570, p => !background(p)) && at(c, 400, 300, background),
        "instanced-array": c => c.drew && at(c, 40, 30, p => !background(p)) && at(c, 760, 570, p => !background(p)) && (c.api === "opengl" ? c.has("glVertexAttribDivisor \\( 2 , 1 \\)") : c.api === "vulkan" ? c.has("VK_VERTEX_INPUT_RATE_INSTANCE") : c.has("D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA")),
        // Instance 0 (bottom left) scaled to nothing, instance 99 (top right) full size.
        "scale-quads": c => c.drew && at(c, 40, 570, background) && at(c, 760, 30, p => !background(p)),
        "planet": c => c.drew && at(c, 420, 300, land) && at(c, 40, 30, background),
        "asteroids": c => c.drew && at(c, 420, 300, land) && c.countPixels(rock) > 40,
    }],
    ["anti-aliasing", {
        // Vulkan: how many samples the device can do – code only.
        "sample-count": c => c.drew && c.has("getMaxUsableSampleCount \\( \\)") && c.has("msaaSamples"),
        "msaa": c => smooth(c) && at(c, 400, 300, p => p[1] > 0.95 && p[0] < 0.05) && (c.api === "opengl" ? c.has("glfwWindowHint \\( GLFW_SAMPLES , 4 \\)") : c.api === "vulkan" ? c.has("rasterizationSamples = msaaSamples") && c.has("pResolveAttachments") : c.has("SampleDesc\\.Count = (?:4|SampleCount)") && c.has("ResolveSubresource \\(")),
        "offscreen-msaa": c => smooth(c) && c.has("glTexImage2DMultisample \\(") && c.has("glRenderbufferStorageMultisample \\("),
        "resolve": c => smooth(c) && at(c, 400, 300, p => p[1] > 0.95 && p[0] < 0.05) && (c.api === "opengl" ? c.has("glBlitFramebuffer \\(") && c.has("intermediateFBO") : c.api === "vulkan" ? c.has("createOffscreenRenderPass \\( \\)") && c.hasInShaders("screenTexture") : c.has("ResolveSubresource \\( m_screenTexture")),
        // learnopengl's grayscale: the green 0.7152 grey, the edges still smooth.
        "post-process": c => smooth(c) && at(c, 400, 300, p => grey(p) && Math.abs(p[0] - 0.714) < 0.03),
    }],
  ];
}
