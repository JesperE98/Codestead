// Multiple lights, after the quiz about the lamps: the chapter's finished scene seen from further back and above,
// drawn by the simulator from the OpenGL solution with only the camera moved (the flashlight stays where the chapter's
// camera is, at (0, 0, 3), looking down −z). The badges mark the four lamps; the eye marks the chapter's camera.
// Language-free.
import { PAD, W, badge, svg } from "./style.mjs";
import { crop, eye } from "./_lighting.mjs";

export const variants = [{ out: "lamps-overview.webp", lang: "en" }];
export const lossy = true;

const PW = W - 2 * PAD, PH = PW * 0.75, TOP = 0.1, KEEP = 0.78; // the part of the render shown: 78 % of its height
export const height = PAD * 2 + PH * KEEP;

const CAM = [4.0, 3.0, 8.5], TARGET = [-0.9, -0.4, -4.0];
const lamps = [[0.7, 0.2, 2.0], [2.3, -3.3, -4.0], [-4.0, 2.0, -12.0], [0.0, 0.0, -3.0]];
const f3 = (a) => a.map((x) => `${x.toFixed(4)}f`).join(", ");
const sub = (a, b) => a.map((x, i) => x - b[i]);
const norm = (a) => a.map((x) => x / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotp = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const FRONT = norm(sub(TARGET, CAM));

export const renders = {
  scene: {
    api: "opengl",
    chapter: "multiple-lights",
    edits: [
      { file: "main.cpp", find: "glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);", replace: `glm::vec3 cameraPos   = glm::vec3(${f3(CAM)});` },
      { file: "main.cpp", find: "glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);", replace: `glm::vec3 cameraFront = glm::vec3(${f3(FRONT)});` },
      {
        file: "main.cpp",
        find: `        lightingShader.setVec3("spotLight.position", cameraPos);
        lightingShader.setVec3("spotLight.direction", cameraFront);`,
        replace: `        lightingShader.setVec3("spotLight.position", glm::vec3(0.0f, 0.0f, 3.0f));
        lightingShader.setVec3("spotLight.direction", glm::vec3(0.0f, 0.0f, -1.0f));`,
      },
    ],
    width: Math.round(PW * 2),
  },
};

/** Where a world point lands in the window (0..1 across, 0..1 down): glm::lookAt and glm::perspective(45°, 4/3). */
function project(p) {
  const f = FRONT, r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const d = sub(p, CAM);
  const x = dotp(d, r), y = dotp(d, u), z = dotp(d, f);
  const t = Math.tan((22.5 * Math.PI) / 180);
  return [0.5 + x / (z * t * (4 / 3)) / 2, 0.5 - y / (z * t) / 2];
}

export function draw(v, R) {
  const r = R.scene[0];
  let s = crop(r, 0, r.height * TOP, r.width, r.height * KEEP, PAD, PAD, PW, PH * KEEP);
  lamps.forEach((p, i) => {
    const [u, w] = project(p);
    s += badge(PAD + u * PW + 16, PAD + (w - TOP) * PH - 16, i + 1, { r: 12 });
  });
  // The chapter's camera.
  const [u, w] = project([0, 0, 3]);
  s += eye(PAD + u * PW, PAD + (w - TOP) * PH, 0, { size: 16 });
  return svg(height, s);
}
