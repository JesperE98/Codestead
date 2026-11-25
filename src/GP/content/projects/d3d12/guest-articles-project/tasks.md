# Project: The museum's orrery – milestones (DirectX 12)

As the OpenGL project (`../../opengl/guest-articles-project/tasks.md`): the same start (`frustum-culling`'s
solution), the same milestones, times (2.0 s; the counter also at 5.0 s), places and checks
(`ts/packages/gp-course/src/Checks/TaskChecks.Project.GuestArticles.ts`).

**DirectX 12's spelling of the solution:**
- DirectXMath: `XMFLOAT3` for positions and scales, `XMConvertToRadians`, `cosf` / `sinf`; the root is the member
  `m_ourEntity`, built in LoadAssets; the scene graph is updated in `OnUpdate`, where `time` (the seconds since the
  start) drives the orbits and Bramble's turning (the start's line turning the root goes, `time` stays).
- The title: `L"Orrery - drawn: " + std::to_wstring(display) + L", culled: " + std::to_wstring(total - display)` with
  `SetWindowTextW`.
- verify.sh compiles it (MinGW, DirectX-Headers; HLSL with glslangValidator); it cannot run without Windows.
