# Project: The hall of worlds – milestones (DirectX 12)

The optional project after *Model Loading* (`chapters/<lang>/model-loading-project.md`). The start is the *Model*
chapter's solution unchanged (`main.cpp`, `model_loading.hlsl` and `models/` with `planet.obj`): the lit planet with its
ring, camera at (0, 0, 3), drawn with `m_model.Draw` after the model and normal matrices are set as root constants. The
milestones draw the same `Model` several times with matrices of their own; the checks
(`Checks/TaskChecks.Project.ModelLoading.ts`, the same for every API) look at the picture only.

The finished picture (simulator): the same as OpenGL's – the turning planet in the middle, the bronze exhibit on the
left, the leaning one on the right, the shelf of five small planets at the top.

## `make-room`
- **When done:** `XMVECTOR cameraPos = XMVectorSet(0.0f, 0.0f, 6.0f, 0.0f);`.

## `exhibits`
- **When done:** after `m_model.Draw(m_commandList.Get());`, twice: `model = XMMatrixScaling(0.4f, …)` times the tilt
  (left: 50° about x; right: 15° about x, then -20° about z) times `XMMatrixTranslation(∓2.2f, 0.0f, 0.0f)`, the model
  matrix stored transposed, the normal matrix as `XMMatrixInverse(nullptr, model)` (transpose of the inverse, stored
  transposed), `SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0)` and `m_model.Draw`.

## `turntable`
- **When done:** before the middle exhibit's matrix, the time since the first frame (`static auto startTime`,
  `std::chrono::duration<float, std::chrono::seconds::period>`), and `* XMMatrixRotationY(time * 0.5f)` after the tilt,
  before the translation.

## `shelf`
- **When done:** before the barrier back to `PRESENT`, `for (UINT i = 0; i < 5; i++)` with `XMMatrixScaling(0.2f, …)`,
  `XMMatrixRotationAxis(x, 15° · i)`, `XMMatrixTranslation(-4.0f + 2.0f * i, 1.5f, -3.0f)`, the root constants and
  `m_model.Draw`.

## `bronze`
- **When done:** `ModelConstants` gets `XMFLOAT3 tint;` after the matrices (35 root constants); root parameter 0 is
  `InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL)`; the tint is white for the middle
  exhibit (set with its normal matrix), (1.0, 0.6, 0.25) for the left one and white again after its draw.
  `model_loading.hlsl`: `float3 tint;` after `normalMatrix` in `cbuffer ModelConstants`, and the pixel shader returns
  `float4(result * tint, 1.0f)`. Compiled with MinGW and the DirectX headers (it cannot run here).
