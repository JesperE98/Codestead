# Project: The glass pavilion – milestones (DirectX 12)

The optional project after *Advanced OpenGL*. The start is the *Framebuffers* chapter's solution unchanged (off-screen
render target, screen quad, the edge-detection kernel in `framebuffers_screen.hlsl`), plus `skybox/`, `window.png` and
three shader files with a TODO: `skybox.hlsl` (the shaders compile but draw nothing useful), `columns.hlsl` (a vertex
shader only) and `outline.hlsl`. Checks as OpenGL's (`Checks/TaskChecks.Project.AdvancedOpenGL.ts`); the picture is
the same. Every state compiles with MinGW and the DirectX headers, the HLSL with glslangValidator (it cannot run here).

## `vignette`
- **When done:** `framebuffers_screen.hlsl`'s pixel shader multiplies the sample by
  `1.0f - smoothstep(0.4f, 0.7f, length(input.texCoord - float2(0.5f, 0.5f)))`.

## `sky`
- **When done:** `<vector>`, `m_skyboxPipelineState`, `m_skyboxTexture`, `LoadCubemap` (from *Cubemaps*) into slot 4
  of a 5-descriptor heap, the static sampler `s1` (CLAMP), the 36 sky vertices at 48..83, the sky's pipeline state
  (`skybox.hlsl`, `DepthWriteMask` ZERO, `DepthFunc` LESS_EQUAL, both restored afterwards), and the sky drawn after the
  floor; `skybox.hlsl` with `pos.xyww` and the cube map's sample.

## `columns`
- **When done:** `columns.hlsl` with `uint instanceID : SV_InstanceID`; `m_columnPipelineState` (that vertex shader,
  the scene's pixel shader) created after the scene's; `DrawInstanced(36, 5, 0, 0)` with the marble before the sky.

## `outline`
- **When done:** `DXGI_FORMAT_D24_UNORM_S8_UINT` for the pipeline states, the DSV, its clear value and the resource;
  `D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL` and `OMSetStencilRef(1)`; `m_selectedPipelineState` (stencil on,
  ALWAYS, REPLACE, write mask 0xFF) for cube 0 only; `m_outlinePipelineState` (`outline.hlsl`, NOT_EQUAL, write mask
  0x00, no depth test) after the sky with the cube scaled 1.1; the description restored (scene shaders, depth on,
  stencil off) for the later pipeline states.

## `glass`
- **When done:** `m_glassTexture` in slot 5 (6 descriptors), the glass quad's vertices at 84..89 (v = 0 at the top),
  `m_glassPipelineState` (BlendEnable, SRC_ALPHA / INV_SRC_ALPHA, ADD; the blend description reset afterwards), drawn
  last in the off-screen pass at `XMMatrixTranslation(0.3f, 0.0f, -0.2f)`.
