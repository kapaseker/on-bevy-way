# Code Organization 代码组织

这些是我在阅读其他**Bevy**项目和构建自己的项目时发现的诀窍。

在 [Bevy Starter](https://github.com/nolantait/bevy-starter) repo 中找到如何组织游戏的示例。

## 不要把所有逻辑放在 main.rs
当我们运行 `cargo new pong` 时，`cargo` 会为我们创建一个基本的项目结构。`src` 文件夹中有两个特别特殊的文件：
- `main.rs` - 二进制可执行文件的入口
- `lib.rs` - 库代码的入口

如果你有其中一个或两个文件，`cargo build` 和 `cargo release` 将做不同的事情。

当 `cargo` 检测到 `main.rs` 文件时，它会将您的项目编译为**二进制 crate**，而不是库。这意味着人们不必安装**Rust**来玩我们的游戏，他们只需运行可执行文件即可。'

当 `cargo` 检测到 `lib.rs` 时，它会将你的项目编译为一个**库 crate**，生成一个 `.rlib` 文件，其他`crate`（或我们自己的）可以通过`use`链接到该库。

以下是**Bevy**的最佳 `main.rs` 的样子：

```rust
// src/main.rs
use bevy::prelude::*;

use starter::AppPlugin;

fn main() {
  App::new().add_plugins(AppPlugin).run();
}
```
我们没有将任何逻辑放在主文件中，而是将其转移到我们自己的库中：
```rust
// src/lib.rs
use bevy::prelude::*;

mod camera;
mod debug;
mod dev_tools;
mod game;
mod input;
mod physics;
mod utils;
mod window;

pub struct AppPlugin;

impl Plugin for AppPlugin {
  fn build(&self, app: &mut App) {
    app.add_plugins((
      window::plugin,
      camera::plugin,
      physics::plugin,
      input::plugin,
      game::plugin,
    ));

    // Enable dev tools for dev builds.
    #[cfg(feature = "dev")]
    app.add_plugins((
      dev_tools::plugin,
      debug::plugin
    ));
  }
}
```

通过这种方式，我们可以编写插件而无需太多样板：

```rust
// src/camera.rs
use bevy::prelude::*;

#[derive(Component)]
pub struct MainCamera;

pub(super) fn plugin(app: &mut App) {
  app.add_systems(Startup, initialize_camera);
}

fn initialize_camera(mut commands: Commands) {
  commands.spawn((Camera2dBundle::default(), MainCamera));
}
```
避免让`main`函数负载过重意味着我们将执行上下文和库上下文分开。这会带来一些优势：
- Moving things into separate crates later on is easier
- Setting up tests is simplified (easy to spin up a new `App`)

## Parent and child relationships 父子关系
实体可以使用特殊组件保持彼此的父/子关系。

最常见的是，这些层次结构用于将 `Transform` 值从 `Parent` 继承到其 `Children`。

## Generic systems 通用系统
系统可以变得通用，这样您就可以编写更抽象的功能。

一个很好的例子是添加一个系统来清理任何类型的组件：

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(OnExit(AppState::MainMenu), cleanup_system::<MenuClose>)
    .add_systems(OnExit(AppState::InGame), cleanup_system::<LevelUnload>)
}

// Type arguments on functions come after the function name, but before ordinary arguments.
// Here, the `Component` trait is a trait bound on T, our generic type
fn cleanup_system<T: Component>(mut commands: Commands, query: Query<Entity, With<T>>) {
  for e in &query {
    commands.entity(e).despawn_recursive();
  }
}
```
## Custom queries 自定义查询

使用  `#[derive(QueryData)]`  可以构建自定义查询：
- 它们有助于避免解构或使用 `q.0, q.1, ...` 访问模式
- 使用结构添加、删除组件或更改项目顺序可以大大减轻维护负担，因为您不需要更新解构`Tuples`、关心元素顺序等的语句。相反，您可以只添加或删除使用特定元素的位置
- 命名结构启用组合模式，这使得查询类型更易于重用
-   绕过查询元组存在的 15 个组件限制

```rust
#[derive(QueryData)]
#[query_data(derive(Debug))]
struct PlayerQuery {
  entity: Entity,
  health: &'static Health,
  ammo: &'static Ammo,
  player: &'static Player,
}

fn print_player_status(query: Query<PlayerQuery>) {
  for player in query.iter() {
    println!(
      "Player {:?} has {:?} health and {:?} ammo",
      player.entity, player.health, player.ammo
    );
  }
}
```

## Custom commands 自定义命令

我们可以实现自己的自定义命令来减少常见操作的样板。

```rust
pub struct SpawnBoid {
  pub position: Vec2,
}

impl SpawnBoid {
  pub fn random() -> Self {
    let mut rng = rand::thread_rng();
    let x = rng.gen_range(-200.0..200.0);
    let y = rng.gen_range(-200.0..200.0);
    Self {
      position: Vec2::new(x, y),
    }
  }
}

impl Command for SpawnBoid {
  fn apply(self, world: &mut World) {
    let assets = world.get_resource::<BoidAssets>();

    if let Some(assets) = assets {
      world.spawn((
        BoidBundle::new(self.position.x, self.position.y),
        MaterialMesh2dBundle {
          mesh: assets.mesh.clone().into(),
          material: assets.material.clone(),
          ..default()
        },
      ));
    }
  }
}

fn setup(mut commands: Commands) {
  for _ in 0..100 {
    commands.add(SpawnBoid::random());
  }
}
```
