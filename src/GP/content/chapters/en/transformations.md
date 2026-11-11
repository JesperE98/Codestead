# Transformations

We now know how to create objects, color them and give them a detailed appearance using textures, but they're still
not that interesting since they're all static objects. We could try to make them move by changing their vertices and
re-uploading their buffers each frame, but that's cumbersome and costs quite some processing power. There are much
better ways to *transform* an object, and that's by using (multiple) *matrix* objects. This doesn't mean we're going
to talk about Kung Fu and a large digital artificial world.

Matrices are very powerful mathematical constructs that seem scary at first, but once you grow accustomed to them
they'll prove extremely useful. When discussing matrices, we'll have to make a small dive into some mathematics.
However, to fully understand transformations we first have to delve a bit deeper into vectors before discussing
matrices.

The first half of this chapter is mathematics and the same for every API. The code starts in the section
*In practice*, where you'll use the math to scale, rotate and move the textured container from the previous chapter.

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

Now the dot product **only** defines the angle between both vectors. You may remember that the cosine or cos
function becomes 0 when the angle is 90 degrees, or 1 when the angle is 0. This allows us to easily test if the two
vectors are *orthogonal* or *parallel* to each other using the dot product (orthogonal means the vectors are at a
right angle to each other). In case you want to know more about the sin or cos functions I'd suggest a basic
trigonometry refresher.

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

The result is the z axis. The order matters: y × x gives (0, 0, −1), the z axis pointing the other way.

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

### Scaling

When we're scaling a vector we are increasing the length of the arrow by the amount we'd like to scale, keeping its
direction the same. Since we're working in either 2 or 3 dimensions we can define scaling by a vector of 2 or 3
scaling variables, each scaling one axis (x, y or z).

Let's try scaling the vector v = (3, 2). We will scale the vector along the x-axis by 0.5, thus making it twice as
narrow; and we'll scale the vector by 2 along the y-axis, making it twice as high: the result is (1.5, 4).

Keep in mind that graphics APIs usually operate in 3D space so for 2D cases we could set the z-axis scale to 1,
leaving it unharmed. The scaling operation we just performed is a *non-uniform* scale, because the scaling factor is
not the same for each axis. If the scalar would be equal on all axes it would be called a *uniform scale*.

Let's start building a transformation matrix that does the scaling for us. We saw from the identity matrix that each
of the diagonal elements were multiplied with its corresponding vector element. What if we were to change the 1s in
the identity matrix to 3s? In that case, we would be multiplying each of the vector elements by a value of 3 and
thus effectively uniformly scale the vector by 3. If we represent the scaling variables as (S1, S2, S3) we can define
a scaling matrix on any vector (x, y, z) as:

```text
| S1  0   0   0 |   | x |   | S1·x |
| 0   S2  0   0 |   | y |   | S2·y |
| 0   0   S3  0 | · | z | = | S3·z |
| 0   0   0   1 |   | 1 |   | 1    |
```

Note that we keep the 4th scaling value 1. The w component is used for other purposes as we'll see later on.

### Translation

*Translation* is the process of adding another vector on top of the original vector to return a new vector with a
different position, thus *moving* the vector based on a translation vector. We've already discussed vector addition
so this shouldn't be too new.

Just like the scaling matrix there are several locations on a 4-by-4 matrix that we can use to perform certain
operations and for translation those are the top-3 values of the 4th column. If we represent the translation vector
as (Tx, Ty, Tz) we can define the translation matrix by:

```text
| 1  0  0  Tx |   | x |   | x + Tx |
| 0  1  0  Ty |   | y |   | y + Ty |
| 0  0  1  Tz | · | z | = | z + Tz |
| 0  0  0  1  |   | 1 |   | 1      |
```

This works because all of the translation values are multiplied by the vector's w column and added to the vector's
original values (remember the matrix-multiplication rules). This wouldn't have been possible with a 3-by-3 matrix.

### Homogeneous coordinates

The w component of a vector is also known as a *homogeneous coordinate*. To get the 3D vector from a homogeneous
vector we divide the x, y and z coordinate by its w coordinate. We usually do not notice this since the w component
is 1.0 most of the time. Using homogeneous coordinates has several advantages: it allows us to do matrix
translations on 3D vectors (without a w component we can't translate vectors) and in the next chapter we'll use the
w value to create 3D perspective.

Also, whenever the homogeneous coordinate is equal to 0, the vector is specifically known as a *direction vector*
since a vector with a w coordinate of 0 cannot be translated: the translation column is multiplied by 0. That is
exactly right for directions – moving an arrow somewhere else doesn't change where it points.

You have already met the homogeneous coordinate in your vertex shaders.
:::opengl
`gl_Position = vec4(aPos, 1.0);` turns the 3-component position into a 4-component one with w = 1.0: a point, which
a translation will move.
:::
:::vulkan
`gl_Position = vec4(inPosition, 1.0);` turns the 3-component position into a 4-component one with w = 1.0: a point,
which a translation will move.
:::
:::d3d12
`VSMain` takes a `float4 position : POSITION` although the vertex buffer holds only three floats per position; the
input assembler fills in the missing w with 1.0. So every vertex arrives as a point, which a translation will move.
:::

```quiz
You multiply the translation matrix that moves by (1, 2, 3) with the vector (4, 0, 0, w). What comes out for w = 1 and for w = 0?
- [ ] (4, 0, 0, 1) for w = 1, and (5, 2, 3, 0) for w = 0
- [x] (5, 2, 3, 1) for w = 1, and (4, 0, 0, 0) for w = 0
- [ ] (5, 2, 3, 1) for both values of w
---
The translation sits in the 4th column, which is multiplied by w. With w = 1 it is added once: a point is moved. With w = 0 it contributes nothing: a direction vector stays the same.
```

### Rotation

The last few sections were relatively easy to understand and to represent 2D or 3D vectors in 2D or 3D space, but
rotations are a bit trickier. If you want to know exactly how these matrices are constructed I'd recommend that you
watch the rotation items of a good linear algebra video series or textbook.

First let's define what a rotation of a vector actually is. A rotation in 2D or 3D is represented with an *angle*.
An angle could be in degrees or radians where a whole circle has 360 degrees or 2π radians. I prefer explaining
rotations using degrees as we're generally more accustomed to them, but the math libraries – GLM as well as
DirectXMath – expect radians, so here's how you convert:

```text
angle in degrees = angle in radians · (180 / π)
angle in radians = angle in degrees · (π / 180)
```

where π equals (rounded) 3.14159265359. Rotating half a circle rotates us 360/2 = 180 degrees and rotating 1/5th to
the right means we rotate 360/5 = 72 degrees to the right. A quarter turn, 90 degrees, is π/2 ≈ 1.5708 radians.

Rotations in 3D are specified with an angle **and** a *rotation axis*. The angle specified will rotate the object
along the rotation axis given. Try to visualize this by spinning your head a certain degree while continually looking
down a single rotation axis. When rotating 2D vectors in a 3D world for example, we set the rotation axis to the
z-axis (try to visualize this).

Using trigonometry it is possible to transform vectors to newly rotated vectors given an angle. This is usually done
via a smart combination of the sine and cosine functions (commonly abbreviated to sin and cos). A discussion of how
the rotation matrices are generated is out of scope for this chapter.

A rotation matrix is defined for each unit axis in 3D space where the angle is represented as the theta symbol θ.

Rotation around the X-axis:

```text
| 1  0      0       0 |   | x |   | x                 |
| 0  cos θ  −sin θ  0 |   | y |   | cos θ·y − sin θ·z |
| 0  sin θ  cos θ   0 | · | z | = | sin θ·y + cos θ·z |
| 0  0      0       1 |   | 1 |   | 1                 |
```

Rotation around the Y-axis:

```text
| cos θ   0  sin θ  0 |   | x |   | cos θ·x + sin θ·z  |
| 0       1  0      0 |   | y |   | y                  |
| −sin θ  0  cos θ  0 | · | z | = | −sin θ·x + cos θ·z |
| 0       0  0      1 |   | 1 |   | 1                  |
```

Rotation around the Z-axis:

```text
| cos θ  −sin θ  0  0 |   | x |   | cos θ·x − sin θ·y |
| sin θ  cos θ   0  0 |   | y |   | sin θ·x + cos θ·y |
| 0      0       1  0 | · | z | = | z                 |
| 0      0       0  1 |   | 1 |   | 1                 |
```

Using the rotation matrices we can transform our position vectors around one of the three unit axes. Check the
Z rotation with a quarter turn: cos 90° = 0 and sin 90° = 1, so the point (1, 0, 0) becomes (0, 1, 0). With x to
the right and y up, the point moves from the right to the top: a positive angle turns **counter-clockwise** when you
look down at the xy plane from +z.

To rotate around an arbitrary 3D axis we can combine all 3 of them by first rotating around the X-axis, then Y and
then Z for example. However, this quickly introduces a problem called *gimbal lock*. When one rotation lines up two of
the axes – for example, a 90° rotation around Y turns the X-axis onto the (negative) Z-axis – the rotations around the
first and the last axis now spin around the same direction, and you have lost one degree of freedom: no combination
of the three angles can then rotate the object around the missing axis.

A better solution is to rotate around an arbitrary unit axis, e.g. (Rx, Ry, Rz), right away instead of combining
the rotation matrices. Such a (verbose) matrix exists and is given below with (Rx, Ry, Rz) as the arbitrary
rotation axis:

```text
| cos θ + Rx²(1 − cos θ)        Rx·Ry(1 − cos θ) − Rz·sin θ   Rx·Rz(1 − cos θ) + Ry·sin θ   0 |
| Ry·Rx(1 − cos θ) + Rz·sin θ   cos θ + Ry²(1 − cos θ)        Ry·Rz(1 − cos θ) − Rx·sin θ   0 |
| Rz·Rx(1 − cos θ) − Ry·sin θ   Rz·Ry(1 − cos θ) + Rx·sin θ   cos θ + Rz²(1 − cos θ)        0 |
| 0                             0                             0                             1 |
```

A mathematical discussion of generating such a matrix is out of the scope of this chapter. Keep in mind that even
this matrix does not completely prevent gimbal lock in an application that builds its orientation from a series of
Euler angles. To really avoid it, we have to represent rotations using *quaternions*: four numbers that store an
axis and an angle, are safer and also more computationally friendly, and can be interpolated smoothly between two
orientations. GLM (`glm::quat`) and DirectXMath (`XMQuaternionRotationAxis`, `XMMatrixRotationQuaternion`) both
support them. However, a quaternion discussion is reserved for a later chapter.

### Combining matrices

The true power from using matrices for transformations is that we can combine multiple transformations in a single
matrix thanks to matrix-matrix multiplication. Let's see if we can generate a transformation matrix that combines
several transformations. Say we have a vector (x, y, z) and we want to scale it by 2 and then translate it by
(1, 2, 3). We need a translation and a scaling matrix for our required steps. The resulting transformation matrix
would then look like:

```text
| 1  0  0  1 |   | 2  0  0  0 |   | 2  0  0  1 |
| 0  1  0  2 |   | 0  2  0  0 |   | 0  2  0  2 |
| 0  0  1  3 | · | 0  0  2  0 | = | 0  0  2  3 |
| 0  0  0  1 |   | 0  0  0  1 |   | 0  0  0  1 |
     Trans          Scale
```

Note that we first do a translation and then a scale transformation when multiplying matrices. Matrix
multiplication is not commutative, which means their order is important. When multiplying matrices the right-most
matrix is first multiplied with the vector so you should read the multiplications from right to left. It is
advised to first do scaling operations, then rotations and lastly translations when combining matrices, otherwise
they may (negatively) affect each other. For example, if you would first do a translation and then scale, the
translation vector would also scale!

Running the final transformation matrix on our vector results in the following vector:

```text
| 2  0  0  1 |   | x |   | 2x + 1 |
| 0  2  0  2 |   | y |   | 2y + 2 |
| 0  0  2  3 | · | z | = | 2z + 3 |
| 0  0  0  1 |   | 1 |   | 1      |
```

Great! The vector is first scaled by two and then translated by (1, 2, 3). In general a model's matrix is put
together as M = T · R · S: the vertices are scaled, then rotated, then translated.

```quiz
M = Trans · Scale, where Scale scales by 2 and Trans translates by (1, 2, 3). What is M · (1, 1, 1, 1)?
- [ ] (2, 3, 4, 1)
- [x] (3, 4, 5, 1)
- [ ] (4, 6, 8, 1)
---
The matrix closest to the vector is applied first: the scale makes (2, 2, 2), then the translation gives (3, 4, 5). (4, 6, 8) is what Scale · Trans would give – translate to (2, 3, 4) first, then scale, so the translation is scaled too.
```

:::d3d12
> Keep these matrices and this order in mind, but know that DirectXMath – the math library you'll use with
> DirectX 12 – writes all of them *transposed*, and its products read in the opposite direction. The section
> *In practice* explains why; the transformations themselves are exactly the same.
:::

## In practice

Now that we've explained all the theory behind transformations, it's time to see how we can actually use this
knowledge to our advantage.

:::opengl
OpenGL does not have any form of matrix or vector knowledge built in, so we have to define our own mathematics
classes and functions. In this course we'd rather abstract from all the tiny mathematical details and simply use
pre-made mathematics libraries. Luckily, there is an easy-to-use and tailored-for-OpenGL mathematics library called
GLM.

### GLM

GLM stands for Open**GL** **M**athematics and is a *header-only* library, which means that we only have to include the
proper header files and we're done; no linking or compiling necessary. The `CMakeLists.txt` from *Setting up your IDE*
already makes it available. Most of GLM's functionality that we need can be found in 3 headers files that we'll include
as follows:

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
```

`glm.hpp` has the types (`glm::vec3`, `glm::vec4`, `glm::mat4` …), `matrix_transform.hpp` the functions that build
transformation matrices, and `type_ptr.hpp` `glm::value_ptr`, which we need to hand a matrix to OpenGL.

Let's see if we can put our transformation knowledge to good use by translating a vector of (1, 0, 0) by (1, 1, 0)
(note that we define it as a `glm::vec4` with its homogeneous coordinate set to 1.0). This is just an example, not
part of the project:

```cpp
glm::vec4 vec(1.0f, 0.0f, 0.0f, 1.0f);
glm::mat4 trans = glm::mat4(1.0f);
trans = glm::translate(trans, glm::vec3(1.0f, 1.0f, 0.0f));
vec = trans * vec;
std::cout << vec.x << vec.y << vec.z << std::endl;
```

We first define a vector named `vec` using GLM's built-in vector class. Next we define a `mat4` and explicitly
initialize it to the identity matrix by initializing the matrix's diagonals to 1.0; if we do not initialize it to
the identity matrix the matrix would be a null matrix (all elements 0) and all subsequent matrix operations would
end up a null matrix as well (since GLM 0.9.9 matrices are no longer the identity by default).

The next step is to create a transformation matrix by passing our identity matrix to the `glm::translate` function,
together with a translation vector (the given matrix is then multiplied with a translation matrix and the resulting
matrix is returned). Then we multiply our vector by the transformation matrix and output the result. If we still
remember how matrix translation works then the resulting vector should be (1 + 1, 0 + 1, 0 + 0) which is (2, 1, 0).
This snippet of code outputs `210` so the translation matrix did its job.

Note how the GLM calls build the product: `glm::translate(trans, …)` returns `trans · T` – the new matrix is
multiplied on the **right**. GLM writes vectors as columns, just like the math above, and `trans * vec` multiplies
the matrix with the column vector.
:::
:::vulkan
Vulkan does not have any form of matrix or vector knowledge built in either, so we use the same mathematics library
as learnopengl and vulkan-tutorial: GLM. Your project has used it since *Hello Triangle* for `glm::vec3` and
`glm::vec2` in `struct Vertex`.

### GLM

GLM stands for Open**GL** **M**athematics and is a *header-only* library, which means that we only have to include
the proper header files and we're done; no linking or compiling necessary. Despite its name it works for any API –
it just does math. Besides `<glm/glm.hpp>`, which the project already includes, we need one more header for the
functions that build transformation matrices:

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
```

(learnopengl also includes `<glm/gtc/type_ptr.hpp>` for `glm::value_ptr`, which OpenGL needs to receive a matrix. We
copy the matrix into a struct instead, so we don't need it.)

Let's see if we can put our transformation knowledge to good use by translating a vector of (1, 0, 0) by (1, 1, 0)
(note that we define it as a `glm::vec4` with its homogeneous coordinate set to 1.0). This is just an example, not
part of the project:

```cpp
glm::vec4 vec(1.0f, 0.0f, 0.0f, 1.0f);
glm::mat4 trans = glm::mat4(1.0f);
trans = glm::translate(trans, glm::vec3(1.0f, 1.0f, 0.0f));
vec = trans * vec;
std::cout << vec.x << vec.y << vec.z << std::endl;
```

We first define a vector named `vec` using GLM's built-in vector class. Next we define a `mat4` and explicitly
initialize it to the identity matrix by initializing the matrix's diagonals to 1.0; if we do not initialize it to
the identity matrix the matrix would be a null matrix (all elements 0) and all subsequent matrix operations would
end up a null matrix as well (since GLM 0.9.9 matrices are no longer the identity by default).

The next step is to create a transformation matrix by passing our identity matrix to the `glm::translate` function,
together with a translation vector (the given matrix is then multiplied with a translation matrix and the resulting
matrix is returned). Then we multiply our vector by the transformation matrix and output the result: (1 + 1, 0 + 1,
0 + 0), which is (2, 1, 0). This snippet of code outputs `210` so the translation matrix did its job.

Note how the GLM calls build the product: `glm::translate(trans, …)` returns `trans · T` – the new matrix is
multiplied on the **right**. GLM writes vectors as columns, just like the math above, and `trans * vec` multiplies
the matrix with the column vector.
:::
:::d3d12
Direct3D 12 does not have any form of matrix or vector knowledge built in, so we use a mathematics library. Microsoft
ships one with the Windows SDK, and all the D3D12 samples use it: **DirectXMath**. It is header-only; your project
has included `<DirectXMath.h>` (with `using namespace DirectX;`) since *Hello Triangle* for `XMFLOAT3` and `XMFLOAT2`
in `struct Vertex`.

### DirectXMath

DirectXMath has two kinds of types:

- **Calculation types**: `XMVECTOR` (four floats) and `XMMATRIX` (a 4×4 float matrix). They map to SIMD registers,
  must be 16-byte aligned and are meant for local variables, parameters and return values – this is where the math
  happens.
- **Storage types**: `XMFLOAT2`, `XMFLOAT3`, `XMFLOAT4`, `XMFLOAT4X4` and friends – plain structs of floats without
  alignment requirements, meant for your data structures. `XMLoadFloat4x4` turns an `XMFLOAT4X4` into an `XMMATRIX`,
  `XMStoreFloat4x4` does the opposite.

The functions that build transformation matrices are `XMMatrixScaling(sx, sy, sz)`, `XMMatrixTranslation(tx, ty,
tz)`, `XMMatrixRotationX/Y/Z(angle)` and `XMMatrixRotationAxis(axis, angle)`, all with angles in radians;
`XMConvertToRadians(degrees)` converts. `XMMatrixIdentity()` returns the identity matrix.

#### Row vectors

There is one big difference to the math above. The textbook (and GLM, and learnopengl) writes a vector as a
**column** and puts the matrix on its left: v' = M · v. DirectXMath writes a vector as a **row** and puts the matrix
on its right: v' = v · M. For this to give the same result, every DirectXMath matrix is the *transpose* of the
textbook matrix – rows and columns swapped. The translation matrix, for example, has its translation in the bottom
**row** instead of the right column:

```text
                     | 1   0   0   0 |
| x  y  z  1 |   ·   | 0   1   0   0 |   =   | x + Tx  y + Ty  z + Tz  1 |
                     | 0   0   1   0 |
                     | Tx  Ty  Tz  1 |
```

Transposing a product reverses its order: (A · B)ᵀ = Bᵀ · Aᵀ. So the textbook's Trans · Scale ("scale first, then
translate", read from right to left) becomes `XMMatrixScaling(…) * XMMatrixTranslation(…)` in DirectXMath – and that
is read from **left to right**: v · S · T scales v first and then translates it. The order in which you write a
DirectXMath product is the order in which the steps happen.

Let's try it by translating a vector of (1, 0, 0) by (1, 1, 0) (note that its homogeneous coordinate is 1.0). This
is just an example, not part of the project:

```cpp
XMVECTOR vec = XMVectorSet(1.0f, 0.0f, 0.0f, 1.0f);
XMMATRIX trans = XMMatrixTranslation(1.0f, 1.0f, 0.0f);
vec = XMVector4Transform(vec, trans);
// XMVectorGetX(vec), XMVectorGetY(vec), XMVectorGetZ(vec) are 2, 1 and 0
```

`XMVector4Transform(v, M)` computes v · M. The result is (1 + 1, 0 + 1, 0 + 0) = (2, 1, 0): the translation matrix did
its job. Unlike GLM's `glm::mat4`, which you must initialize to the identity yourself, each `XMMatrix…` function
returns a complete matrix, so there is nothing to initialize.
:::

### The project

:::opengl
This chapter's project continues where the *Textures* chapter ended after the task **texture-units** – the crate
with the faint smiley, `mix(…, 0.2)` – tidied up the way learnopengl's `transformations.cpp` is: the vertex colours,
which the fragment shader no longer used, are gone. Each vertex is now a position and texture coordinates (5 floats,
stride `5 * sizeof(float)`), and the texture coordinates are attribute 1:

```cpp
    float vertices[] = {
        // positions          // texture coords
         0.5f,  0.5f, 0.0f,   1.0f, 1.0f, // top right
         0.5f, -0.5f, 0.0f,   1.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   0.0f, 1.0f  // top left
    };
```

In the render loop the shader is activated under `// activate shader`, and a `// TODO:` marks where the
transformation goes, right before the container is drawn.
:::
:::vulkan
This chapter's project continues where the *Textures* chapter ended after the task **texture-units** – the crate
with the faint smiley, `mix(…, 0.2)` – prepared for learnopengl's vertex data. The vertex colours, which the fragment
shader no longer used, are gone: `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }` with location 0 = `pos` and
location 1 = `texCoord`. And the rectangle is now learnopengl's, in its order and **with +y pointing up**:

```cpp
// learnopengl's rectangle: +y points up (the vertex shader flips y for Vulkan).
// v = 0 is the top row of the image in Vulkan, so the texture coordinates are upright without flipping the image.
const std::vector<Vertex> vertices = {
    {{0.5f, 0.5f, 0.0f}, {1.0f, 0.0f}},   // top right
    {{0.5f, -0.5f, 0.0f}, {1.0f, 1.0f}},  // bottom right
    {{-0.5f, -0.5f, 0.0f}, {0.0f, 1.0f}}, // bottom left
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f}}   // top left
};

const std::vector<uint16_t> indices = {
    0, 1, 3, // first triangle
    1, 2, 3  // second triangle
};
```

#### Why the vertex shader flips y

Remember from *Hello Triangle* that Vulkan's clip space has its y axis pointing **down**. The math of this chapter –
and GLM's functions – assume the usual mathematical axes, x to the right and y **up**: a positive rotation about z
turns counter-clockwise, and a translation by (0.5, −0.5) moves to the bottom right. In Vulkan's y-down space the
same matrices would give a mirrored picture: the rotation would turn clockwise on screen and the translation would
move the container to the *top* right.

So we do the math in a y-up space, like learnopengl, and flip y at the very end, **after** the transformation:

```glsl
void main() {
    gl_Position = vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
```

That is why the vertices above have +y up (top right is (0.5, 0.5)), and why the texture coordinates are
learnopengl's with v flipped: learnopengl flips the images while loading them, we don't, because in Vulkan v = 0 is
the image's top row. With the flip in place every GLM matrix below gives exactly learnopengl's picture. In the next
chapter the flip moves into the projection matrix (`proj[1][1] *= -1`), as vulkan-tutorial does.

The flip also keeps culling happy. On screen both triangles (top right → bottom right → top left, and bottom right →
bottom left → top left) run clockwise, so the pipeline's `cullMode = VK_CULL_MODE_BACK_BIT` with
`frontFace = VK_FRONT_FACE_CLOCKWISE` keeps them. Without the flip the rectangle would be mirrored, its triangles
would be counter-clockwise on screen, and both would be culled. Rotations, translations and uniform scales (even by
a negative factor, as you'll see in the exercises) never mirror the rectangle, so nothing gets culled in this
chapter.

The `// TODO:` comments mark four places: `struct PushConstants` before the class, the push constant range in
`createGraphicsPipeline()`, the matrix and `vkCmdPushConstants` in `recordCommandBuffer()` (between
`vkCmdBindDescriptorSets` and `vkCmdDrawIndexed`), and the push constant block in `shader.vert`.
:::
:::d3d12
This chapter's project continues where the *Textures* chapter ended after the task **texture-units** – the crate
with the faint smiley, `lerp(…, …, 0.2f)` – without the per-vertex colour, which the pixel shader no longer used:
`struct Vertex { XMFLOAT3 position; XMFLOAT2 texCoord; };` with the input elements `POSITION` at offset 0 and
`TEXCOORD` at offset 12. The rectangle is learnopengl's, in its order:

```cpp
        Vertex vertices[] =
        {
            // position               texture coords
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f } },    // top right
            { { 0.5f, -0.5f, 0.0f },  { 1.0f, 1.0f } },    // bottom right
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 1.0f } },    // bottom left
            { { -0.5f, 0.5f, 0.0f },  { 0.0f, 0.0f } }     // top left
        };
```

Direct3D's clip space has y pointing up, like OpenGL's, so the math of this chapter works on screen exactly as
drawn: a positive rotation about z turns counter-clockwise and a translation by (0.5, −0.5) moves to the bottom
right. The texture coordinates start at the image's top left, as in the previous chapter.

The root signature has one parameter so far: parameter 0, the descriptor table with the two textures. The
`// TODO:` comments mark the root signature block in `LoadAssets()` and the place before `DrawIndexedInstanced` in
`PopulateCommandList()`.
:::

The `// TODO:` comments mark where your code goes. After each task, build and run the program in your IDE.

### Getting the matrix to the shader

Let's do something more interesting and scale and rotate the container object from the previous chapter. We'll
scale it to half its size and rotate it by 90 degrees counter-clockwise about the z axis.

:::opengl
First we create the transformation matrix in the render loop, after `ourShader.use();`:

```cpp
        // create transformations
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));
```

First we scale the container by 0.5 on each axis and then rotate the container 90 degrees around the z-axis. GLM
expects its angles in radians so we convert the degrees to radians using `glm::radians`. Note that the textured
rectangle is on the XY plane so we want to rotate around the z-axis. Keep in mind that the axis that we rotate around
should be a unit vector, so be sure to normalize the vector first if you're not rotating around the X, Y, or Z axis.
Because each GLM call multiplies on the right, `transform` is R · S, which scales first and rotates second – read
the calls from the bottom up. And since we build the matrix every frame, it is recalculated before each draw.

The next big question is: how do we get the transformation matrix to the shaders? We shortly mentioned before that
GLSL also has a `mat4` type. So we'll adapt the vertex shader to accept a `mat4` uniform variable and multiply the
position vector by the matrix uniform:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoord;

uniform mat4 transform;

void main()
{
    gl_Position = transform * vec4(aPos, 1.0);
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

> GLSL also has `mat2` and `mat3` types that allow for swizzling-like operations just like vectors. All the
> aforementioned math operations (like scalar-matrix multiplication, matrix-vector multiplication and matrix-matrix
> multiplication) are allowed on the matrix types. Wherever special matrix operations are used we'll be sure to
> explain what's happening.

We added the uniform and multiplied the position vector with the transformation matrix before passing it to
`gl_Position`. Our container should now be twice as small and rotated 90 degrees (tilted to the left). We still
need to pass the transformation matrix to the shader though:

```cpp
        // get matrix's uniform location and set matrix
        unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
        glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));
```

We first query the location of the uniform variable and then send the matrix data to the shaders using
`glUniform` with `Matrix4fv` as its postfix. The first argument should be familiar by now which is the uniform's
location. The second argument tells OpenGL how many matrices we'd like to send, which is 1. The third argument asks
us if we want to transpose our matrix, that is to swap the columns and rows. OpenGL developers often use an internal
matrix layout called *column-major ordering*, which is the default matrix layout in GLM: the 16 floats are stored
column by column, so the translation of a translation matrix ends up in elements 12, 13 and 14. Since GLM already
stores the matrix the way OpenGL expects it, there is no need to transpose the matrix; we can keep it at `GL_FALSE`.
The last parameter is the actual matrix data as a pointer to floats; GLM's built-in function `value_ptr` returns a
pointer to the first of the matrix's 16 floats.

Now do the first task, **transform-uniform**: include the three GLM headers after `stb_image.h`, replace the
`// TODO:` with the lines above, and add the uniform to `shader.vs`.
:::
:::vulkan
In learnopengl the matrix is a *uniform*. Vulkan has uniform buffers too, but for one small value per draw that
changes every frame, *push constants* are simpler – you used them in the *Shaders* and *Textures* chapters. A
`mat4` is 16 floats, 64 bytes; every Vulkan implementation offers at least 128 bytes of push constants
(`maxPushConstantsSize`), so it fits.

The vertex shader declares the block and multiplies the position with the matrix, **before** the y flip:

```glsl
#version 450

layout(push_constant) uniform PushConstants {
    mat4 transform;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    gl_Position = pc.transform * vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
```

> GLSL also has `mat2` and `mat3` types. All the aforementioned math operations (like scalar-matrix multiplication,
> matrix-vector multiplication and matrix-matrix multiplication) are allowed on the matrix types. `pc.transform *
> vec4(inPosition, 1.0)` multiplies the matrix with a column vector, just like the math above.

On the C++ side we need a struct with the same layout, above the class:

```cpp
// The same layout as the push constant block in the vertex shader (a mat4 is 64 bytes).
struct PushConstants {
    glm::mat4 transform;
};
```

The bytes match without any conversion: GLM stores its matrices *column-major* (the 16 floats column by column, so a
translation ends up in elements 12, 13 and 14), and GLSL reads a `mat4` in a push constant block column-major by
default too.

The pipeline layout must announce the push constants. This time the vertex shader reads them, so the range names
the vertex stage:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

and `pipelineLayoutInfo` uses it:

```cpp
        pipelineLayoutInfo.pushConstantRangeCount = 1;
        pipelineLayoutInfo.pPushConstantRanges = &pushConstantRange;
```

Finally, `recordCommandBuffer()` builds the matrix and pushes it, after `vkCmdBindDescriptorSets` and before the
draw:

```cpp
        // create transformations
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));

        // push the matrix to the vertex shader: it is used by the draws recorded after this
        PushConstants constants{};
        constants.transform = transform;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

First we scale the container by 0.5 on each axis and then rotate the container 90 degrees around the z-axis. GLM
expects its angles in radians so we convert the degrees to radians using `glm::radians`. The rectangle is on the XY
plane so we rotate around the z-axis; keep in mind that the axis should be a unit vector. Because each GLM call
multiplies on the right, `transform` is R · S, which scales first and rotates second – read the calls from the
bottom up.

`vkCmdPushConstants` copies the 64 bytes into the command buffer, and every draw recorded after it sees them. Since
`drawFrame()` records the command buffer anew every frame, the matrix is rebuilt every frame too.

Now do the first task, **transform-uniform**: include `<glm/gtc/matrix_transform.hpp>` and replace the four
`// TODO:` comments with the code above.
:::
:::d3d12
In learnopengl the matrix is a *uniform*. Direct3D 12's equivalent for a small value per draw is *root constants* –
you used them in the *Shaders* and *Textures* chapters. A 4×4 float matrix is 16 floats, so it takes 16 32-bit root
constants. A root signature can hold at most 64 DWORDs (32-bit values); the descriptor table costs 1 and the matrix
16, so we have room.

On the C++ side a struct describes the constants, next to `Vertex`:

```cpp
    // The root constants: what the vertex shader sees as cbuffer TransformConstants.
    // A 4x4 matrix is 16 floats: 16 32-bit root constants.
    struct TransformConstants
    {
        XMFLOAT4X4 transform;
    };
```

It holds an `XMFLOAT4X4`, the storage type, not an `XMMATRIX`. The root signature gets a second parameter, root
constants for register `b0`, read only by the vertex shader:

```cpp
        // Root parameter 1: root constants for register b0 (the transformation
        // matrix). Only the vertex shader reads them.
        CD3DX12_ROOT_PARAMETER rootParameters[2];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(TransformConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
```

`sizeof(TransformConstants) / 4` is 64 / 4 = 16 constants, at shader register 0 (`b0`) in register space 0.

In `PopulateCommandList()`, before the draw, we build the matrix and set it:

```cpp
    // Create the transformation: scale to half the size, then rotate by 90 degrees
    // about the z axis. DirectXMath multiplies a row vector by the matrices (v * M),
    // so they apply from left to right: first the scaling, then the rotation.
    XMMATRIX transform = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixRotationZ(XMConvertToRadians(90.0f));

    // Root parameter 1: the matrix for the vertex shader. It is stored transposed,
    // because HLSL reads a matrix from memory column by column (column_major).
    TransformConstants transformConstants = {};
    XMStoreFloat4x4(&transformConstants.transform, XMMatrixTranspose(transform));
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(TransformConstants) / 4, &transformConstants, 0);
```

The product reads left to right: scale to half the size, then rotate by 90° (`XMConvertToRadians` turns degrees into
the radians DirectXMath expects). The rectangle is on the XY plane so we rotate around the z-axis. On our screen,
with x to the right and y up, a positive angle turns the container counter-clockwise, just like the Z rotation
matrix above. `SetGraphicsRoot32BitConstants(1, 16, &transformConstants, 0)` copies the 16 values into root
parameter 1, starting at constant 0.

The shader declares the root constants as a constant buffer at `b0` and multiplies the position:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer TransformConstants : register(b0)
{
    float4x4 transform;
};
```

```hlsl
    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    // The position is a row vector: mul(position, transform) applies the matrix
    // the same way as DirectXMath's v * M.
    result.position = mul(position, transform);
```

#### Why XMMatrixTranspose, and why mul(position, transform)

Two conventions meet here, and the transpose makes them fit:

- `XMFLOAT4X4` stores its 16 floats **row by row** (`_11 _12 _13 _14`, then `_21` …). That is called *row-major*
  storage.
- HLSL reads a matrix in a constant buffer **column by column** by default (*column_major* packing): the first four
  floats become the first column of `transform`, the next four the second column, and so on.

If we stored M as it is, its rows would arrive as the shader matrix's columns: the shader would see Mᵀ. Storing
`XMMatrixTranspose(M)` puts M's columns into memory one after the other, so the shader's `transform` equals M.

HLSL's `mul(x, y)` treats a vector as a row vector when it is the first argument. So `mul(position, transform)`
computes position · M – exactly DirectXMath's v · M, and the vertex is scaled and then rotated, as on the CPU. This is
the pairing Microsoft's samples use (for example D3D12Bundles: `XMMatrixTranspose(…)` on the CPU and
`mul(float4(position, 1.0f), g_mWorldViewProj)` in the shader).

> You may see code that skips the transpose and writes `mul(transform, position)`, or declares the matrix
> `row_major`. Both also work – they are the same multiplication written differently. What matters is that the
> storage, the packing and the order of `mul` fit together; we follow the samples.

Now do the first task, **transform-uniform**: add the struct, replace the two `// TODO:` comments in `main.cpp` with
the code above, and add the `cbuffer` and the `mul` to `shaders.hlsl`.
:::

The result: the container is half as big and turned a quarter turn counter-clockwise, its top now on the left – the
heart, which was right of the face's centre, is now above it. You'll notice the picture looks a little distorted:
we're still working in normalized device coordinates, which are stretched across the 4:3 window. Before the turn the
half-size crate was 200 pixels wide and 150 high; after it, the image's width spans 150 pixels and its height 200.
The next chapter fixes that with a projection matrix.

:::opengl
```quiz
Why is the third argument of `glUniformMatrix4fv` `GL_FALSE` here?
- [x] GLM already stores its matrices column by column, the layout OpenGL expects, so nothing has to be transposed
- [ ] GLM stores its matrices row by row, and `GL_FALSE` tells OpenGL to swap rows and columns
- [ ] `GL_FALSE` means the matrix values are not normalized to 0..1
---
The third argument asks whether OpenGL should transpose the matrix. GLM's column-major storage is already what OpenGL expects, so `glm::value_ptr` can hand the 16 floats over as they are.
```
:::
:::vulkan
```quiz
Why does `shader.vert` negate `gl_Position.y` after multiplying with `pc.transform`?
- [ ] The flip only corrects the texture coordinates, which Vulkan reads from the bottom up
- [ ] Push constants arrive in the shader upside down and have to be corrected
- [x] The GLM matrices are built in learnopengl's coordinates with +y up, while Vulkan's clip space has +y pointing down; flipping at the end gives the same picture as learnopengl
---
All the math – counter-clockwise rotations, a translation to the bottom right – assumes y up. Flipping after the transformation converts the finished y-up position to Vulkan's y-down clip space. Without it the picture would be mirrored (and its triangles, now counter-clockwise on screen, would be culled).
```
:::
:::d3d12
```quiz
Why is the matrix passed through `XMMatrixTranspose` before it is stored in the root constants?
- [ ] It turns the counter-clockwise rotation into the clockwise one Direct3D expects
- [x] `XMFLOAT4X4` stores the matrix row by row, but HLSL reads a cbuffer matrix column by column; after the transpose the shader's `transform` equals M, and `mul(position, transform)` computes v · M
- [ ] Root constants must always be transposed, whatever their type
---
The transpose cancels the difference between DirectXMath's row-major storage and HLSL's default column_major packing. With the position as the first argument of `mul`, the shader multiplies a row vector by M, just like DirectXMath on the CPU.
```
:::

### The order of transformations

Let's see if we can rotate the container over time, and for fun we'll also reposition the container at the
bottom-right side of the window. To rotate the container over time we have to update the transformation matrix in
the render loop because it needs to update each frame. We use the time to get some angle over time.

:::opengl
```cpp
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
```

`glfwGetTime()` returns the seconds since GLFW was initialized, and we use it directly as the angle in radians: one
full turn every 2π ≈ 6.3 seconds.

Keep in mind that in the previous case we could declare the transformation matrix anywhere, but now we have to create
it every iteration to continuously update the rotation. This means we have to re-create the transformation matrix in
each iteration of the render loop. Usually when rendering scenes we have several transformation matrices that are
re-created with new values each frame.

Here we first rotate the container around the origin (0, 0, 0) and once it's rotated, we translate its rotated
version to the bottom-right corner of the screen. Remember that the actual transformation order should be read in
reverse: even though in code we first translate and then later rotate, the actual transformations first apply a
rotation and then a translation: `transform` is T · R, and R is nearest to the vertex.

Now do the task **translate-rotate**: replace the rotate and scale lines with the two lines above.
:::
:::vulkan
```cpp
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
```

`glfwGetTime()` returns the seconds since GLFW was initialized (learnopengl uses it too), and we use it directly as
the angle in radians: one full turn every 2π ≈ 6.3 seconds. `recordCommandBuffer()` runs every frame, so the time is
read anew each frame and the matrix pushed with it changes.

Here we first rotate the container around the origin (0, 0, 0) and once it's rotated, we translate its rotated
version to the bottom-right corner of the screen. Remember that the actual transformation order should be read in
reverse: even though in code we first translate and then later rotate, the actual transformations first apply a
rotation and then a translation: `transform` is T · R, and R is nearest to the vertex. (The y flip comes after all
of it, so "bottom right" really is the bottom right.)

Now do the task **translate-rotate**: replace the rotate and scale lines with the two lines above.
:::
:::d3d12
Our D3D12 program has no GLFW, so it measures the time itself with `std::chrono`, the way vulkan-tutorial does
(`#include <chrono>`):

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // Create the transformation: rotate about the z axis by the time (in radians),
    // then move to the bottom right. DirectXMath multiplies a row vector by the
    // matrices (v * M), so they apply from left to right.
    XMMATRIX transform = XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f);
```

`startTime` is `static`, so it is set once, in the first frame; `time` is the seconds since then, and we use it
directly as the angle in radians: one full turn every 2π ≈ 6.3 seconds. `PopulateCommandList()` runs every frame, so
the matrix is rebuilt every frame.

Here we first rotate the container around the origin (0, 0, 0) and once it's rotated, we translate its rotated
version to the bottom-right corner of the screen. learnopengl writes this in GLM as `translate` followed by `rotate`
and tells you to read it in reverse. With DirectXMath you don't have to: the product `R * T` is written in the order
the steps happen – rotate, then translate.

Now do the task **translate-rotate**: add `#include <chrono>` and replace the line that builds `transform` with the
code above.
:::

If you did things right you should see a full-size container spinning counter-clockwise about its own centre in the
bottom-right corner of the window – partly outside it.

:::opengl vulkan
```quiz
The code does `transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));` and then `transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));`. What happens to the container's vertices?
- [ ] They are moved to the bottom right first, then rotated about the window's centre: the container circles around the centre
- [x] They are rotated about the origin first (the container's own centre), then moved to the bottom right: the container spins in place in the bottom right
- [ ] The order of the two calls doesn't matter; both orders give the same picture
---
Each GLM call multiplies the new matrix on the right, so `transform` is T · R. The matrix nearest the vertex, R, is applied first: read the calls from the bottom up.
```
:::
:::d3d12
```quiz
The code builds `XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f)`. What happens to the container's vertices?
- [ ] The order of the two matrices doesn't matter; both orders give the same picture
- [ ] They are moved to the bottom right first, then rotated about the window's centre: the container circles around the centre
- [x] They are rotated about the origin first (the container's own centre), then moved to the bottom right: the container spins in place in the bottom right
---
DirectXMath uses row vectors: v · R · T applies R first, then T – a DirectXMath product reads from left to right.
```
:::

And there you have it. A translated container that's rotated over time, all done by a single transformation matrix!
Now you can see why matrices are such a powerful construct in graphics land. We can define an infinite amount of
transformations and combine them all in a single matrix that we can re-use as often as we'd like. Using
transformations like this in the vertex shader saves us the effort of re-defining the vertex data and saves us some
processing time as well, since we don't have to re-send our data all the time (which is quite slow); all we need to
do is update the transformation
:::opengl
uniform.
:::
:::vulkan
push constant.
:::
:::d3d12
root constants.
:::

In the next chapter we'll discuss how we can use matrices to define different coordinate spaces for our vertices.
This will be our first step into 3D graphics!

## Exercises

1. Using the last transformation on the container, try switching the order around by first rotating and then
   translating. See what happens and try to reason why this happens.
2. Try drawing a second container with another draw call but place it at a different position using transformations
   only. Make sure this second container is placed at the top-left of the window and instead of rotating, scale it
   over time (using the sin function is useful here; note that using sin will cause the object to invert as soon as
   a negative scale is applied).

Both exercises are the last two tasks of this chapter, and they build on each other: the program you end with has
the swapped order of exercise 1 and the second container of exercise 2.

### Rotate first, then translate

:::opengl
```cpp
        // switched the order: the container is now translated first and then rotated around the origin (it orbits the centre)
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
```

Now `transform` is R · T: the vertices are moved to the bottom right first, and then the whole moved rectangle is
rotated about the origin – the centre of the window.

Now do the task **rotate-first**.
:::
:::vulkan
```cpp
        // switched the order: the container is now translated first and then rotated around the origin (it orbits the centre)
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
```

Now `transform` is R · T: the vertices are moved to the bottom right first, and then the whole moved rectangle is
rotated about the origin – the centre of the window.

Now do the task **rotate-first**.
:::
:::d3d12
```cpp
    // Create the transformation, with the order switched: first move to the bottom
    // right, then rotate about the origin by the time - the container now circles
    // the centre of the window. (DirectXMath applies the matrices from left to right.)
    XMMATRIX transform = XMMatrixTranslation(0.5f, -0.5f, 0.0f) * XMMatrixRotationZ(time);
```

Now the vertices are moved to the bottom right first, and then the whole moved rectangle is rotated about the
origin – the centre of the window. (In learnopengl's GLM code this is `rotate` before `translate`.)

Now do the task **rotate-first**.
:::

The container now circles around the centre of the window, counter-clockwise, and turns along as it travels, so
the same corner always touches the window's centre. A rotation always
turns about the origin; only if the object's centre sits at the origin does the object spin in place. That's why
"scale, then rotate, then translate" is the usual order.

### A second container

:::opengl
For the second container we reset `transform` to the identity, build a new matrix, upload it and draw again, after
the first `glDrawElements`:

```cpp
        // second transformation
        // ---------------------
        transform = glm::mat4(1.0f); // reset it to identity matrix
        transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));
        float scaleAmount = static_cast<float>(sin(glfwGetTime()));
        transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));
        glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));

        // now with the uniform matrix being replaced with new transformations, draw it again.
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
```

A uniform keeps its value until you set it again, and each draw call uses the value it has at the moment of the
call. The first `glDrawElements` used the orbiting matrix; setting the uniform again gives the second draw its own.

Now do the task **second-container**.
:::
:::vulkan
For the second container we reset `transform` to the identity, build a new matrix, push it and draw again, after
the first `vkCmdDrawIndexed` (`std::sin` needs `#include <cmath>`):

```cpp
        // second transformation
        transform = glm::mat4(1.0f); // reset it to identity matrix
        transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));
        float scaleAmount = static_cast<float>(std::sin(glfwGetTime()));
        transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));
        constants.transform = transform;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        // now with the push constants replaced with the new transformation, draw it again
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

Both draws are recorded into the same command buffer, and each one uses the push constant values recorded before
it: the first draw keeps the orbiting matrix, the second gets the new one.

Now do the task **second-container**.
:::
:::d3d12
For the second container we build a new matrix, set the root constants again and draw again, after the first
`DrawIndexedInstanced` (`std::sin` needs `#include <cmath>`):

```cpp
    // Second transformation: scale by sin(time) (between -1 and 1), then move to
    // the top left.
    float scaleAmount = std::sin(time);
    transform = XMMatrixScaling(scaleAmount, scaleAmount, scaleAmount) * XMMatrixTranslation(-0.5f, 0.5f, 0.0f);
    XMStoreFloat4x4(&transformConstants.transform, XMMatrixTranspose(transform));
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(TransformConstants) / 4, &transformConstants, 0);

    // Draw the container again, now with the new root constants. Root constants are
    // recorded with each draw, so the first draw keeps its own matrix.
    m_commandList->DrawIndexedInstanced(6, 1, 0, 0, 0);
```

Root arguments are recorded into the command list: each draw uses the root constants that were set before it, so
changing them between two draws gives each draw its own matrix.

Now do the task **second-container**.
:::

You now have two containers: the one circling the window's centre, and an upright one centred in the top-left
quarter that grows and shrinks with sin(time). When sin(time) passes 0 it vanishes, and while it is negative the
container comes back upside down.

```quiz
The second container is scaled by `sin(time)`, which is negative half of the time. What do you see while it is negative?
- [ ] The container mirrored from left to right
- [x] The container upside down – turned by 180° – because scaling both x and y by a negative factor is a half turn
- [ ] Nothing: negative scale factors are clamped to zero
---
(−s·x, −s·y) is the point (x, y) scaled by s and turned by 180°. A mirror image would need an odd number of negated axes, for example only x. Since the picture is not mirrored, its triangles keep their winding order – so even with back-face culling nothing disappears.
```

Congratulations – your container moves! So far all of it happens in normalized device coordinates. In the next
chapter, *Coordinate Systems*, you'll use matrices to build a 3D world with a camera and a perspective projection.
