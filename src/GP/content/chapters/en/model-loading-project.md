# Project: The hall of worlds

The city museum is opening a new hall on Friday: *Worlds Beyond*. The posters are printed, the champagne is cold, and
the curator has just found out that the budget covered exactly **one** planet model – the `planet.obj` you loaded in
this part. "One planet for a whole hall? That's a cupboard, not an exhibition," she sighs. Then she has an idea: "In a
museum, nobody counts the files. They count the exhibits. Can you make it look like a collection?"

You can. A model is loaded once, and then you can draw it as often as you like, each time with a model matrix of its
own. Everything you need you learned in *Model Loading* and the parts before it – the challenge is putting it together
yourself. You continue in your program from the *Model* chapter: the lit planet with its ring.

## The assignment

1. **Make room.** The camera stands so close that the planet fills the view. Step back so that the planet in the middle
   looks about half as large – six units in front of it is good.
2. **Fill the hall.** Put two more exhibits on either side of the first one, at the same height, about 2.2 units to the
   left and to the right. Both are smaller (around 0.4 of the model's size) and each stands in its own way: the left
   one with its ring turned more towards the visitors, the right one leaning to the side.
3. **The turntable.** The exhibit in the middle stands on a turntable: let it turn slowly about the vertical axis, for
   example half a radian per second, so the visitors see it from every side. The other two stand still.
4. **The shelf of small worlds.** Higher up at the back of the hall there is a long shelf: a row of five small planets
   (about 0.2 of the model's size), two units apart, 1.5 units higher than the exhibits and 3 units further back. Draw
   them with a loop, and give each one a little more tilt than the one before.
5. **The bronze cast.** The left exhibit is not a planet at all but a bronze cast of one. Draw it in bronze: its lit
   colour multiplied by a warm bronze tint such as (1.0, 0.6, 0.25). The other planets keep their own colours.

The milestones in the list next to this text are checked automatically when you press **Check my code**: the checks
look at the picture your program draws, so other sizes, positions and angles close to the ones above pass too.

## Tips along the way

- One model, many exhibits: you never load `planet.obj` a second time. Each exhibit is one more draw of the same model,
  with its own model matrix set before it.
:::opengl
- In the render loop, set a new `model` matrix with `ourShader.setMat4("model", ...)` before each `ourModel.Draw(ourShader)`.
:::
:::vulkan
- In `recordCommandBuffer`, push the new matrix with `vkCmdPushConstants` before each `vkCmdDrawIndexed` – all the
  draws use the same vertex and index buffers.
:::
:::d3d12
- In `PopulateCommandList`, store the new matrix (and its normal matrix) in `modelConstants`, set the root constants
  again with `SetGraphicsRoot32BitConstants` and call `m_model.Draw` once more.
:::
- The order of the transformations matters. A turntable turns the whole exhibit about the hall's vertical axis, not
  about the planet's own tilted axis.
:::opengl vulkan
  In the chain translate, rotate, scale, the rotation by the time comes right after the translation – before the tilt.
:::
:::d3d12
  DirectXMath applies the matrices from left to right: the rotation by the time comes after the tilt, just before the
  translation.
:::
- The time is the one that made the container turn in *Transformations*:
:::opengl vulkan
  `glfwGetTime()`.
:::
:::d3d12
  the seconds since the first frame, measured with `std::chrono`.
:::
- The tint is a value per draw, like the model matrix: white (1, 1, 1) for the planets, bronze for the cast. The
  shader multiplies the colour it has computed by it.
:::opengl
  A uniform keeps its value until you set it again – and one you never set is 0, which paints everything black.
:::
:::vulkan
  It fits in the push constants next to the model matrix. The fragment shader now reads them too: the push constant
  range and `vkCmdPushConstants` need the fragment stage as well. Compile the shaders again after changing them.
:::
:::d3d12
  It fits in the root constants next to the matrices. The pixel shader now reads them too: give root parameter 0 the
  visibility of every stage.
:::

## Want to do more?

Once the milestones are done, the hall is yours. Give the visitors a mouse-free tour: let the camera glide slowly from
one exhibit to the next. Put a small moon in orbit around the turntable planet. Light the hall like a museum – a warm
light from above – or cast a second exhibit in silver. And if you have another model file, give it a place of honour:
the curator will never know it wasn't in the budget.
