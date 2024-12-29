# 窗口
窗口是我们的应用程序[渲染](./rendering.md)数据的地方。

窗口是与运行应用的操作系统交互的抽象。这意味着某些设置将特定于平台。

窗口是通过 `bevy::window` 和 `bevy::winit` `crate` 之间的协作提供的。`bevy::window` 是窗口的干净内部 `ECS` 表示，`bevy::winit` 提供了窗口事件循环的平台特定实现。

在 **Bevy** `0.10` 之前，它曾经通过 `Windows` 资源管理我们的窗口，但后来被更改为组件 `Window`。

跨平台支持通常很好，除了 **nvidia GPU** 上的 **wayland** 之外。

## Size matters 尺寸很重要

有三种大小与窗口相关联：

- **Physical Size**，物理大小，表示窗口在监视器上占用的实际高度和宽度（以物理像素为单位）
- **Logical Size**，逻辑大小，表示应用于缩放窗口内元素的大小，以逻辑像素为单位
- **Requested Size**，请求大小，以逻辑像素为单位，这是在创建窗口或请求调整窗口大小时提交给 API 的值。

逻辑大小和物理大小是分开的，并且可能不同的原因是：

- 显示器像素密度的差异
- 像素密度的操作系统设置
- **Bevy** `App` 在两者之间指定了比例因子

**物理大小**是完全未缩放的基本大小。当我们`scale_factor`应用于窗口时，我们得到的是**逻辑大小**。

不同的大小是通过 `Window` 组件上的 `WindowResolution` 结构体（不是组件）来处理的。默认值如下所示：

```rust
WindowResolution {
  physical_width: 1280,
  physical_height: 720,
  scale_factor_override: None,
  scale_factor: 1.0,
}
```

可以在一个应用程序上使用多个窗口。默认情况下，`PrimaryWindow` 由 `WindowPlugin` 生成，包含在 `DefaultPlugins` 中。

默认插件如下所示：

```rust
WindowPlugin {
  // Spawns this component with a PrimaryWindow component
  primary_window: Some(Window::default()),
  // Close our app when all windows close
  exit_condition: ExitCondition::OnAllClosed,
  // Should we close windows when the user does?
  close_when_requested: true, 
}
```

该插件正在添加一些用于窗口处理的默认系统以及一些我们可以读取的事件：

-   `WindowResized`
-   `WindowCreated`
-   `WindowClosed`
-   `WindowCloseRequested`
-   `RequestRedraw`
-   `CursorMoved`
-   `CursorEntered`
-   `CursorLeft`
-   `Ime`
-   `WindowFocused`
-   `WindowScaleFactorChanged`
-   `WindowBackendScaleFactorChanged`
-   `FileDragAndDrop`
-   `WindowMoved`
-   `WindowThemeChanged`

`0.14` 之前的 **Bevy** 曾经有 `ReceivedCharacter`，但现在它已被弃用，取而代之的是 `KeyboardInput`，而 `winit` 重新设计了他们的键盘系统。

在原型设计时，希望使用热键退出游戏是很常见的。**Bevy** 曾经公开一个被删除的系统（在 `< 0.14` 中）`bevy::window::close_on_esc`。但是，按 Esc 键时更通用的逻辑是关闭当前窗口：

```rust
// Close the focused window whenever the escape key (Esc) is pressed
// This is useful for examples or prototyping.
pub fn close_on_esc(
  mut commands: Commands,
  focused_windows: Query<(Entity, &Window)>,
  input: Res<ButtonInput<KeyCode>>,
) {
  for (window, focus) in focused_windows.iter() {
    if !focus.focused {
      continue;
    }

    if input.just_pressed(KeyCode::Escape) {
      commands.entity(window).despawn();
    }
  }
}
```

创建的 `Window` 可以像我们的其他组件一样被查询。当我们按下 Esc 键时，我们的应用程序将通过销毁其实体来关闭任何聚焦的窗口。

但实际上，操作系统上窗口的实际关闭是通过 `bevy::winit::despawn_window` 系统完成的，该系统读取我们通过 `bevy::window` 创建的内部表示（请参阅页面下方）。

实际的 `Window` 组件包含有关如何在屏幕上定位和渲染窗口的设置。

窗口根据使用 `bevy::winit::WinitSettings` 资源的用例控制其渲染：

```rust
use bevy::winit::WinitSettings;

fn main() {
  App::new()
    // Set the background color of our window
    .insert_resource(ClearColor(Color::srgb(0.5, 0.5, 0.9)))
    // Continuous rendering for games - bevy's default.
    .insert_resource(WinitSettings::game())
    // Power-saving reactive rendering for applications.
    .insert_resource(WinitSettings::desktop_app());
}
```

`WininitSettings` 来自另一个 **bevy** `crate` `bevy::winit`，是它实际处理我们操作系统上的窗口。所以在 `bevy::window` 中有一个清晰的窗口内部表示，但现实是每个平台都有自己的创建窗口的方式。

因此，当您`Window` 消失时，它实际上是调用 `WininitPlugin` 提供的 `despawn_windows` 系统。

我们可以通过 `WindowPlugin` 初始化一个 `Window`，如下所示：

```rust
use bevy::window::PresentMode;

fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(WindowPlugin {
      primary_window: Some(Window {
        title: "I am a window!".into(),
        resolution: WindowResolution::new(500., 300.).with_scale_factor_override(1.0),
        present_mode: PresentMode::AutoVsync,
        // Tells wasm to resize the window according to the available canvas
        fit_canvas_to_parent: true,
        // Tells wasm not to override default event handling, like F5, Ctrl+R etc.
        prevent_default_event_handling: false,
        ..default()
      }),
      ..default()
    }))
}
```

**Bevy** 允许我们自定义插件集，例如 `DefaultPlugins`，它允许我们覆盖任何核心 **Bevy** 插件的默认值，就像我们上面所做的那样。

无论我们向 `WindowPlugin` 的 `primary_window` 字段提供什么，都将成为我们传入的任何内容以及一个额外的 `PrimaryWindow` 组件的实体。

如果必须管理多个窗口，则此 `PrimaryWindow` 标记组件可用于管理游戏的主窗口。

```rust
use bevy::window::PrimaryWindow;

fn get_window_dimensions(window_query: Query<&Window, With<PrimaryWindow>>) {
  let window = window_query.single();

  info!(
    "The windows resolution is {:0.0} by {:0.0}",
    window.resolution.width(),
    window.resolution.height()
  )
}
```

## Reading and writing window data 读取和写入窗口数据

可以在 `Query` 中访问您的 `Window`，并且可以像其他组件一样修改其数据。

```rust
pub fn inspect_window(windows: Query<&Window>) {
  for window in windows.iter() {
    let focused = window.focused;
    println!("Window is focused: {:?}", focused);

    // The size after scaling:
    let logical_width = window.width();
    let logical_height = window.height();
    println!("Logical size: {:?} x {:?}", logical_width, logical_height);

    // The size before scaling:
    let physical_width = window.physical_width();
    let physical_height = window.physical_height();
    println!(
      "physical size: {:?} x {:?}",
      physical_width, physical_height
    );

    // Cursor position in logical sizes, this would return None if our
    // cursor is outside of the window:
    if let Some(logical_cursor_position) = window.cursor_position() {
      println!("Logical cursor position: {:?}", logical_cursor_position);
    }

    // Cursor position in physical sizes, this would return None if our
    // cursor is outside of the window:
    if let Some(physical_cursor_position) = window.physical_cursor_position() {
      println!("Physical cursor position: {:?}", physical_cursor_position);
    }
  }
}
```

### Changing the resolution 更改分辨率

例如，我们可以通过覆盖某些设置来更改分辨率：

```rust
// This system shows how to request the window to resize the resolution
fn adjust_resolution(
  keys: Res<ButtonInput<KeyCode>>,
  mut windows: Query<&mut Window>
) {
  let mut window = windows.single_mut();
  if keys.just_pressed(KeyCode::ArrowUp) {
    let scale_factor_override = window.resolution.scale_factor_override();

    window
      .resolution
      .set_scale_factor_override(scale_factor_override.map(|n| n + 1.0));
  }
}
```

更常见的是，可以设置某种分辨率设置，让其可以在固定大小之间切换：

```rust
/// Stores the various window-resolutions we can select between.
#[derive(Resource)]
struct ResolutionSettings {
  large: Vec2,
  medium: Vec2,
  small: Vec2,
}

fn toggle_resolution(
  keys: Res<ButtonInput<KeyCode>>,
  mut windows: Query<&mut Window>,
  resolution: Res<ResolutionSettings>,
) {
  let mut window = windows.single_mut();

  if keys.just_pressed(KeyCode::Digit1) {
    let res = resolution.small;
    window.resolution.set(res.x, res.y);
  }
  if keys.just_pressed(KeyCode::Digit2) {
    let res = resolution.medium;
    window.resolution.set(res.x, res.y);
  }
  if keys.just_pressed(KeyCode::Digit3) {
    let res = resolution.large;
    window.resolution.set(res.x, res.y);
  }
}
```

### Updating text 更新文本

我们还需要对 `Text` 等内容的变化做出反应：

```rust
/// Marker component for the text that displays the current resolution.
#[derive(Component)]
struct ResolutionText;

// This system shows how to respond to a window being resized.
// Whenever the window is resized, the text will update with the new resolution.
fn on_resize_system(
  mut q: Query<&mut Text, With<ResolutionText>>,
  mut resize_reader: EventReader<WindowResized>,
) {
  let mut text = q.single_mut();
  for e in resize_reader.read() {
    // When resolution is being changed
    text.0 = format!("{:.1} x {:.1}", e.width, e.height);
  }
}
```

更改窗口标题：

```rust
// This system will then change the title during execution
fn change_title(mut windows: Query<&mut Window>, time: Res<Time>) {
  let mut window = windows.single_mut();
  window.title = format!(
    "Seconds since startup: {}",
    time.elapsed().as_secs_f32().round()
  );
}
```

## Cursors 鼠标指针

`Cursor` 是我们与鼠标交互的接口。每个光标都有一个 `CursorGrabMode`，它允许我们定义窗口如何抓取用户光标：

```rust
pub enum CursorGrabMode {
  // The cursor can freely leave the window.
  #[default]
  None,
  // The cursor is confined to the window area.
  Confined,
  // The cursor is locked inside the window area to a certain position.
  Locked,
}
```

我们可以使用它来切换游戏中某些操作的光标。我们可以想象构建一个 FPS 并希望我们的光标不断将自身置于中心，以便在游戏过程中将鼠标锁定到游戏屏幕上：

```rust
use bevy::window::CursorGrabMode;

fn toggle_cursor(
  mut windows: Query<&mut Window>,
  input: Res<ButtonInput<KeyCode>>
) {
  if input.just_pressed(KeyCode::Space) {
    let mut window = windows.single_mut();

    window.cursor_options.visible = !window.cursor_options.visible;
    window.cursor_options.grab_mode = match window.cursor_options.grab_mode {
      CursorGrabMode::None => CursorGrabMode::Locked,
      CursorGrabMode::Locked | CursorGrabMode::Confined => CursorGrabMode::None,
    };
  }
}
```

## Reactive windows 响应式窗口

我们可以将窗口初始化为响应式而不是连续式：

```rust
use bevy::utils::Duration;

fn main() {
  App::new()
    .insert_resource(WinitSettings {
      focused_mode: bevy::winit::UpdateMode::Continuous,
      unfocused_mode: bevy::winit::UpdateMode::reactive_low_power(Duration::from_millis(10)),
    })
}
```

当你的窗口处于 `UpdateMode::reactive_low_power` 时，它只会在收到输入时重新渲染。这对于在应用程序不执行任何操作时节省 CPU 非常有用。

`UpdateMode::Continuous` 是默认值，它呈现应用程序的每个时钟周期。

这是一个完全全有或全无类型的设置，因此像 [`bevy_framepace`](https://github.com/aevyrie/bevy_framepace) 这样的 `crate` 可以帮助我们获得更多控制权。

`bevy_framepace`的工作方式与 `FixedUpdate` 系统类似，后者测量经过的时间，并根据增量手动触发其渲染管道。

## Taking a screenshot 屏幕截图

为了截取屏幕截图，我们在我们感兴趣的渲染目标上生成一个 `Screenshot` 组件。

为了实际保存它们，我们可以使用 `save_to_disk` 监听器。

```rust
use bevy::render::view::screenshot::{save_to_disk, Screenshot};

fn take_screenshot(
  mut commands: Commands,
  input: Res<ButtonInput<KeyCode>>,
  primary_window: Query<Entity, With<PrimaryWindow>>,
) {
  if input.just_pressed(KeyCode::Space) {
    let path = "screenshot.png";
    commands
      .spawn(Screenshot::primary_window())
      .observe(save_to_disk(path));
  }
}
```