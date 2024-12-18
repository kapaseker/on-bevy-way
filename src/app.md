# App 应用

`App`控制游戏的主循环，让`system`可以更新`world`。   

`App`有两个核心部分：  
1. `World`，可以保存数据（实体`entities`，组件`components`）。
2. `Schedule`， 执行我们的逻辑（系统`systems`）。  

`Schedule`由`run`函数推进，我们可以覆盖该函数以微调游戏循环的行为。  

不同的游戏需要不同类型的循环。《英雄联盟》和《反恐精英》的循环肯定就不一样。我们的`run`函数可以进行调整以满足我们特定游戏的需求。  

使用`run`函数推进计划将调用`system`，该`system`将操作我们`World`中的数据。


## Defining an app 定义App

我们在`main.rs`中定义我们的`App`，该应用程序将在编译后运行二进制文件时执行。  

调用`App::run`将启动循环并开始使用`run`函数推进您的计划。

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Update, hello_world_system)
    .run();
}

fn hello_world_system() {
  println!("hello world");
}
```

`DefaultPlugins`添加了核心插件，这些插件允许您的游戏在操作系统提供的窗口上渲染。除非您尝试在 Headless 模式（没有任何图形）下运行，或者有充分的理由这样做，否则我们始终将其包含在我们的`App`定义中。

## Plugins 插件

**Bevy**使用一种将游戏组织成为单个功能的架构，叫插件。

假设一个功能*Physics*。**Bevy**允许我们编写一个`PhysicsPlugin`，为游戏添加物理特性。  

插件可将我们功能的所有设置、运行时行为捆绑到一起，并单独控制插件的打开和关闭。  

当你想使用`bevy_rapier`这样的库时，你可以通过添加插件来获得相关功能。  

添加插件，我们只需调用`App::add_plugins`并传入实现`Plugin trait`的内容：  

```rust
fn main() {
  App::new()
    .add_plugins(GamePlugin)
    .add_plugins(PhysicsPlugin)
    .add_plugins(CameraPlugin)
    .run()
}
```

我们通过在结构体上实现`Plugin`并重写方法`build`来创建一个插件。

```rust
pub struct CameraPlugin;

impl Plugin for CameraPlugin {
  fn build(&self, app: &mut App) {
    app.add_systems(Startup, initialize_camera);
  }
}

fn initialize_camera(mut commands: Commands) {
  commands.spawn(Camera2dBundle::default());
}
```

我们也可以简化我们的插件，只定义一个函数并直接使用：  

```rust
pub fn camera_plugin(app: &mut App) {
  app.add_systems(Startup, initialize_camera);
}

fn initialize_camera(mut commands: Commands) {
  commands.spawn(Camera2dBundle::default());
}

fn main() {
  App::new()
    .add_plugins(camera_plugin)
}
```

插件的理想情况是它启用一项功能，并且可以轻松打开和关闭，而不会影响游戏的其余部分。  

通过执行必要的设置（例如向游戏添加`system`、`resource`和`event`），每个插件都负责将其行为注入到游戏循环中。  

通常，保持`main.rs`文件非常干净并将核心逻辑移出到像`GamePlugin`这样的插件中很方便，它可以进一步调用运行游戏核心部分所需的其他插件。

## Plugin configuration 插件配置

我们可以为`Plugin`提供选项来配置我们的插件：  

```rust
pub struct CameraPlugin {
  debug: bool,
}

impl Plugin for CameraPlugin {
  fn build(&self, app: &mut App) {
    app.add_systems(Startup, initialize_camera);

    if self.debug {
      // Do something
    }
  }
}
```


还有一些`PluginGroup`类型，它们允许我们将相关的插件组合在一起，然后在以后配置它们，这对于编写其他人可以添加到他们的游戏中的插件非常有用：  

```rust
pub struct GamePlugins;

impl PluginGroup for GamePlugins {
  fn build(self) -> PluginGroupBuilder {
    PluginGroupBuilder::start::<Self>()
      .add(CameraPlugin::default())
      .add(PhysicsPlugin::default())
      .add(LogicPlugin)
  }
}
```  

`PluginGroup`允许我们准确配置每个`Plugin`的工作方式：  

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_plugins(
      game::GamePlugins
        .build()
        .disable::<physics::PhysicsPlugin>()
    )
    .run();
}
```

## Running app 运行应用

当我们运行一个`App`时，我们调用它的`App Runner`函数。  

根据运行程序函数的类型，调用通常永远不会返回，从而在无限循环中运行我们的游戏。   

我们可以在构建`App`时自定义默认`runner`：  

```rust
// This app wil run once
fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(ScheduleRunnerPlugin::run_once()))
    .add_plugins(game::GamePlugins.build())
    .run();
}
```

```rust
// This app wil run 60 times per second
fn main() {
  App::new()
    .add_plugins(
      DefaultPlugins.set(
        ScheduleRunnerPlugin::run_loop(
          Duration::from_secs_f64(1.0 / 60.0)
        )
      )
    )
    .add_plugins(game::GamePlugins.build())
    .run();
}
```

如果默认值不适合我们的游戏循环，我们甚至可以提供我们自己的自定义`runner`函数：  

```rust
#[derive(Resource)]
struct Input(String);

fn my_runner(mut app: App) -> AppExit {
  println!("Type stuff into the console");
  for line in std::io::stdin().lines() {
    {
      let mut input = app.world_mut().resource_mut::<Input>();
      input.0 = line.unwrap();
    }
    app.update();
  }

  AppExit::Success
}

fn main() {
  App::new().set_runner(my_runner).run();
}
```

从`0.14`开始，运行程序必须返回`AppExit::Success`。  

## Schedules 调度

`Schedule`是集合元数据、系统和负责运行它们的执行程序。App将执行每个`Schedule`的`Schedule::run`。`Schedule::run`会传递`world`以便我们进行修改。  

我们得所有`Schedule`都存储在`Schedules Resource`中，该`Resource`将`ScheduleLabel`映射到其相应的`Schedule`。  

因此，当您定义应用程序并添加系统时，例如： 

```rust
app.add_systems(Update, hello_world)
```

`Update`是一个`ScheduleLabel`，它将映射到实际执行`hello_world` `system`的`Schedule`。

我们还可以利用许多其他`ScheduleLabel`：  

1. PreStartup
1. Startup
1. PostStartup
1. First
1. PreUpdate
1. StateTransition
1. RunFixedUpdateLoop which runs FixedUpdate conditionally
1. RunFixedUpdateLoop，它有条件地运行 FixedUpdate
1. Update
1. PostUpdate
1. Last

首次运行时，将触发启动计划：  

`PreStartup` ->  `Startup` ->  `PostStartup` ->  

然后，您的正常游戏循环开始：  

```rust
v---------------------<
First ->              |
PreUpdate ->          |
StateTransition ->    |
RunFixedUpdateLoop -> |
Update ->             |
PostUpdate ->         |
Last -----------------^
```
`RunFixedUpdateLoop`的实现与循环运行次数无关。相反，它只会在经过一定时间后运行计划`FixedUpdate`。  

以下是**Bevy**内部的草图：  

```rust
#[derive(Resource)]
struct FixedTimestepState {
  accumulator: f64,
  step: f64,
}

// An exclusive system that runs our FixedUpdate schedule manually
fn fixed_timestep_system(world: &mut World) {
  world.resource_scope(|world, mut state: Mut<FixedTimestepState>| {
    let time = world.resource::<Time>();
    state.accumulator += time.delta_seconds_f64();

    while state.accumulator >= state.step {
      world.run_schedule(FixedUpdate);
      state.accumulator -= state.step;
    }
  });
}

fn main() {
  App::new()
    .add_systems(Update, fixed_timestep_system)
    .run();
}
```

这意味着，如果我们正在运行游戏测试，则添加到计划`FixedUpdate`的系统的行为将要经过正确的时间后才会运行。

```rust
#[cfg(test)]
mod tests {
  fn hello_world() {
    println!("Hello World!");
  }

  fn test_fixed_game_loop() {
    let app = App::new();
    app.add_systems(FixedUpdate, hello_world);

    app.update(); // This won't actually run the system
  }
}
```

这里没有简单的解决方案，因此我们一直将固定系统单元测试添加到`Update`计划中，以使其更易于控制。  

## App States 应用程序状态

`App`始终处于某个`AppState`。此状态决定了运行哪个`Schedule`。  

因此，你的`App`就像一个有限状态机，你的游戏逻辑触发了状态上的迁移。  


### createing app state 创建状态

**Bevy**中的`States`是实现`States trait`的任何枚举或结构体。  

```rust
#[derive(Debug, Clone, Eq, PartialEq, Hash, Default, States)]
enum AppState {
  #[default]
  MainMenu,
  InGame,
  Paused,
}

fn spawn_menu() {
  // Spawn a menu
}

fn play_game() {
  // Play the game
}

fn main() {
  App::new()
    // Add our state to our app definition
    .init_state::<AppState>()
    // We can add systems to trigger during transitions
    .add_systems(OnEnter(AppState::MainMenu), spawn_menu)
    // Or we can use run conditions
    .add_systems(Update, play_game.run_if(in_state(AppState::InGame)))
    .run();
}
```

调用`App::init_state<S>`时：  

1. **Bevy**将为应用程序添加`State<S>`和`NextState<S>`资源。  
2. 它还将添加状态转换系统。  

在`0.14`之前，`next state`是一个包含`Option<S>`的结构体，但后来被更改了，因此你的`NextState<S>`是一个可以处于以下两种状态之一的枚举：  

1. `NextState::Pending(s)`：下一个状态已触发，将转换。
1. `NextState::Unchanged`：尚未触发下一个状态

我们通过在任意系统中调用`NextState::set(S)`从一种状态转换到另一种状态。

当我们调用`App::init_state`时**Bevy**会自动添加一个系统`apply_state_transition<S>`，它在应用程序的`PreUpdate`阶段运行。  


此系统触发`OnExit(PreviousState)`和`OnEnter(YourState)`计划一次，然后最终过渡到下一个状态（如果已设置且当前为`NextState::Pending(S)`）。  

我们无法转换回我们所处的相同状态。因此，如果您不小心将`NextState`设置为当前状态，则不会发生任何事情。  

如果我们想创建显式`transition`，我们可以在`state`上实现`logic`：  

```rust
impl AppState {
  fn next(&self) -> Self {
    match *self {
      AppState::MainMenu => AppState::InGame,
      AppState::InGame => AppState::Paused,
      AppState::Paused => AppState::InGame,
    }
  }
}
```

### Changing app states 改变状态

更改应用程序的状态将更改运行每个时钟周期的`Schedule`。 

当您转换到新的应用程序状态时，将在转换到`Schedule`状态之前运行`OnExit(State)`和`OnEnter(State)`计划。  

我们可以通过使用系统内的`NextState`资源来触发这些更改：  

```rust
fn pause_game(
  mut next_state: ResMut<NextState<AppState>>,
  current_state: Res<State<AppState>>,
  input: Res<ButtonInput<KeyCode>>,
) {
  if input.just_pressed(KeyCode::Escape) {
    next_state.set(AppState::MainMenu);
  }
}
```


## Sub-apps 子应用

应用程序可以添加`SubApp`：  

```rust
#[derive(AppLabel, Clone, Copy, Hash, PartialEq, Eq, Debug)]
struct MySubApp;

let mut app = App::new();
app.insert_sub_app(MySubApp, SubApp::new());
```

每个`SubApp`都包含自己的`Schedule`和`World`，它们与主`App`分开。  

它们可以用于将游戏的逻辑分离为独立的单元。

假设我们正在制作一个游戏，其中有单独的游戏块，我们希望完全单独处理，然后与主游戏世界同步。

首先，我们可以定义某种 “块”，这些块具有我们想要控制的特定状态，例如更改它们的颜色：  

```rust
#[derive(Default, Clone, Debug)]
enum ChunkState {
  Red,
  Green,
  #[default]
  Blue,
}

#[derive(Resource, Default, Clone)]
struct Chunk {
  id: u32,
  state: ChunkState,
}

#[derive(Resource)]
struct Chunks(HashMap<u32, Chunk>);
```

然后我们可以创建一个插件，在我们的主应用程序上创建并插入一个子应用程序。这个子应用程序将在我们的主应用程序之后连续运行，而不是并行运行。

```rust
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq, AppLabel)]
pub struct ChunkApp;

fn update_chunks(mut chunks: ResMut<Chunks>) {
  for chunk in chunks.0.values_mut() {
    match chunk.state {
      ChunkState::Red => chunk.state = ChunkState::Green,
      ChunkState::Green => chunk.state = ChunkState::Blue,
      ChunkState::Blue => chunk.state = ChunkState::Red,
    }
  }
}

struct ChunksPlugin;

impl Plugin for ChunksPlugin {
  fn build(&self, app: &mut App) {
    let mut sub_app = SubApp::new();

    // Set up our sub app
    sub_app
      .insert_resource(Chunk::default())
      .add_systems(Update, update_chunks);

    // Set up how we will extract data from our main world -> sub world
    sub_app.set_extract(|main_world, sub_world| {
      let mut chunks = main_world.resource_mut::<Chunks>();
      let chunk = sub_world.resource::<Chunk>();
      chunks.0.insert(chunk.id, chunk.clone());
    });

    // Add our sub app to our main app
    app.insert_sub_app(ChunkApp, sub_app);
  }
}
```

有关更多性能问题的更完整示例，您可以查看`bevy/crates/bevy_render`中使用`async`的`pipelined_rendering.rs`。  

## Multithreading 多线程

默认情况下，应用程序将在多个线程上运行。`Scheduler`正在努力尝试在系统具有不相交的查询集时并行运行系统。  

我们可以通过更改`TaskPoolPlugin`的`ThreadPoolOptions`来配置此行为：  

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(TaskPoolPlugin {
      task_pool_options: TaskPoolOptions::with_num_threads(4),
    }))
    .run();
}
```

## Running headless app 运行无头应用

如果您想在不生成窗口或使用任何渲染系统的情况下运行您的应用程序，并且使用最少的资源，我们可以使用`MinimalPlugins`而不是我们通常添加的`DefaultPlugins`。  

这对于编写和运行包含游戏中的各种插件但不需要在屏幕上显示的测试非常有用。  

相反，如果您希望大多数其他系统像**Bevy**的资产、场景等一样运行，但不渲染到您的屏幕，则可以配置`DefaultPlugins`来执行此操作：  

```rust
use bevy::prelude::*;
use bevy::render::{
  settings::{RenderCreation, WgpuSettings},
  RenderPlugin,
};

fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(RenderPlugin {
      synchronous_pipeline_compilation: true,
      render_creation: RenderCreation::Automatic(WgpuSettings {
        backends: None,
        ..default()
      }),
    }))
    .run();
}
```