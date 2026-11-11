# OIT: Introduction

This chapter starts a new part: *Guest Articles*. Between 2020 and 2022 learnopengl.com published a series of articles
by guest authors on topics beyond its main course – order-independent transparency, skeletal animation, scene graphs and
frustum culling, cascaded shadow maps, tessellation, OpenGL's direct state access, compute shaders, physically based
bloom and area lights. Each article stands mostly on its own and builds on the parts you have done. Like everything
before, the techniques are not specific to one API: they are ways of organising passes, buffers and shaders, and they
work in OpenGL, Vulkan and DirectX 12 alike. Each chapter shows where {{api}} puts them – and where an article is about
OpenGL itself (*DSA*), it says what the explicit APIs do instead.

The first two chapters are about *order-independent transparency*, OIT for short. This one explains the problem and the
families of solutions; the next one, *Weighted Blended*, implements one of them. In the *Blending* chapter of the
*Advanced OpenGL* part you rendered semi-transparent windows and found that they only looked right when you sorted
them: first all opaque objects, then the transparent ones from the farthest to the nearest. That chapter called it
"don't break the order" and moved on. Here we look at why the order matters, why sorting is not always possible, and
what renderers do instead.

## Transparency and blending

A transparent surface lets part of the light from behind it through. In real time we model that with one number per
fragment, its *alpha*: the fraction of what is behind that the surface covers (its opacity). An alpha of 1 is opaque, 0
is invisible, 0.5 covers half. When a fragment with colour `Cs` and alpha `αs` lands on a pixel that already has the
colour `Cd`, blending computes

```text
C = Cs · αs + Cd · (1 − αs)
```

the familiar `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` – in Vulkan the factors `VK_BLEND_FACTOR_SRC_ALPHA` /
`VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, in DirectX 12 `D3D12_BLEND_SRC_ALPHA` / `D3D12_BLEND_INV_SRC_ALPHA`. This
operation is called the *over* operator: the new fragment is placed *over* what is there. It is exactly right for one
transparent layer over an opaque background. With several layers, it is right only if they arrive from back to front,
because `over` is not commutative: `A over B` is not `B over A`.

Take a green layer (0, 1, 0) and a blue layer (0, 0, 1), both with alpha 0.5, over black. Green first, then blue over
it:

```text
after green:  (0, 1, 0) · 0.5 + (0, 0, 0) · 0.5       = (0, 0.5,  0)
after blue:   (0, 0, 1) · 0.5 + (0, 0.5, 0) · 0.5     = (0, 0.25, 0.5)
```

Blue first, then green over it:

```text
after blue:   (0, 0, 1) · 0.5 + (0, 0, 0) · 0.5       = (0, 0,   0.5)
after green:  (0, 1, 0) · 0.5 + (0, 0, 0.5) · 0.5     = (0, 0.5, 0.25)
```

Two different colours. Whichever layer comes last dominates, which is what you expect from layers of tinted glass: the
nearest one is seen undiluted, the ones behind it through it. So the correct result is the one in which the farthest
layer is blended first and the nearest last.

```quiz
A green layer and a blue layer, both with alpha 0.5, are blended over black with the over operator. The blue layer is nearer to the camera. Which order gives the correct colour, and what is it?
- [ ] Either order: blending adds the colours up, so the result is (0, 0.5, 0.5) both ways
- [ ] Blue first, then green: (0, 0.5, 0.25)
- [x] Green first, then blue: (0, 0.25, 0.5) – the farther layer first, the nearer one over it
- [ ] Green first, then blue: (0, 0.5, 0.25)
---
The over operator weighs the new fragment by its alpha and what is already there by 1 − alpha, so the layer blended last counts most. For the right picture that must be the nearest layer – here the blue one.
```

There is a second problem that has nothing to do with the formula: the depth buffer. Transparent objects are drawn with
the depth test on, so that opaque objects in front of them hide them. If they also *write* their depth, a near
transparent fragment stops every fragment behind it from being drawn at all – the depth test rejects them before they
can be blended. The far object simply disappears behind the near one, as if the near one were opaque. Turning depth
writes off (`glDepthMask(GL_FALSE)`, `depthWriteEnable = VK_FALSE`, `D3D12_DEPTH_WRITE_MASK_ZERO`) avoids the holes, but
then the blending order is whatever the drawing order happens to be – still wrong, just less obviously.

## Sorting

The classic answer is the one from the *Blending* chapter: draw all opaque objects first, with depth writes on; then
sort the transparent objects by their distance to the camera and draw them from the farthest to the nearest. It works
well for many scenes and is what most engines still do for most of their transparent objects. But it has limits:

- **Sorting is per object, blending is per fragment.** You sort by one distance per object, usually its centre's. Two
  objects whose centres are in one order can have fragments in the other order: a long transparent pane next to a small
  one, a window seen at a grazing angle. The sorted order is right for most pixels and wrong for some.
- **Intersecting objects cannot be sorted.** If two transparent quads pass through each other, one is in front on one
  side of the intersection line and behind on the other. No order of the two objects is right everywhere.
- **Cyclic overlap.** Three objects can overlap like the blades of a fan: A in front of B, B in front of C, C in front of
  A. Again no order of whole objects is right – you would have to split them.
- **Objects that overlap themselves.** A single transparent mesh – a bottle, a tree's foliage, a cloud of particles in
  one draw call – has triangles in front of other triangles of the same mesh. Sorting objects doesn't sort those; you
  would have to sort the triangles every frame, and even that fails for intersecting triangles.
- **Cost.** Sorting is CPU work every frame, and it fights with other orders you want: by material or shader to save
  state changes, by front to back for the opaque pass to save shading work.

Sorting per fragment would be correct always – that is what the over operator needs – but the GPU rasterises triangles
in the order you submit them, and a fragment knows nothing about the other fragments that will land on its pixel. That
is the problem order-independent transparency solves: get the result of back-to-front blending (or something close to
it) whatever the order of the draw calls.

```quiz
Which of these scenes can NOT be made correct by sorting the transparent objects back to front by their centres?
- [ ] Three separate transparent quads at different distances that don't intersect
- [x] Two transparent quads that pass through each other
- [ ] A transparent quad in front of an opaque cube
- [ ] One transparent quad over the background
---
Where two objects intersect, each is in front of the other on one side of the intersection line, so no order of the whole objects is right for every pixel. You would have to split them, or blend per fragment – which is what OIT does.
```

## Order-independent transparency

The techniques fall into a few families. They differ in how exact they are, how much memory they need and how many
passes they take.

### Depth peeling

*Depth peeling* (Cass Everitt, NVIDIA, 2001) renders the transparent geometry several times. The first pass keeps, per
pixel, the nearest transparent fragment – an ordinary depth test. The second pass keeps the nearest fragment *behind*
the one the first pass found: it reads the first pass's depth and discards everything at or in front of it. Each further
pass peels off the next layer. The layers are then blended in order, back to front (or front to back with the
"under" operator). The result is exact, and it needs nothing but depth textures and ordinary blending. The price is one
pass over all transparent geometry per layer: a scene where up to eight surfaces overlap in some pixel needs eight passes
to be correct there. *Dual depth peeling* peels from the front and the back at once and halves the number of passes.

### A-buffers and per-pixel linked lists

An *A-buffer* (Loren Carpenter, 1984) keeps not one colour per pixel but a list of all fragments that land on it. On
GPUs that can write to arbitrary memory from a fragment shader – image load/store or shader storage buffers in OpenGL
4.2/4.3, storage buffers in Vulkan, unordered access views in DirectX 12 – this is done with *per-pixel linked lists*:
one pass stores every transparent fragment (colour, alpha, depth) in a large buffer, using an atomic counter to get a
free slot and an atomic exchange on a per-pixel "head" image to link it in front of the pixel's list. A second,
full-screen pass walks each pixel's list, sorts its fragments by depth and blends them back to front. The result is exact
for every pixel in a single geometry pass. The costs: memory whose size depends on how many fragments the scene produces
(unbounded in principle – you have to pick a size and decide what to do when it overflows), atomic operations, and a
per-pixel sort that gets slow when lists are long. Variants keep only the k nearest fragments per pixel (*k-buffers*)
to bound memory.

```quiz
What does a per-pixel linked list store, and what does the second pass do?
- [ ] One colour per pixel, blended in the order the fragments arrive; the second pass applies tone mapping
- [ ] The nearest transparent fragment of each pixel; the second pass peels the next layer
- [ ] A weighted sum of the colours of each pixel; the second pass divides by the sum of the weights
- [x] Every transparent fragment of each pixel with its depth; the second pass sorts each pixel's fragments by depth and blends them back to front
---
That makes it exact in one geometry pass, at the cost of memory that grows with the number of fragments and atomic operations to build the lists. The first answer is ordinary blending, the second depth peeling, the third weighted blended OIT.
```

### Weighted blended OIT

*Weighted blended order-independent transparency* (Morgan McGuire and Louis Bavoil, 2013) gives up exactness for speed
and simplicity. Instead of the over operator, which depends on the order, it uses operations that don't: sums and
products. In one pass over the transparent geometry it accumulates, per pixel, the sum of the transparent colours, each
weighted by its alpha and by a weight that favours fragments near the camera, and the product of the `(1 − α)` of all
fragments – how much of the background still shows through. Addition and multiplication are commutative, so the order of
the draw calls no longer matters. A final full-screen pass divides the weighted sum by the sum of the weights to get an
average colour and blends it over the opaque picture with the coverage it computed.

The result is not exactly what sorted blending gives: where several layers overlap, it shows a weighted average where
sorted blending would show the nearest layer more strongly. For particles, smoke, glass and foliage that is usually
hard to notice, and the technique needs only two extra render targets, a fixed amount of memory and no sorting at all.
It runs on any GPU that can blend into several render targets with different blend functions – which is why learnopengl
picked it, and why it is the next chapter.

### Moments and other approximations

Later methods refine the idea of approximating the per-pixel transmittance – how the visibility of the background falls
off with depth – instead of storing every fragment. *Moment-based OIT* (Münstermann, Krumpen, Klein and Peters, 2018)
stores a few statistical moments of the fragments' depths per pixel in a first pass and reconstructs the transmittance
at any depth from them in a second; *stochastic transparency* replaces alpha with a random coverage mask and lets
multisampling average it. They sit between the exact methods and weighted blending in quality and cost.

| Technique | Exact? | Geometry passes | Memory |
|---|---|---|---|
| Sorting per object | where objects don't intersect or overlap themselves | 1 | none extra |
| Depth peeling | yes | one per layer | a few screen-sized textures |
| Per-pixel linked lists | yes (until the buffer overflows) | 1 + a resolve pass | grows with the fragments |
| Weighted blended OIT | approximation | 1 + a composite pass | two screen-sized textures |
| Moment-based OIT | approximation (better) | 2 + a resolve pass | a few screen-sized textures |

```quiz
Why is weighted blended OIT independent of the order in which the transparent objects are drawn?
- [ ] Because it sorts the fragments in the fragment shader
- [ ] Because it renders one pass per layer, from the nearest to the farthest
- [ ] Because it turns the depth test off
- [x] Because it only adds up weighted colours and multiplies transmittances – operations whose result doesn't depend on the order – and turns the sum into an average colour at the end
---
That is also why it is an approximation: an average of the layers is not what the order-dependent over operator gives, which lets the nearest layer dominate.
```

Real renderers mix these: they sort what can be sorted, use weighted blending or a variant for particles and other
volumes of small transparent pieces, and keep an exact method for the few cases where it matters.

## The project

The project shows the problem: the start of the next chapter, with no tasks yet. Three 2 × 2 quads face the camera,
which is at (0, 0, 5) looking down -z:

- a **red** opaque quad at (0.5, -0.2, 1.0);
- a **green** quad with alpha 0.5 at (-0.3, -0.6, 2.0) – the nearest;
- a **blue** quad with alpha 0.5 at (-0.6, 0.5, 0.0) – the farthest, its lower right part behind the red quad.

learnopengl's demo for the next chapter puts all three in the middle, where they cover each other completely; the
course moves them apart so that every case shows – a transparent quad over the background, over the opaque quad, over
another transparent quad and behind the opaque quad. The program draws them in learnopengl's order: the red quad, then
the green one, then the blue one. For the two transparent quads that is near to far – the wrong order – and they are
blended the ordinary way, with depth writes on.

:::opengl
`main.cpp` asks for an OpenGL **4.2** core context, not the 3.3 of the rest of the course: the next chapter needs
`glBlendFunci` (a blend function per colour attachment, core since 4.0) and `layout (binding = N)` on samplers in GLSL
(4.2). Every shader starts with `#version 420 core`. The solid pass draws the red quad with `solid.vs` / `solid.fs`
(`uniform vec3 color`), then the program switches blending on and draws the green and blue quads with `transparent.vs` /
`transparent.fs`:

```cpp
        // ordinary alpha blending, in the order the objects happen to be drawn (not sorted by distance):
        // the green quad is drawn first although it is the nearest
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

`transparent.fs` just outputs the colour with its alpha (`frag = color;`). Each draw sets learnopengl's two uniforms,
`mvp` and `color`. The files `composite.vs` / `.fs` and `screen.vs` / `.fs` are there already for the next chapter;
`composite.fs`'s `main` is still a TODO.
:::
:::vulkan
In Vulkan the blend function is part of the pipeline. The project's helper `createPipeline(…)` takes the depth test,
depth writes, whether to blend and the blend factors of up to two colour attachments, and the transparent pipeline is
made with ordinary alpha blending and depth writes on:

```cpp
        // transparent objects: ordinary alpha blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA), depth test with depth writes
        createPipeline("shaders/transparent.vert.spv", "shaders/transparent.frag.spv", renderPass, 1, VK_TRUE, VK_TRUE, VK_TRUE,
            VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, transparentPipeline);
```

Everything is drawn into the window's render pass. learnopengl's two uniforms `mvp` and `color` are push constants
(`struct PushConstants { glm::mat4 mvp; glm::vec4 color; }`), and `transparent.frag` outputs `pc.color` as it is. The
shaders `composite.vert` / `.frag` and `screen.vert` / `.frag` are there already for the next chapter; `composite.frag`'s
`main` is still a TODO.
:::
:::d3d12
In DirectX 12 the blend function is part of the pipeline state. The project draws the red quad with
`m_solidPipelineState` and the green and blue quads with `m_transparentPipelineState`, which blends the ordinary way and
keeps the default depth state (test LESS, writes on):

```cpp
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
```

Everything is drawn straight into the back buffer with a depth buffer. learnopengl's two uniforms `mvp` and `color` are
root constants (`struct ObjectConstants { XMFLOAT4X4 mvp; XMFLOAT4 color; }`), and `transparent.hlsl`'s `PSMain` returns
`color` as it is. `composite.hlsl` and `screen.hlsl` are there already for the next chapter; `composite.hlsl`'s `PSMain`
is still a TODO.
:::

This chapter has no tasks. Press **Build & run** (Ctrl+Enter): the project is compiled and run in the built-in
simulator. On black you see the red quad on the right, the half-transparent green quad at the bottom left in front of
it, and the half-transparent blue quad at the top left, partly hidden behind the red quad. Where the green quad lies over
the red one, both mix to an olive colour – correct, because the red quad is opaque and was drawn first. But look at the
blue quad's lower left corner: where the green quad covers it (around the pixel (230, 300)), the blue quad is simply
missing. Its corner is cut off along the green quad's top edge, and the pixel there is pure dark green (0, 128, 0) – green
over black.

```quiz
Why is the blue quad missing where the green quad covers it?
- [ ] The over operator gives zero for a blue layer behind a green one
- [x] The green quad was drawn first and wrote its depth; the blue quad behind it fails the depth test there and is never blended
- [ ] The blue quad is behind the red quad there
- [ ] The blue quad's alpha is too small to be seen through the green quad
---
Depth writes on a transparent object make it hide what is behind it, as if it were opaque. With depth writes off, the blue quad would be blended over the green one – the wrong order, giving a bluish (0, 64, 128) instead of the correct (0, 128, 64), since the green quad is nearer.
```

The next chapter replaces the transparent pass with weighted blended OIT. The opaque quad keeps its ordinary pass, the
transparent quads go into two extra render targets, and a composite pass puts them together – after which the picture is
the same whatever order the two transparent quads are drawn in.

## Additional resources

- [OIT: Introduction](https://learnopengl.com/Guest-Articles/2020/OIT/Introduction): learnopengl's guest article this
  chapter follows.
- [Blending](https://learnopengl.com/Advanced-OpenGL/Blending): learnopengl's chapter on blending and sorting, which
  the *Blending* chapter of the course follows.

:::opengl
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): the blend factors and the
  equation they form.
:::
:::vulkan
- [Color blending (Fixed functions)](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  vulkan-tutorial on the pipeline's colour blend state.
:::
:::d3d12
- [D3D12_BLEND_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_blend_desc): the pipeline
  state's blend description.
:::
