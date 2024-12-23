# Commands 命令

在**Bevy**中，每个`Command`都代表我们想要变更`World`的状态。  

每个命令最终都会执行一个函数，该函数接收对`World`的可变引用，用于更改其状态。   

因为你的每个命令都需要这个可变引用，所以当其他系统可能并行运行时运行是不安全的。  

因此，Bevy 按照它们添加到 `CommandQueue` 的顺序安排它们在一个系统内一起运行，我们通过 `Commands` 系统参数来执行此操作。

每个游戏循环运行一次，此系统将运行一次，并且每个命令都会应用于你的`World`。

## Scheduling commands 计划命令  

要执行命令，首先我们必须安排它们。

我们不会手动将它们添加到 `CommandQueue`，而是使用系统参数：`Commands`，这是队列的公共 API。

```rust
fn spawn_an_entity(
    mut commands: Commands,
) {
    commands.spawn_empty();
}
```

这是我们能写的最简单的命令。它只会生成一个没有任何组件的空 `Entity`。

要销毁一个实体，我们还将使用命令：

```rust
fn despawn_an_entity(
  mut commands: Commands,
  query: Query<Entity>
) {
  for entity in query.iter() {
    commands.entity(entity).despawn();
  }
}
```

`Commands` 是系统参数，其中包含计划更改的所有方法，包括自己编写的[自定义命令](https://taintedcoders.com/bevy/patterns/custom-commands)。

需要注意的是，这两个命令实际上都不会在立即执行。相反，它们被排队等待下次所有命令一起运行时运行。每当我们在 `DefaultPlugins` 添加的 `apply_deferred` 系统期间过渡到下一个计划时，都会发生这种情况。

## Spawning components and bundles 生成组件和捆绑包

对世界状态的所有更改都应来自这些命令，包括`spawning`和`despawning`。

```rust
#[derive(Component)]
struct Player;

fn spawn_player(mut commands: Commands) {
  // Here we are `Commands`
  commands
    .spawn_empty()
    // We are now an `EntityCommands`
    // for the entity we just spawned
    .insert(Player)
    .insert(Transform::default());
}
```

`spawn_empty`后，我们实际上会返回我们生成的特定实体的 `EntityCommands`。

`EntityCommands` 允许我们将组件`insert`到新实体上。Insert 本身将返回 `EntityCommands`，它允许我们将这些调用链接在一起。

使用某种组件生成实体是如此常见，因此有一个更短的版本：

```rust
fn spawn_player_shorter(mut commands: Commands) {
  commands.spawn(Player).insert(Transform::default());
}
```

在这里，我们使用 `spawn` 而不是 `spawn_empty`它需要一个组件来添加到新生成的实体中。

这还会传回 `EntityCommands`，我们可以使用这些命令在我们生成的特定实体上进一步插入组件。

当然，`spawn` 也可以接受 `Bundle` 组件：

```rust
#[derive(Bundle)]
struct PlayerBundle {
  player: Player,
  transform: Transform,
}

fn spawn_with_bundle(mut commands: Commands) {
  commands.spawn(PlayerBundle {
    player: Player,
    transform: Transform::default(),
  });
}
```

当组件的元组已经是 `Bundle` 类型，可以进一步缩短为：

```rust
fn spawn_player_shortest(mut commands: Commands) {
  let bundle = (Player, Transform::default());
  commands.spawn(bundle);
}
```

## Commands are delayed until the next schedule 命令将延迟到下一个调度

当您使用系统参数 `Commands` 时，您将命令排队，以便在我们过渡到下一个 `Schedule` 时运行。

`Schedule` 是框架生命周期的一部分。这些计划是系统的集合，以及有关如何运行它们的确切说明。

例如，`Startup` 和 `Update` 都是您以前可能见过的常见计划。

如果我们只有一个阶段，即使我们的系统在彼此之前或之后运行，实际的命令也不会应用于世界，直到下一帧。

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Update, take_the_castle.after(raising_the_gates))
    .run();
}
```

假设我们有一个系统`take_the_castle`在另一个系统`raise_the_gates`之后运行。

如果你很聪明，你会认为当调用 `take_the_castle` 时，你已经升起了大门。

然而，事实并非如此，因为当 `take_the_castle` 运行时，我们的命令只是被_排入队列_，没有被执行。

由于每个命令都需要对 `World` 的独占访问权限（我们正在改变 state），因此当内置 `apply_deferred` 系统运行时，所有排队的命令都会按顺序应用。

这里的解决方案是确保我们在将命令排队_之后_但在运行 `apply_deferred` 之前运行我们的 `take_the_castle`：

```rust
fn main() {
  let raise_the_gates = apply_deferred.after(raise_the_gates);
  let ordered_systems = (raise_the_gates, take_the_castle).chain();

  App::new()
    .add_systems(Update, ordered_systems)
    .run();
}
```

这里的 `chain` 调用只是确保第一个系统 `apply_deferred.after(raise_the_gates)` 运行，然后 `take_the_castle` 将紧随其后运行。

## Custom commands 自定义命令

我们可以实现自己的命令，使我们的逻辑更易于理解。

想象一下，我们有一个游戏，它在屏幕中间生成了一个大行星。我们可能有一个如下所示的系统：

```rust
#[derive(Component)]
struct Planet {
  radius: f32,
}

#[derive(Bundle)]
struct PlanetBundle {
  planet: Planet,
  transform: Transform,
}

impl PlanetBundle {
  fn new(radius: f32) -> Self {
    Self {
      planet: Planet { radius },
      transform: Transform::default(),
    }
  }
}

// Spawns a blue planet in the middle of the screen
fn spawn_planet_manually(
  mut commands: Commands,
  mut meshes: ResMut<Assets<Mesh>>,
  mut materials: ResMut<Assets<ColorMaterial>>,
) {
  let size = 100.0;
  let shape = Circle::new(size);
  let color = Color::srgb(0.0, 0.0, 1.0);

  commands.spawn((
    PlanetBundle::new(size),
    ColorMesh2dBundle {
      mesh: meshes.add(shape).into(),
      material: materials.add(color),
      ..Default::default()
    },
  ));
}
```

但是，对于每个生成行星的系统，我们将需要网格`meshes``materials`资源。

如果没有我们的评论和系统名称，也不完全清楚这里到底发生了什么。

为了缩短我们的参数列表并封装我们的逻辑，我们可以通过在包含参数的结构体上实现 `Command` 来创建自己的自定义命令：

```rust
// Our custom command
struct SpawnPlanet {
  radius: f32,
  position: Vec2,
}

use bevy::sprite::MaterialMesh2dBundle;

impl Command for SpawnPlanet {
  fn apply(self, world: &mut World) {
    // Resource scope works by removing the resource from the world
    // and then running our closure. This lets us mutably borrow
    // the world safely multiple times
    let mesh_handle =
      world.resource_scope(|_world, mut meshes: Mut<Assets<Mesh>>| {
        let circle = Circle::new(self.radius);
        meshes.add(circle)
      });

    let color_material = world.resource_scope(
      |_world, mut materials: Mut<Assets<ColorMaterial>>| {
        let blue = Color::srgb(0.0, 0.0, 1.0);
        materials.add(blue)
      },
    );

    world.spawn((
      PlanetBundle::new(self.radius),
      MaterialMesh2dBundle {
        mesh: mesh_handle.into(),
        material: color_material,
        transform: Transform::from_translation(self.position.extend(0.)),
        ..default()
      },
    ));
  }
}
```

这需要更多的代码，但现在我们生成行星的能力已经变得更加简化：

```rust
fn spawn_planet(mut commands: Commands) {
  commands.add(SpawnPlanet {
    radius: 100.,
    position: Vec2::new(0., 0.),
  });
}
```
## Extending the commands API 扩展命令 API

有时，如果我们能扩展命令的 API 会更好。像 `commands.spawn_planet(Vec2::Zero, 100.0)` 这样的方法可能会效果更好。为此，我们可以使用`trait`扩展。

特征扩展允许您通过新实现向现有类型添加方法。我们可以看到 [`bevy_hierarchy`](https://taintedcoders.com/bevy/hierarchy) 中的一个例子：

```rust
// https://github.com/bevyengine/bevy/blob/13d46a528ac6e8c2e08e8b9ba436abb9baaefefc/crates/bevy_hierarchy/src/hierarchy.rs#L84

// Trait that holds functions for despawning recursively down the transform hierarchy
pub trait DespawnRecursiveExt {
  // Despawns the provided entity alongside all descendants.
  fn despawn_recursive(self);

  // Despawns all descendants of the given entity.
  fn despawn_descendants(&mut self);
}

impl<'w, 's, 'a> DespawnRecursiveExt for EntityCommands<'w, 's, 'a> {
  // Despawns the provided entity and its children.
  fn despawn_recursive(mut self) {
    let entity = self.id();
    self.commands().add(DespawnRecursive { entity });
  }

  fn despawn_descendants(&mut self) {
    let entity = self.id();
    self.commands().add(DespawnChildrenRecursive { entity });
  }
}
```
## Testing commands 测试命令

我们可以为自定义命令编写测试，并手动`push` `CommandQueue`，最后触发`apply`：

```rust
use bevy::ecs::system::Command;
use bevy::prelude::*;

struct MyCommand;

impl Command for MyCommand {
  fn apply(self, world: &mut World) {
    info!("Hello, world!");
  }
}

#[cfg(test)]
mod tests {
  use bevy::ecs::world::CommandQueue;

  #[test]
  fn test_my_command() {
    let mut world = World::default();
    let mut command_queue = CommandQueue::default();

    // We could manually add our commands to the queue
    command_queue.push(MyCommand);

    // We can apply the commands to a given world:
    command_queue.apply(&mut world);
  }
}
```