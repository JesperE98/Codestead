# Project: Hedgerow goes to the fair – milestones (DirectX 12)

As the OpenGL project (`../../opengl/in-practice-project/tasks.md`): the same start (the finished Hedgerow of
`render-text` plus an empty `levels/five.lvl`), the same milestones, times (3.0 s, and 1.0 s for the fade), points
and checks (`ts/packages/gp-course/src/Checks/TaskChecks.Project.InPractice.ts`).

**DirectX 12's spelling of the solution:**
- DirectXMath types: `XMFLOAT4(rColor, rColor * 0.7f, rColor * 0.1f, 1.0f)`, `XMFLOAT3(1.0f, 0.4f, 0.6f)`, the
  sparkler's `XMFLOAT2(120.0f, 500.0f)` / `XMFLOAT2(0.0f, 1200.0f)`, the gift at `XMFLOAT2(370.0f, 300.0f)`.
- `fade-in`: `post_processing.hlsl` already has `time` in its constant buffer: `color.rgb *= saturate(time / 2.0f);`
  before PSMain's `return color;`.
- verify.sh compiles it (MinGW, DirectX-Headers; HLSL with glslangValidator); it cannot run without Windows.
