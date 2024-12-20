# Camera 相机

如果您只加载一个`Window`而没有摄像头，**Bevy**将显示黑屏。

[Windows]处理操作系统上窗口的逻辑，但**Bevy**如何知道在其上实际显示什么？

这就是使用相机的地方。它们的位置类似于具有`Transform`组件的其他实体。

**Bevy**中的坐标系遵循右手准则，因此：

- X 向右
- Y 向上
- Z 向屏幕
- 默认中心为屏幕中心(0,0)

当我们生成摄像机时，我们会根据我们的游戏使用`Camera2dBundle`或`Camera3dBundle`。

```rust
// Useful for marking the "main" camera if we have many
#[derive(Component)]
pub struct MainCamera;

fn initialize_camera(
  mut commands: Commands
) {
  commands.spawn((
    Camera2dBundle::default(),
    MainCamera
));
}
```

摄像机行为通常非常通用，并且与游戏逻辑的其余部分分开，因此创建一个摄像机插件并将其添加到应用程序中是更推荐的做法：

```rust
pub struct CameraPlugin;

impl Plugin for CameraPlugin {
  fn build(&self, app: &mut App) {
    app.add_systems(Startup, initialize_camera);
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_plugins(CameraPlugin)
    .run();
}
```

捆绑包本身有多种选项可供我们调整：

```rust
#[derive(Bundle, Clone)]
pub struct Camera2dBundle {
    pub camera: Camera,
    pub camera_render_graph: CameraRenderGraph,
    /// Note: default value for `OrthographicProjection.near` is `0.0`
    /// which makes objects on the screen plane invisible to 2D camera.
    /// `Camera2dBundle::default()` sets `near` to negative value,
    /// so be careful when initializing this field manually.
    pub projection: OrthographicProjection,
    pub visible_entities: VisibleEntities,
    pub frustum: Frustum,
    pub transform: Transform,
    pub global_transform: GlobalTransform,
    pub camera_2d: Camera2d,
    pub tonemapping: Tonemapping,
    pub deband_dither: DebandDither,
    pub main_texture_usages: CameraMainTextureUsages,
}
```

## Camera projection 相机投影

**Bevy**的默认摄像机使用具有对称视锥体的正交投影。

不要惊慌！让我们把这一切分解一下。

此处的**Projection**是指将**3D**场景转换为屏幕或视口上的**2D**表示的过程。

由于计算机屏幕是**2D**的，我们需要将物体的**3D**世界及其位置转换为可以显示的平面图像。

**正交投影**是一种保留物体的相对大小及其与我们之间的距离的投影。

换句话说，如果两个对象在**3D**世界中与观察者的距离不同，则它们在**2D**屏幕上的投影大小将准确反映它们在**3D**世界中的大小。

另一方面，平截头体是指一个截断的金字塔形状，它代表计算机图形学中的可视体积或视野。它就像一个顶部被切掉的金字塔，导致金字塔形状更小。

![frustum](https://i.imgur.com/Aq3bgKs.png)

在对称平截体体中，截断金字塔的形状是平衡的或对称的，这意味着左侧和右侧以及顶部和底部的大小和形状相等。

## Directing the camera 对准相机

要在场景中移动摄像机，我们只需要更改其`translation`：

```rust
fn move_camera(
  mut camera: Query<&mut Transform, (With<Camera2d>, Without<Player>)>,
  player: Query<&Transform, (With<Player>, Without<Camera2d>)>,
  time: Res<Time>,
) {
  let Ok(mut camera) = camera.get_single_mut() else {
    return;
  };

  let Ok(player) = player.get_single() else {
    return;
  };

  let Vec3 { x, y, .. } = player.translation;
  let direction = Vec3::new(x, y, camera.translation.z);

  camera.translation = camera
    .translation
    .lerp(direction, time.delta_seconds() * 2.);
}
```

我们本可以在每一帧中将摄像机对齐到玩家的位置，但在这里我们使用线性插值来平滑这种效果，这在自上而下的游戏中很常见。

为了更改摄像机的缩放比例，我们操作`OrthographicProjection`组件。

```rust
fn zoom_control_system(
  input: Res<ButtonInput<KeyCode>>,
  mut camera_query: Query<&mut OrthographicProjection, With<MainCamera>>,
) {
  let mut projection = camera_query.single_mut();

  if input.pressed(KeyCode::Minus) {
    projection.scale += 0.2;
  }

  if input.pressed(KeyCode::Equal) {
    projection.scale -= 0.2;
  }

  projection.scale = projection.scale.clamp(0.2, 5.);
}
```

## Render Layers 渲染层

当我们希望摄像机仅渲染某些实体时，可以使用`RenderLayers`组件。

默认情况下，所有组件都在第`0`层渲染，并且有`32`层`TOTAL_LAYERS`可供选择。 

将它附加到我们的相机会设置它应该渲染的实体。

将其附加到我们的其他实体会设置哪个摄像机应该进行渲染。

```rust
// RenderLayers are Copy so aliases work to improve clarity
const BACKGROUND: RenderLayers = RenderLayers::layer(1);
const FOREGROUND: RenderLayers = RenderLayers::layer(2);

fn initialize_cameras(mut commands: Commands) {
  commands.spawn((
    Camera2dBundle::default(),
    FOREGROUND,
    MainCamera
  ));

  commands.spawn((
    Camera2dBundle::default(),
    BACKGROUND
  ));
}

#[derive(Component)]
struct Player;

fn spawn_player(
  mut commands: Commands
) {
  commands.spawn((
    Player,
    FOREGROUND
  ));
}
```

## Rendering Order 渲染顺序

多个摄像机都将渲染到同一个窗口。当我们想要控制此渲染的顺序时，我们可以使用优先级。

具有较高阶次的摄影机会稍后渲染，因此会位于较低阶摄影机的顶部。

我们可以想象它有点像一个油画家。应用于画布的第一个图层是背景，后续图层绘制在上面。

```rust
use bevy::render::camera::ClearColorConfig;

fn render_order(
  mut commands: Commands
) {
  // This camera defaults to priority 0 and is rendered "first" / "at the back" 
  commands.spawn(Camera3dBundle::default());

  // This camera renders "after" / "at the front"
  commands.spawn(Camera3dBundle {
    camera_3d: Camera3d {
      ..default()
    },
    camera: Camera {
      // renders after / on top of the main camera
      order: 1,
      // don't clear the color while rendering this camera
      clear_color: ClearColorConfig::None,
      ..default()
    },
    ..default()
  });
}
```

## Mouse coordinates 鼠标坐标

当您将鼠标放在屏幕上时，它将有两个位置：

- On-screen coordinates (the position of the pixel on a screen)
- World coordinates (the position of the mouse projected onto our game)

因此，当我们读取`Window::cursor_position`时，我们只获取屏幕上的坐标。我们必须通过根据我们的相机投影它们来进一步转换它们：

```rust
fn mouse_coordinates(
  window_query: Query<&Window>,
  camera_query: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
) {
  let window = window_query.single();
  let (camera, camera_transform) = camera_query.single();

  if let Some(world_position) = window
    .cursor_position()
    .and_then(|cursor| camera.viewport_to_world(camera_transform, cursor))
    .map(|ray| ray.origin.truncate())
  {
    info!("World coords: {}/{}", world_position.x, world_position.y);
  }
}
```