import { given, type CheckContext } from "../CheckContext.js";
import { perApi, type Checks } from "./TaskChecks.PerApi.js";

// Textures: loading an image, the texture objects of each API, texture coordinates, sampling, two textures, exercises.
// The picture checks use points of the 800×600 window (relative), the same in every API: the rectangle covers
// x 0.25–0.75 and y 0.25–0.75.

export function near(c: CheckContext, x: number, y: number, r: number, g: number, b: number, tolerance = 0.06): boolean {
  return given(c.pixel(x, y), (p) => Math.abs(p[0] - r / 255.0) <= tolerance && Math.abs(p[1] - g / 255.0) <= tolerance && Math.abs(p[2] - b / 255.0) <= tolerance);
}

export function reddish(c: CheckContext, x: number, y: number): boolean {
  return given(c.pixel(x, y), (p) => p[0] - p[1] > 0.15 && p[0] - p[2] > 0.15);
}

/** The crate, upright: a plank at (260, 200) and the dark brace near the top-right corner at (560, 190). */

export function crate(c: CheckContext): boolean {
  return near(c, 0.325, 0.333, 146, 96, 52) && near(c, 0.7, 0.3167, 92, 58, 28, 0.08);
}

export function textures(): Checks {
  return {
    "load-image": c => c.built && c.has("stbi_load \\( \"(?:textures/)?container\\.png\"") && c.has("stbi_image_free"),
    // OpenGL
    "create-texture": c => c.built && c.has("glGenTextures \\( 1 , & texture1 \\)") && c.has("GL_TEXTURE_WRAP_S") && c.has("GL_TEXTURE_MIN_FILTER"),
    "upload": perApi({
        opengl: c => c.built && c.has("glTexImage2D \\( GL_TEXTURE_2D") && c.has("glGenerateMipmap"),
        d3d12: c => c.built && c.has("GetRequiredIntermediateSize \\(") && c.has("UpdateSubresources \\(") && c.has("D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE")}),
    // DirectX 12
    "texture": c => c.built && c.has("CD3DX12_RESOURCE_DESC :: Tex2D \\(|D3D12_RESOURCE_DIMENSION_TEXTURE2D") && c.has("m_texture1"),
    "srv": c => c.built && c.has("CreateShaderResourceView \\(") && c.has("D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE"),
    "root-signature": c => c.built && c.has("D3D12_DESCRIPTOR_RANGE_TYPE_SRV") && c.has("D3D12_STATIC_SAMPLER_DESC") && c.has("SetGraphicsRootDescriptorTable \\("),
    "second-texture": c => c.built && c.has("stbi_load \\( \"awesomeface\\.png\"") && c.has("m_texture2"),
    "mix-keys": c => c.built && c.has("VK_UP") && c.has("VK_DOWN"),
    // Vulkan
    "staging-buffer": c => c.built && c.has("VK_BUFFER_USAGE_TRANSFER_SRC_BIT") && c.has("memcpy \\( data , pixels"),
    "texture-image": c => c.built && c.has("vkCreateImage \\(") && c.has("VK_IMAGE_USAGE_SAMPLED_BIT"),
    "layout-transitions": c => c.built && c.has("vkCmdPipelineBarrier") && c.has("vkCmdCopyBufferToImage") && c.has("VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL"),
    "image-view": c => c.built && c.has("textureImageView = createImageView \\("),
    "sampler": c => c.built && c.has("vkCreateSampler \\(") && c.has("vkDestroySampler \\("),
    "descriptor-layout": c => c.built && c.has("VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER") && c.has("vkCreateDescriptorSetLayout \\(") && c.has("setLayoutCount = 1"),
    "descriptor-set": c => c.built && c.has("vkCreateDescriptorPool \\(") && c.has("vkAllocateDescriptorSets \\(") && c.has("vkUpdateDescriptorSets \\(") && c.has("vkCmdBindDescriptorSets \\("),
    // Every API
    "texture-coords": c => c.built && c.hasInShaders("(?i)(in vec2 \\w*tex\\w*|: ?TEXCOORD)"),
    "sample": crate,
    // Tinted by the corner colours: red top right, blue bottom left.
    "tint": c => given(c.pixel(0.7375, 0.267), (tr) => tr[0] > 0.3 && tr[1] < 0.12 && tr[2] < 0.12
        && given(c.pixel(0.2625, 0.733), (bl) => bl[2] > bl[0] + 0.05 && bl[2] > bl[1] + 0.05)),
    // The face on top of the crate (20 %), its heart on the right.
    "texture-units": c => reddish(c, 0.611, 0.538) && near(c, 0.389, 0.538, 168, 120, 50, 0.08),
    "flip-face": c => reddish(c, 0.389, 0.538) && near(c, 0.611, 0.538, 168, 120, 50, 0.08),
    // Coordinates up to 2: the face four times (the top-right copy's heart), the crate small in the bottom-left quarter.
    "repeat": c => reddish(c, 0.569, 0.395) && c.drawnAt(0.2875, 0.5417),
    // Half crate, half face: the face is bright, the rest half as bright.
    "mix-value": c => given(c.pixel(0.375, 0.3), (face) => face[1] > 0.45 && given(c.pixel(0.744, 0.258), (dark) => dark[0] < 0.28
        && c.hasInShaders("(?:mix|lerp) \\([^;]*, [A-Za-z_][\\w.]* \\)"))),
  };
}
