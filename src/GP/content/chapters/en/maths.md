# The maths of 3D

So far everything we have drawn has been flat and still: a triangle and a textured rectangle, with their corners
written straight into the vertex buffer as normalized device coordinates. In this part of the course we go 3D. In
*Transformations* we'll scale, rotate and move the container; in *Coordinate systems* we'll place it in a 3D world
and look at it through a perspective projection; and in *Camera* we'll fly through that world with the keyboard and
the mouse. All three chapters run on the same small toolbox of mathematics, and this chapter opens the toolbox before
we need it, so the next chapters can concentrate on the graphics.

Don't worry if your maths is rusty – we start from the beginning and every idea comes with numbers you can check by
hand. Here's what we'll go through, and where you'll meet it again:

| Maths | Used for |
|---|---|
| Axes and handedness | Which way x, y and z point – in every chapter from now on |
| Degrees and radians | Every rotation function, the field of view, the camera's angles |
| Sine and cosine | Rotation matrices, a camera circling the scene, yaw and pitch, animations over time |
| Vectors, the dot and cross product | Positions, directions, the camera's axes, and later all of the lighting |
| Matrices | Transformations, and the model, view and projection matrices |

Everything in this chapter is the same for all three APIs, and there is no code to write: the program from
*Textures* stays as it is. Instead there are questions along the way to check yourself. Keep pen and paper ready –
doing a few of the calculations by hand is the quickest way to get comfortable with them.

## Coordinates and axes

A position is just a list of numbers, one per *axis*. In 2D there are two axes, x and y, that cross at the *origin*
(0, 0); the point (3, 2) is 3 steps along x and 2 steps along y. The maths in this course uses the usual mathematical
directions: **x to the right and y up**. You have already used axes like these for the normalized device
coordinates in *Hello Triangle*: the window goes from −1 to 1 on both axes, with (0, 0) in its centre.
:::opengl d3d12
There, too, +x is to the right and +y is up.
:::
:::vulkan
One detail is different in Vulkan: its normalized device coordinates have +y pointing **down**, so a vertex with a
negative y ends up in the upper half of the window. From the next chapter on we do all the maths with y up, like
learnopengl, and flip y once at the very end – *Transformations* shows how.
:::

### Three axes

In 3D we need a third axis, z, at a right angle to both x and y. With x to the right and y up there are two ways it
can point: out of the screen towards you, or into the screen away from you. The two choices are called a
*right-handed* and a *left-handed* coordinate system, and they are mirror images of each other – you can't turn one
into the other by rotating it.

The names come from your hands. Hold up your right hand, point your thumb to the right (+x) and your index finger up
(+y), then bend your middle finger so it points straight out of your palm: it points towards you. That is +z in a
right-handed system. Do the same with your left hand and the middle finger points away from you, into the screen:
that is a left-handed system.

This course uses a **right-handed** system in every API, the convention of OpenGL and learnopengl: +x to the right,
+y up and +z out of the screen towards you. Things further away from you therefore have *smaller* (more negative) z
values, and a camera looks down the **negative** z axis – remember that, it comes back in *Coordinate systems* and
*Camera*.

:::opengl vulkan
GLM, the maths library you'll use from the next chapter on, is right-handed by default, so it matches this
convention without any settings.
:::
:::d3d12
DirectXMath, the maths library you'll use from the next chapter on, has both kinds of functions: `…RH` for
right-handed and `…LH` for left-handed (the classic DirectX convention). This course always picks the `…RH` ones, so
all of learnopengl's positions and rotations work unchanged.
:::

```quiz
In a right-handed coordinate system, +x points to the right and +y points up. Where does +z point?
- [ ] Into the screen, away from you
- [x] Out of the screen, towards you
- [ ] Down, opposite to +y
- [ ] It depends on the size of the window
---
Thumb right (+x), index finger up (+y): the middle finger of your right hand points out of the screen, towards you. Into the screen would be a left-handed system. The window's size has nothing to do with the direction of the axes.
```

![A right-handed and a left-handed coordinate system](images/handedness.webp "With x to the right and y up, +z points out of the screen in a right-handed system and into it in a left-handed one. This course uses the right-handed one in all three APIs.")

## Angles: degrees and radians

Rotations, a camera's field of view and the camera's direction are all given as *angles*. You probably know angles
in **degrees**, where a full turn is 360°: a quarter turn is 90°, half a turn 180°.

Computers prefer **radians**. Draw a circle with radius 1 around the origin and walk along its edge: the angle in
radians is simply the distance you have walked. The whole circumference of that circle is 2π ≈ 6.283, so a full
turn is 2π radians, half a turn π ≈ 3.142 and a quarter turn π/2 ≈ 1.571. One radian is a bit more than 57°.
Converting between the two is a matter of multiplying:

```text
angle in radians = angle in degrees · (π / 180)
angle in degrees = angle in radians · (180 / π)
```

So 45° is 45 · π / 180 = π/4 ≈ 0.785 radians, and 1 radian is 180 / π ≈ 57.3°.

Angles have a direction, too. In maths – and in this course – a **positive** angle turns **counter-clockwise**: from
+x towards +y, as you see it when you look at the xy plane with +z pointing at you. A negative angle turns
clockwise.

The sine and cosine functions of C++ (`std::sin`, `std::cos`) and of {{shaderLanguage}} (`sin`, `cos`) all expect
radians. People find degrees easier to read, so programs usually keep their angles in degrees and convert them just
before they use them.
:::opengl vulkan
With GLM that is `glm::radians(90.0f)`, which returns π/2.
:::
:::d3d12
With DirectXMath that is `XMConvertToRadians(90.0f)`, which returns π/2.
:::
Forgetting to convert is one of the classic bugs: an angle of 90 used as radians is about 14.3 full turns, which
ends up at a completely different place than the quarter turn you wanted.

```quiz
A program uses the time in seconds directly as an angle in radians, to rotate an object. How long does one full turn take?
- [ ] 1 second
- [ ] 360 seconds
- [x] About 6.28 seconds
- [ ] About 3.14 seconds
---
A full turn is 2π ≈ 6.28 radians, so it takes about 6.28 seconds when the angle grows by one radian per second. 360 seconds would be the answer if the time were used as degrees; 3.14 seconds is only half a turn.
```

## Sine and cosine: the unit circle

The *unit circle* is the circle with radius 1 around the origin. Start at the point (1, 0) on its right-hand side
and walk counter-clockwise along it by an angle θ (the Greek letter theta). The point where you end up has two
coordinates, and they have names: its x coordinate is the **cosine** of θ and its y coordinate is the **sine** of θ.

```text
point on the unit circle at angle θ = (cos θ, sin θ)
```

That's all sine and cosine are. With this picture in mind you can read off their values for the quarter turns
without a calculator:

| Angle | Radians | cos θ | sin θ | The point |
|---|---|---|---|---|
| 0° | 0 | 1 | 0 | (1, 0), right |
| 60° | π/3 ≈ 1.047 | 0.5 | ≈ 0.866 | up and to the right |
| 90° | π/2 ≈ 1.571 | 0 | 1 | (0, 1), top |
| 180° | π ≈ 3.142 | −1 | 0 | (−1, 0), left |
| 270° | 3π/2 ≈ 4.712 | 0 | −1 | (0, −1), bottom |
| 360° | 2π ≈ 6.283 | 1 | 0 | back at the start |

A few things follow straight from the circle:

- Both values always lie between −1 and 1, because the circle has radius 1.
- cos² θ + sin² θ = 1 for every angle: the point is at distance 1 from the origin, and that is Pythagoras' theorem,
  which we'll meet again in a minute for the length of a vector.
- Going round once more changes nothing: θ + 2π gives the same point as θ.
- Negative angles go clockwise: cos(−θ) = cos θ and sin(−θ) = −sin θ. For example −90° ends at the bottom, (0, −1).

For a circle with a radius r instead of 1, multiply both coordinates by r: the point is (r · cos θ, r · sin θ).

```quiz
A point starts at (1, 0) on the unit circle and turns by −90°. Where does it end up?
- [ ] (0, 1)
- [ ] (−1, 0)
- [ ] (1, 0)
- [x] (0, −1)
---
A negative angle turns clockwise, so a quarter turn from the right-hand side ends at the bottom: (cos(−90°), sin(−90°)) = (0, −1). (0, 1) is where +90° would end, (−1, 0) half a turn.
```

![The unit circle, and sine and cosine over a full turn](images/unit-circle.webp "Left: the point at angle θ on the unit circle is (cos θ, sin θ) – cos along x, sin along y. Right: sin t and cos t over one full turn, from 0 to 2π, with the same θ marked; both repeat after 2π.")

### Where sine and cosine show up

You'll meet these two functions all through this part of the course:

- **Animation over time.** If t is the time in seconds, sin t swings smoothly between −1 and 1 and repeats every
  2π ≈ 6.28 seconds. You already used that in *Shaders*: `sin(time) / 2.0 + 0.5` squeezes the swing into the range 0
  to 1, a usable colour value, and made the triangle pulse green.
- **Rotation matrices.** A rotation is built from the cosine and sine of its angle, as you'll see at the end of this
  chapter and in *Transformations*.
- **Moving in a circle.** In *Camera* the camera circles the scene with a radius r: its position is
  (r · sin t, r · cos t) in the xz plane – a point on a circle of radius r, at an angle that grows with the time.
- **Directions from angles.** Also in *Camera*, the direction the camera looks in is computed from two angles, yaw and
  pitch, with exactly the point-on-a-circle idea: cos for one coordinate, sin for the other.

```quiz
`sin(time) / 2.0 + 0.5` is used as a colour value while the program runs. Between which values does it swing?
- [x] Between 0 and 1
- [ ] Between −1 and 1
- [ ] Between 0 and 0.5
- [ ] Between −0.5 and 0.5
---
sin swings between −1 and 1. Divided by 2 that becomes −0.5 to 0.5, and adding 0.5 moves it to 0 to 1 – exactly the range of a colour channel.
```

## Vectors

In its most basic definition, vectors are *directions* and nothing more. A vector has a **direction** and a
**magnitude** (also known as its strength or length). You can think of vectors like directions on a treasure map:
"go left 10 steps, now go north 3 steps and go right 5 steps"; here "left" is the direction and "10 steps" is the
magnitude of the vector. The directions for the treasure map thus contain 3 vectors. Vectors can have any dimension,
but we usually work with dimensions of 2 to 4. If a vector has 2 dimensions it represents a direction on a plane
(think of 2D graphs) and when it has 3 dimensions it can represent any direction in a 3D world.

If you picture vectors in a 2D graph, each vector is an arrow; where the arrow starts doesn't matter, only its
direction and length. The vectors (2, 3) drawn from the origin and (2, 3) drawn from the point (4, 1) are the same
vector.

Mathematicians generally prefer to describe vectors as character symbols with a little bar over their head, like v̄.
Also, when displaying vectors in formulas they are generally displayed as a column of numbers:

```text
    | x |
v = | y |
    | z |
```

In running text we'll write the same vector as v = (x, y, z) to save space. Because vectors are specified as
directions it is sometimes hard to visualize them as positions. If we want to visualize vectors as positions we can
imagine the origin of the direction vector to be (0, 0, 0) and then point towards a certain direction that specifies
the point, making it a *position vector* (we could also specify a different origin and then say: "this vector
points to that point in space from this origin"). The position vector (3, 5) would then point to (3, 5) on the graph
with an origin of (0, 0). Using vectors we can thus describe directions **and** positions in 2D and 3D space.

Just like with normal numbers we can also define several operations on vectors (some of which you've already seen).

### Scalar vector operations

A *scalar* is a single number. When adding/subtracting/multiplying or dividing a vector with a scalar we simply add,
subtract, multiply or divide each element of the vector by the scalar. For addition it would look like this:

```text
| 1 |       | 1 + 3 |   | 4 |
| 2 | + 3 = | 2 + 3 | = | 5 |
| 3 |       | 3 + 3 |   | 6 |
```

where + can be +, −, · or ÷. Note that for the minus and division operators the reverse order (scalar − vector,
scalar ÷ vector) is not defined. Strictly speaking, adding a scalar to a vector isn't defined in mathematics either;
it is a common shorthand meaning "add the scalar to every element", and {{shaderLanguage}} supports it too.

### Vector negation

Negating a vector results in a vector in the reversed direction. A vector pointing north-east would point south-west
after negation. To negate a vector we add a minus sign to each component (you can also represent it as a
scalar-vector multiplication with a scalar value of −1):

```text
       | vx |   | −vx |
−v = − | vy | = | −vy |
       | vz |   | −vz |
```

### Addition and subtraction

Addition of two vectors is defined as *component-wise* addition, that is each component of one vector is added to
the same component of the other vector:

```text
    | 1 |       | 4 |           | 1 + 4 |   | 5 |
v = | 2 |,  k = | 5 |,  v + k = | 2 + 5 | = | 7 |
    | 3 |       | 6 |           | 3 + 6 |   | 9 |
```

Visually, you put the second arrow at the tip of the first one: the sum is the arrow from the start of the first to
the tip of the second. If v = (4, 2) and k = (1, 2), then v + k = (5, 4) – walk 4 right and 2 up, then 1 right and
2 up, and you end up 5 right and 4 up.

Just like normal addition and subtraction, vector subtraction is the same as addition with a negated second vector:

```text
    | 1 |       | 4 |                      | 1 − 4 |   | −3 |
v = | 2 |,  k = | 5 |,  v + (−k) = v − k = | 2 − 5 | = | −3 |
    | 3 |       | 6 |                      | 3 − 6 |   | −3 |
```

Subtracting two vectors from each other results in a vector that's the difference of the positions both vectors are
pointing at. This proves useful in certain cases where we need to retrieve a vector that's the difference between
two points: the vector from point p to point q is q − p.

### Length

To retrieve the length/magnitude of a vector we use the Pythagoras theorem that you may remember from your math
classes. A vector forms a triangle when you visualize its individual x and y component as two sides of a triangle,
and the vector itself is the hypotenuse. Since the length of the two sides (x, y) are known and we want to know the
length of the tilted side v, we can calculate it using the Pythagoras theorem as:

```text
||v|| = √(x² + y²)
```

where ||v|| is denoted as *the length of vector v*. This is easily extended to 3D by adding z² to the equation. For
v = (4, 2):

```text
||v|| = √(4² + 2²) = √(16 + 4) = √20 ≈ 4.47
```

There is also a special type of vector that we call a *unit vector*. A unit vector has one extra property and that is
that its length is exactly 1. We can calculate a unit vector n from any vector by dividing each of the vector's
components by its length:

```text
n = v / ||v||
```

We call this *normalizing* a vector. Unit vectors are displayed with a little roof over their head and are generally
easier to work with, especially when we only care about their directions (the direction does not change if we change
a vector's length). Normalizing v = (4, 2) gives about (0.894, 0.447): the same direction, length 1.

![Adding and subtracting vectors, and the length of a vector](images/vectors.webp "v + k: the second arrow starts at the tip of the first. q − p: the vector from the point p to the point q. The length of v = (4, 2): the hypotenuse of its components.")

### Vector-vector multiplication

Multiplying two vectors is a bit of a weird case. Normal multiplication isn't really defined on vectors since it has
no visual meaning, but we have two specific cases that we could choose from when multiplying: one is the *dot
product* denoted as v · k and the other is the *cross product* denoted as v × k.

#### Dot product

The dot product of two vectors is equal to the scalar product of their lengths times the cosine of the angle between
them. If this sounds confusing take a look at its formula:

```text
v · k = ||v|| · ||k|| · cos θ
```

where the angle between them is represented as theta (θ). Why is this interesting? Well, imagine if v and k are unit
vectors then their length would be equal to 1. This would effectively reduce the formula to:

```text
v · k = 1 · 1 · cos θ = cos θ
```

Now the dot product **only** defines the angle between both vectors. As we saw on the unit circle, cos θ is 1 when
the angle is 0, 0 when the angle is 90 degrees and −1 when it is 180 degrees. This allows us to easily test if the
two vectors are *orthogonal* or *parallel* to each other using the dot product (orthogonal means the vectors are at
a right angle to each other).

> You can also calculate the angle between two non-unit vectors, but then you'd have to divide the lengths of both
> vectors from the result to be left with cos θ.

So how do we calculate the dot product? The dot product is a component-wise multiplication where we add the results
together. It looks like this with two unit vectors (you can verify that both their lengths are exactly 1):

```text
|  0.6 |   | 0 |
| −0.8 | · | 1 | = (0.6 · 0) + (−0.8 · 1) + (0 · 0) = −0.8
|  0   |   | 0 |
```

To calculate the degree between both these unit vectors we use the inverse of the cosine function, cos⁻¹ (acos),
and this results in 143.1 degrees. We now effectively calculated the angle between these two vectors. Dot products
prove very useful when doing lighting calculations later on.

```quiz
The dot product of two unit vectors is 0. What does that tell you about them?
- [x] They are perpendicular to each other (at a 90° angle)
- [ ] They point in the same direction
- [ ] They point in opposite directions
- [ ] One of them must be the zero vector
---
For unit vectors the dot product is cos θ, and cos θ is 0 exactly at 90°. The same direction gives 1, opposite directions give −1. A zero vector can't be a unit vector: its length is 0.
```

#### Cross product

The cross product is only defined in 3D space and takes two non-parallel vectors as input and produces a third
vector that is orthogonal to both the input vectors. If both the input vectors are orthogonal to each other as well,
a cross product would result in 3 orthogonal vectors; this will prove useful in the upcoming chapters. The
following shows how to calculate the cross product of the vectors A and B:

```text
| Ax |   | Bx |   | Ay·Bz − Az·By |
| Ay | × | By | = | Az·Bx − Ax·Bz |
| Az |   | Bz |   | Ax·By − Ay·Bx |
```

As you can see, it doesn't really seem to make sense. However, if you just follow these steps you'll get another
vector that is orthogonal to your input vectors. Try it with the x axis and the y axis:

```text
| 1 |   | 0 |   | 0·0 − 0·1 |   | 0 |
| 0 | × | 1 | = | 0·0 − 1·0 | = | 0 |
| 0 |   | 0 |   | 1·1 − 0·0 |   | 1 |
```

The result is the z axis. The order matters: y × x gives (0, 0, −1), the z axis pointing the other way. That is the
right-hand rule from the beginning of this chapter: in a right-handed system, x × y = z.

![Dot product and cross product](images/dot-cross.webp "For unit vectors the dot product is cos θ: 1 in the same direction, 0 at a right angle, −1 in opposite directions. The cross product of x and y is z – and y × x is −z.")

## Matrices

Now that we've discussed almost all there is to vectors it is time to enter the matrix! A matrix is a rectangular
array of numbers, symbols and/or mathematical expressions. Each individual item in a matrix is called an *element*
of the matrix. An example of a 2×3 matrix is shown below:

```text
| 1  2  3 |
| 4  5  6 |
```

Matrices are indexed by (i, j) where i is the row and j is the column, that is why the above matrix is called a 2×3
matrix (3 columns and 2 rows, also known as the *dimensions* of the matrix). This is the opposite of what you're
used to when indexing 2D graphs as (x, y). To retrieve the value 4 we would index it as (2, 1) (second row, first
column).

Matrices are basically nothing more than that, just rectangular arrays of mathematical expressions. They do have a
very nice set of mathematical properties and just like vectors we can define several operations on matrices,
namely: addition, subtraction and multiplication.

### Addition and subtraction

Matrix addition and subtraction between two matrices is done on a per-element basis. So the same general rules apply
that we're familiar with for normal numbers, but done on the elements of both matrices with the same index. This
does mean that addition and subtraction is only defined for matrices of the same dimensions. A 3×2 matrix and a
2×3 matrix (or a 3×3 matrix and a 4×4 matrix) cannot be added or subtracted together. Let's see how matrix
addition works on two 2×2 matrices:

```text
| 1  2 |   | 5  6 |   | 1 + 5  2 + 6 |   |  6   8 |
| 3  4 | + | 7  8 | = | 3 + 7  4 + 8 | = | 10  12 |
```

The same rules apply for matrix subtraction:

```text
| 4  2 |   | 2  4 |   | 4 − 2  2 − 4 |   | 2  −2 |
| 1  6 | − | 0  1 | = | 1 − 0  6 − 1 | = | 1   5 |
```

### Matrix-scalar products

A matrix-scalar product multiplies each element of the matrix by a scalar. The following example illustrates the
multiplication:

```text
    | 1  2 |   | 2·1  2·2 |   | 2  4 |
2 · | 3  4 | = | 2·3  2·4 | = | 6  8 |
```

Now it also makes sense as to why those single numbers are called scalars. A scalar basically *scales* all the
elements of the matrix by its value. In the previous example, all elements were scaled by 2.

So far so good, all of our cases weren't really too complicated. That is, until we start on matrix-matrix
multiplication.

### Matrix-matrix multiplication

Multiplying matrices is not necessarily complex, but rather difficult to get comfortable with. Matrix multiplication
basically means to follow a set of pre-defined rules when multiplying. There are a few restrictions though:

1. You can only multiply two matrices if the number of columns on the left-hand side matrix is equal to the number
   of rows on the right-hand side matrix.
2. Matrix multiplication is not *commutative*, that is A · B ≠ B · A.

Let's get started with an example of a matrix multiplication of two 2×2 matrices:

```text
| 1  2 |   | 5  6 |   | 1·5 + 2·7   1·6 + 2·8 |   | 19  22 |
| 3  4 | · | 7  8 | = | 3·5 + 4·7   3·6 + 4·8 | = | 43  50 |
```

Right now you're probably trying to figure out what the hell just happened? Matrix multiplication is a combination of
normal multiplication and addition using the left-matrix's rows with the right-matrix's columns. To get the element
in row i and column j of the result, take row i of the left matrix and column j of the right matrix, multiply their
elements pair by pair and add the products up. For the top-right element above that is row 1 of the left matrix,
(1, 2), and column 2 of the right matrix, (6, 8): 1·6 + 2·8 = 22. In other words: every element of the result is the
dot product of a row of the left matrix and a column of the right matrix.

The resulting matrix has the dimensions of (n, m) where n is equal to the number of rows of the left-hand side
matrix and m is equal to the columns of the right-hand side matrix: a 2×3 matrix times a 3×4 matrix is a 2×4 matrix.

Now swap the two matrices:

```text
| 5  6 |   | 1  2 |   | 5·1 + 6·3   5·2 + 6·4 |   | 23  34 |
| 7  8 | · | 3  4 | = | 7·1 + 8·3   7·2 + 8·4 | = | 31  46 |
```

A completely different result – that is what "not commutative" means, and it will matter a lot when we combine
transformations. Don't worry if you have difficulties imagining the multiplications inside your head. Just keep
trying to do the calculations by hand and return to this page whenever you have difficulties. Over time, matrix
multiplication becomes second nature to you.

```quiz
A is a 2×3 matrix (2 rows, 3 columns) and B is a 3×4 matrix. Which statements are true?
- [ ] A · B is defined, and the result is a 3×3 matrix
- [ ] A · B and B · A are both defined, and they are equal
- [x] B · A is not defined, because B has 4 columns but A has only 2 rows
- [x] A · B is defined, and the result is a 2×4 matrix
---
The columns of the left matrix must match the rows of the right one: A has 3 columns and B has 3 rows, so A · B works and has A's rows and B's columns (2×4). For B · A, B's 4 columns don't match A's 2 rows. And even when both orders are defined, matrix multiplication is not commutative.
```

## Matrix-Vector multiplication

Up until now we've had our fair share of vectors. We used them to represent positions, colors and even texture
coordinates. Let's move a bit further down the rabbit hole and tell you that a vector is basically an N×1 matrix
where N is the vector's number of components (also known as an N-dimensional vector). If you think about it, it
makes a lot of sense. Vectors are just like matrices an array of numbers, but with only 1 column. So, how does this
new piece of information help us? Well, if we have an M×N matrix we can multiply this matrix with our N×1 vector,
since the columns of the matrix are equal to the number of rows of the vector, thus matrix multiplication is
defined.

But why do we care if we can multiply matrices with a vector? Well, it just so happens that there are lots of
interesting 2D/3D transformations we can place inside a matrix, and multiplying that matrix with a vector then
*transforms* that vector. In case you're still a bit confused, let's start with a few examples and you'll soon see
what we mean.

### Identity matrix

In graphics programming, and in this course, we usually work with 4×4 transformation matrices for several reasons,
and one of them is that most of the vectors are of size 4. The most simple transformation matrix that we can think
of is the *identity matrix*. The identity matrix is an N×N matrix with only 0s except on its diagonal. As you'll
see, this transformation matrix leaves a vector completely unharmed:

```text
| 1  0  0  0 |   | 1 |   | 1·1 |   | 1 |
| 0  1  0  0 |   | 2 |   | 1·2 |   | 2 |
| 0  0  1  0 | · | 3 | = | 1·3 | = | 3 |
| 0  0  0  1 |   | 4 |   | 1·4 |   | 4 |
```

The vector is completely untouched. This becomes obvious from the rules of multiplication: the first result element
is each individual element of the first row of the matrix multiplied with each element of the vector. Since each of
the row's elements are 0 except the first one, we get: 1·1 + 0·2 + 0·3 + 0·4 = 1, and the same applies for the other
3 elements of the vector.

> You may be wondering what the use is of a transformation matrix that does not transform? The identity matrix is
> usually a starting point for generating other transformation matrices, and if we dig even deeper into linear
> algebra, a very useful matrix for proving theorems and solving linear equations.

### A matrix's columns

There is a simple way to see what any matrix does to a vector, and it is worth knowing before you meet the
transformation matrices. Take a 2×2 matrix and multiply it with the two *unit vectors* along the axes, (1, 0) and
(0, 1):

```text
| a  b |   | 1 |   | a |        | a  b |   | 0 |   | b |
| c  d | · | 0 | = | c |        | c  d | · | 1 | = | d |
```

The x axis lands on the matrix's first column and the y axis on its second. Any other vector is made of these two –
(x, y) is x times (1, 0) plus y times (0, 1) – so it lands on x times the first column plus y times the second. In
other words: **the columns of a matrix are where it sends the axes**, and that decides where every other vector
goes. The same holds in 3D and 4D, with one column per axis. The identity matrix leaves every axis where it is, which
is why it changes nothing.

Let's use that to build a matrix ourselves: one that turns everything a quarter turn (90°) counter-clockwise. Such a
turn sends the x axis (1, 0) up to (0, 1), and the y axis (0, 1) to the left, (−1, 0). Those are the two columns:

```text
| 0  −1 |   | 2 |   | 0·2 + (−1)·1 |   | −1 |
| 1   0 | · | 1 | = | 1·2 +   0·1  | = |  2 |
```

The vector (2, 1), two steps right and one up, becomes (−1, 2): one step left and two up – the same arrow, turned a
quarter turn.

### Rotating by any angle

Now for any angle θ. Rotating the x axis (1, 0) by θ is exactly the walk along the unit circle from the previous
section: it ends at (cos θ, sin θ). The y axis starts a quarter turn further on, so it ends at the point a quarter
turn further on, which is (−sin θ, cos θ). Put them in as the columns, and you have the matrix that rotates any 2D
vector by θ:

```text
| cos θ  −sin θ |
| sin θ   cos θ |
```

Check it with θ = 90°: cos 90° = 0 and sin 90° = 1 give exactly the quarter-turn matrix above. This is the heart of
every rotation matrix you'll use. In *Transformations* you'll meet it again in its 3D form, where a rotation also
needs an axis to turn around: rotating around the z axis is this very matrix, with z left as it is.

```quiz
A 2×2 matrix sends the x axis (1, 0) to (0, 1) and the y axis (0, 1) to (−1, 0). What does it do with the vector (3, 0)?
- [x] It turns it into (0, 3)
- [ ] It leaves it as (3, 0)
- [ ] It turns it into (−3, 0)
- [ ] It turns it into (0, −3)
---
(3, 0) is 3 times the x axis, so it lands on 3 times the first column: 3 · (0, 1) = (0, 3). The matrix is the quarter turn counter-clockwise: the arrow that pointed right now points up.
```

![A rotation matrix's columns](images/rotation-columns.webp "Left: a rotation by θ sends the x axis to (cos θ, sin θ) and the y axis to (−sin θ, cos θ) – the matrix's two columns. Right: the quarter-turn matrix turns (2, 1) into (−1, 2).")

## Why 4×4 matrices?

Matrices can rotate, as we just saw, and in the next chapter you'll see that they can scale too. But
look at what a 2×2 (or 3×3) matrix does to the origin: every element of the result is a sum of matrix elements times
0, so the origin always stays at the origin. Such a matrix can turn and stretch space around the origin, but it can
never *move* anything – and moving objects around is exactly what we need.

The trick graphics programmers use is to add a fourth component to every position, w, which is 1 for points, and to
use 4×4 matrices whose extra column can hold a movement. That is why the identity matrix above was 4×4, and why the
positions in your vertex shaders have had four components all along. *Transformations* shows how
the extra column does its job, and *Coordinate systems* puts w to one more use: perspective.

```quiz
Why can't a 3×3 matrix move (translate) a 3D point?
- [ ] Because it has too few elements to store three numbers for the movement
- [ ] Because matrix multiplication isn't commutative
- [x] Because it always sends the origin (0, 0, 0) to the origin, so it can't move everything by the same amount
- [ ] Because only 4×4 matrices can be multiplied with vectors
---
Every element of the result is a sum of products with the vector's components – all 0 for the origin – so the origin always stays where it is. A movement would have to shift the origin too. The order of multiplication has nothing to do with it, and matrices of any size can be multiplied with a vector that has as many rows as the matrix has columns.
```

## Summary

- Positions are lists of numbers along axes. This course uses a **right-handed** system: +x right, +y up, +z out of
  the screen towards you.
- Angles are measured in degrees (a full turn is 360°) or radians (2π); the maths functions expect radians, and a
  positive angle turns counter-clockwise.
- The point at angle θ on the unit circle is (cos θ, sin θ); for radius r it is (r · cos θ, r · sin θ).
- Vectors have a direction and a length; they can be added, subtracted, scaled and normalized. The dot product of
  unit vectors is the cosine of the angle between them, and the cross product gives a vector at a right angle to both.
- Matrices are multiplied row by column, and the order matters. A matrix times a vector transforms the vector, and
  the matrix's columns are where the axes go.
- A rotation by θ has the columns (cos θ, sin θ) and (−sin θ, cos θ); to also move things we need a fourth component,
  w, and 4×4 matrices.

That's the toolbox. In the next chapter, *Transformations*, we use it to build the matrices that scale, move and
rotate the container – and then put them to work in your shaders.
