import { type Checks } from "./TaskChecks.PerApi.js";

// Transformations: a transform matrix in the vertex shader; the container spinning in the bottom right; orbiting;
// a second container. Checked at time 1 s (the window centre is (0.5, 0.5); NDC (0.5, -0.5) is (0.75, 0.75)).

export function transformations(): Checks {
  return {
    // Rotated 90° and scaled by 0.5: the rectangle's corners are empty now, its middle drawn.
    "transform-uniform": c => c.drawnAt(0.5, 0.5) && c.isClear(0.3, 0.3) && c.hasInShaders("(?i)transform"),
    // translate(0.5, -0.5) * rotate(time): centred in the bottom-right quarter.
    "translate-rotate": c => c.drawnAt(0.75, 0.75) && c.isClear(0.845, 0.4245) && c.isClear(0.25, 0.25),
    // rotate(time) * translate(0.5, -0.5): it orbits; at 1 s its centre is at (0.845, 0.4245).
    "rotate-first": c => c.drawnAt(0.845, 0.4245) && c.isClear(0.75, 0.75),
    // A second container in the top-left quarter, scaled by sin(time).
    "second-container": c => c.drawnAt(0.25, 0.25) && c.scene!.draws.length >= 2,
  };
}

export function coordinateSystems(): Checks {
  return {
    // Vulkan: the uniform buffer for view and projection, its descriptor, the depth image.
    "uniform-buffer": c => c.built && c.has("VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT") && c.has("vkMapMemory \\(") && c.has("updateUniformBuffer \\("),
    "uniform-descriptor": c => c.built && c.has("VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER") && c.has("pBufferInfo = &"),
    // DirectX 12: the constant buffer view for view and projection.
    "constant-buffer": c => c.built && c.has("CreateConstantBufferView \\(") && c.has("SceneConstantBuffer"),
    "view-projection": c => c.built && c.has("(?i)PerspectiveFov") && c.has("memcpy \\("),
    "depth-image": c => c.built && c.has("createDepthResources \\( \\) ;") && c.has("VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT"),
    // Tilted back 55°: its near (bottom) edge reaches y 0.63, its far (top) edge only y 0.4 – (0.5, 0.33) is empty.
    "plane": c => c.drawnAt(0.5, 0.5) && c.isClear(0.5, 0.33) && c.isClear(0.1, 0.5) && c.has("(?i)perspective"),
    "cube": c => c.drew && c.scene!.draws.some((d) => d.count === 36),
    "spin": c => c.drew && c.scene!.animated && c.scene!.draws.some((d) => d.count === 36),
    "depth-test": c => c.drew && c.scene!.draws.some((d) => d.depthTest),
    "ten-cubes": c => c.drew && c.scene!.draws.filter((d) => d.count === 36).length >= 10,
    "rotate-every-third": c => c.drew && c.has("% 3 == 0") && c.scene!.draws.filter((d) => d.count === 36).length >= 10,
  };
}

export function camera(): Checks {
  return {
    "look-at": c => c.drew && c.has("(?i)lookAt"),
    "circle": c => c.drew && c.has("(?i)radius") && c.has("\\bsin \\(") && c.has("\\bcos \\("),
    "free-camera": c => c.drew && c.has("cameraPos") && c.has("cameraFront") && c.has("cameraUp"),
    "wasd": c => c.built && c.has("deltaTime") && c.has("(?:GLFW_KEY_W|'W')"),
    "mouse-look": c => c.built && c.has("(?i)\\byaw\\b") && c.has("(?i)\\bpitch\\b") && c.has("(?i)firstMouse"),
    "zoom": c => c.drew && c.has("(?i)\\bfov\\b") && c.has("(?i)scroll|WM_MOUSEWHEEL"),
  };
}
