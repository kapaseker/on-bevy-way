# Component 组件

在[实体组件系统 （ECS）](./ecs.md) 中，你可以想象你的行是实体，你的组件是列。

组件允许我们将数据附加到我们的实体。

`Entity`本身不是很有用。它只表示我们游戏中某个事物的全局唯一**ID**。

因此，当我们需要添加`health`、`damage`或任何代表我们的实体可以处于的状态时，我们通过添加一个保存数据的组件来实现。

**Bevy**使用自己的`ECS`将其许多内部结构表示为组件：

- Resources are just singleton components without an entity
- Your game window is a Window component
- Your cameras are some entity with a Camera component
- Handles are components we attach to entities

我们感兴趣的大多数事情都涉及通过系统查询一个或另一个组件。

## Defining a component 定义组件

我们将组件定义为普通结构体，但我们通过使用`derive`宏告诉**Bevy**它们：

```rust
#[derive(Component)]
struct Position {
  x: i32,
  y: i32
}
```

这个`derive`宏将在编译时向这个结构体添加行为，并使其能够通过我们的查询获取到。

当我们查询组件时，我们可以请求可变或只读访问，然后对它的字段做任何我们想做的事情来改变我们实体的状态。

`Component`可以是结构体，也可以是其他数据类型，如`enum`或`zero`大小类型：

```rust
// A simple marker type
#[derive(Component)]
struct Player;

// Or an enum
#[derive(Component)]
enum Ship {
  Destroyer,
  Frigate,
  Scout
}
```

这些没有数据的组件充当我们行上的索引。它们让我们将组件标记为一个类型，然后在我们的系统中查询这些组件。

## Components are columns 组件是列

一个好的心智模型是，每个组件都是数据库中的列，而实体是行。

这样想会让一些重要的事情更加明显：

- Each entity can only have one component of each type（每个实体只能具有每种类型的一个组件）
- When you insert a component on an entity that already has one of that type, you will replace the original（当你在已具有该类型之一的实体上插入组件时，您将替换原始的）

所以我们可以翻译如下内容：

```rust
fn spawn_entities(
  mut commands: Commands
) {
  commands.spawn((
    Health(100.0),
    Player,
    Position { x: 3, y: 2 }
  ));

  commands.spawn((
    Health(72.0),
    Enemy,
    Position { x: 3, y: 1 }
  ));
}
```

如创建一个虚构的数据库，如下所示：

| Entity ID | Health | Player | Position | Enemy |
|-|-|-|-|-|
| 1 | 100 | √ | (3, 2) |  |
| 2 | 72 |  | (3,1) | √ |

实际上，组件存储为许多单独的连续数组。

每个数组都有单一类型的组件。`Entity`实际上是每个不同数组中其所有组件的索引。

例如，假设我们有一个`Health`和`Position`组件数组：

```
Health: [Health(100.0), Health(72.0)]
Position: [Position(3, 2), Position(3, 1)]
```

如果实体的索引为`0`，那么我们可以进入每个数组并访问该索引处的组件，从而得到`Health(100.0)`和`Position(3, 2)`。

这就是为什么我们每种类型只能有一个组件。槽中只能有一个与我们实体的索引匹配的组件。

这一切都是为了通过帮助 CPU 从其缓存中更多地获取数据来提高性能。

## Adding components to entities 向实体添加组件

我们通过命令将组件添加到实体中：

```rust
fn spawn_player(
  mut commands: Commands
) {
  commands
    .spawn_empty()
    .insert(Player)
    .insert(Ship::Destroyer)
    .insert(Position { x: 1, y: 2 });
}
```

这将安排一系列要运行的命令，这些命令将添加新的`Entity`，然后通过将每个组件放置在我们在上一节中提到的数组中来插入每个组件。

这些数组可以是以下两种专用类型之一：

- `Table` -> Faster for iterating (the default)
- `SparseSet` -> Faster for adding and removing

要使用`SparseSet`，我们在派生组件时会使用一个额外的属性：

```rust
#[derive(Component)]
#[component(storage = "SparseSet")]
struct Explode;
```

如何抉择使用哪一个？这取决是查询密集还是修改密集。

像`Explode`组件这样的东西，它既有一些行为，同时添加和修改的场景又比读取场景多得多，`SparseSet`就会是一个比`Table`更好的选择。

当我们想为我们的实体获取组件时，我们会在存储每个不同组件的每个`Table`或`SparseSet`中查找该索引。这就是我们的各个组件最终成为游戏世界中一部分的方式。

在现实中，存在一些隐藏的复杂性，使这个过程变得更快，使用[原型](./arche.md)尝试将组件组存储在一起，以最有可能访问它们的方式。

**Bevy**使用这些原型来确定哪些系统可以并行运行以及其他性能提升。

在我们的实体中添加或删除组件的能力实际上来自`Bundle trait`。所有组件都实现了这个`trait`。当我们派生组件时，我们也实现了`Bundle`。

在**Bevy**`0.15`中，将有一个更新的功能，它将替换称为`required components`的捆绑包，当它们发布时，我将在此处更新它们。

## Using bundles使用 bundle

`Bundle`可以包含一组其他组件。

这在单独插入元件可能是重复的时非常有用。或者我们希望确保所有玩家都生成了一组特定的组件。

重要的是要了解`bundle`实际上并不存在。您无法查询它们。它们仅用于添加组件组，然后它们就不复存在了。

定义`bundle`就像我们的组件一样。我们使用`derive`宏：

```rust
#[derive(Bundle)]
struct PlayerBundle {
  player: Player,
  ship: Ship,
  position: Position
}
```

一旦派生出来，我们就可以插入我们的 bundle，而不是插入我们的单个组件：

```rust
commands
  .spawn_empty()
  .insert(PlayerBundle{
    player: Player,
    ship: Ship::Destroyer,
    position: Position { x: 1, y: 2 }
  });
```

但建议实现你自己的接口来创建我们的`bundle`，以减少样板：

```rust
impl PlayerBundle {
  pub fn new(x: i32, y: i32) -> Self {
    Self {
      player: Player,
      ship: Ship::Destroyer,
      position: Position { x, y }
    }
  }
}

fn spawn_player_bundle(
  mut commands: Commands
) {
  commands
    .spawn_empty()
    .insert(PlayerBundle::new(1, 2));
}
```

`bundle`的`Tuples`也实现了`Bundle`（对于最多`15`个`bundle`的元组，遗憾的是`Rust`仍然缺少可变参数泛型）。这意味着我们可以在不定义类型的情况下创建一组组件：

```rust
fn spawn_player_tuple(
  mut commands: Commands
) {
  commands
    .spawn_empty()
    .insert((
      Player,
      Ship::Destroyer,
      Position { x: 1, y: 2 }
    ));
}
```

每个`Component`都实现了`Bundle`，并且`bundle`的`Tuples`本身也是一个`Bundle`。

更进一步，我们的元组可以包含嵌套的`bundle`元组，这允许我们嵌套我们的`bundle`以绕过`15`个元组的限制。

`nothing` `()` 的元组也算作一个捆绑包，这对于使用`World::spawn_batch`生成实体很有用。

## The component derive macro 组件 derive 宏

使用`#[derive(...)]`告诉我们的编译器生成代码，该代码将使用其默认实现实现我们放在括号内的任何`trait`。

此处的`Default`是指在`trait`本身上定义的实现。

并非所有**Rust**`trait`都会定义可派生的默认实现。像`Display`这样的东西将特定于我们将其放置到的每个结构体。但对于我们的组件来说，`trait`本身非常简单：

```rust
// https://docs.rs/bevy/latest/bevy/ecs/component/trait.Component.html
pub trait Component:
  Send
  + Sync
  + 'static {
  const STORAGE_TYPE: StorageType;

  // Provided method
  fn register_component_hooks(_hooks: &mut ComponentHooks) { ... }
}
```

组件有两种类型的存储，具有不同的权衡：

- `TableStorage` (default): Fast for iteration, slow for adding/removing
- `SparseSetStorage`: Fast for adding/removing, slow for iterating

**Bevy**将`trait`标记为`Send + Sync + 'static`。这些是`trait bounds`，它们指定`Component trait`的任何实现也必须满足这些`trait`。

`Send + Sync`的意思是我们的`Component`可以安全地在线程之间传递，`Bevy`使用它来并行运行我们的系统。`'static`是一个生命周期，这意味着我们的`Component`将在程序的整个持续时间内存在。

但是，这并不意味着组件永远不会被清理。这只是意味着任何对我们组件的引用都可以永远与`Rust`的借用规则共存。








