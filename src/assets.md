# Assets 资产

资产是需要加载到我们游戏中的资源，例如：
- 纹理
- 音频
- **3D**模型
- 其他媒体文件

通常这些资源非常大，因此将它们全部加载到内存中会很慢且不可行。**Bevy**的资产系统努力使这种加载变得简单，并且能够异步完成。  

在**Bevy**中，资产通过两个关键资源进行管理：

- `Assets<T>`，中存储每种类型的加载资产
- `AssetServer`，用于异步从文件加载资源

## Adding assets 添加资产

要从文件系统添加资产，我们需要告诉`AssetServer`为我们`load`它们。改接口将返回加载资产的句柄。  

然后，我们将这些手柄附加到某种组件上，这些组件会将它们渲染到屏幕上。  

举个简单的例子，我们想从[Kenney.nl](https://kenney.nl/assets/car-kit)添加一个**3D** 的 **.glb** 文件。  

我们首先将其添加到项目根目录中的`./assets/models`文件夹中。

然后，我们可以使用`SceneBundle`将其加载到系统内：  

```rust
#[derive(Component)]
struct Car;

fn spawn_ambulance(
  mut commands: Commands,
  asset_server: Res<AssetServer>
) {
  let model = asset_server.load("models/ambulance.glb#Scene0");

  commands.spawn((
    Car,
    SceneBundle {
      scene: model,
      transform: Transform::from_xyz(0.0, 0.0, 0.0),
      ..default()
    },
  ));
}
```

我们还可以选择将`Handles`存储在资源中加载的资产，以便它们在其他系统中轻松使用：

```rust
#[derive(Resource)]
struct CarAssets {
  body: Option<Handle<Mesh>>,
}

fn load_car_body(
  asset_server: Res<AssetServer>,
  mut car: ResMut<CarAssets>
) {
  let car_handle = asset_server.load("models/cars/basic.gltf#Mesh0/Primitive0");
  car.body = Some(car_handle);
}
```

稍后，也许在其他系统中我们可以访问此资源：

```rust
fn spawn_car(car: Res<CarAssets>, mut commands: Commands) {
  if let Some(body) = car.body.as_ref() {
    commands.spawn(PbrBundle {
      mesh: body.clone(),
      ..default()
    });
  }
}
```

我们还可以通过代码创建资产：

```rust
use bevy::sprite::MaterialMesh2dBundle;

fn spawn_ball(
  mut commands: Commands,
  mut meshes: ResMut<Assets<Mesh>>,
  mut materials: ResMut<Assets<ColorMaterial>>,
) {
  let circle = Circle::new(BALL_SIZE);
  let color = Color::BLACK;

  // `Assets::add` will load these into memory and return a `Handle` (an ID)
  // to these assets. When all references to this `Handle` are cleaned up
  // the asset is cleaned up.
  let mesh = meshes.add(circle);
  let material = materials.add(color);

  // Here we are using `spawn` instead of `spawn_empty` followed by an
  // `insert`. They mean the same thing, letting us spawn many components on a
  // new entity at once.
  commands.spawn((MaterialMesh2dBundle {
    mesh: mesh.into(),
    material,
    ..default()
  },));
}
```

当需要在屏幕上绘制简单形状并为其设置动画时，这种资源加载非常适合较小的原型。

## Asset handles 资产句柄

当我们使用`Asset<T>`和`AssetServer`资源加载某些内容时，它们都会返回一个`Handle<T>`。  

这些[句柄](https://taintedcoders.com/rust/handles)就像指针，让我们在需要时获取实际资源，而不是直接传递它。句柄可以克隆为强句柄或弱句柄，并将由`Asset<T>`资源进行计数。  

当所有强句柄都被删除时，资产也会被删除并从内存中卸载。因此，为了保持我们的资源加载，它们必须至少在`Component`或`Resource`上引用。 

`AssetServer`加载的每个资源都会根据文件扩展名映射到`Handle<T>`：

![assets handles](https://i.imgur.com/pdTDFEV.png)

这些句柄是我们传递给其他组件的内容，然后这些组件又知道如何处理底层数据。这样它就可以只解决需要的问题。 

```rust
// From our table above we know that because of the `.glb`
// extension it will give us back a `Handle<Gltf>` provided by
// a `GltfLoader`
let model = asset_server.load("models/ambulance.glb#Scene0");

commands.spawn((
  Car,
  SceneBundle {
    scene: model,
    transform: Transform::from_xyz(0.0, 0.0, 0.0),
    ..default()
  },
));
```

## Asset events 资产事件

我们的资产在创建、修改或删除时会触发某些事件：

1. `AssetEvent::Created`
1. `AssetEvent::LoadedWithDependencies`
1. `AssetEvent::Modified`
1. `AssetEvent::Removed`
1. `AssetEvent::Unused`

这让我们能够对资产的变化做出反应： 

```rust
use bevy::asset::AssetEvent;

fn react_to_images(mut events: EventReader<AssetEvent<Image>>) {
  for event in events.read() {
    match event {
      AssetEvent::Added { id } => {
        // React to the image being created
      }
      AssetEvent::LoadedWithDependencies { id } => {
        // React to the image being modified
      }
      AssetEvent::Modified { id } => {
        // React to the image being modified
      }
      AssetEvent::Removed { id } => {
        // React to the image being removed
      }
      AssetEvent::Unused { id } => {
        // React to the last strong handle for the asset being dropped
      }
    }
  }
}
```

每个资产事件都会产生一个`AssetId<T>`，它是`Handle<T>`的较弱版本。`AssetId`可能指向不再存在的`Asset`。  

在大多数情况下，当您想要对表示资产“完全加载”的事件做出反应时，您应该使用`AssetEvent::LoadedWithDependencies`。  

## Asset sources 资产来源  

在**Bevy**`0.12`之前，只有一个资产源：文件系统。但之后的资产系统现在允许处理多种类型。  

这是通过`AssetSource`处理的，它从定义应用程序时指定的特定源中抽象查找资产：

```rust
fn main() {
  App::new()
    // This must be done before `AssetPlugin` (included in `DefaultPlugins`)
    // finalizes building assets.
    .register_asset_source(
      "other",
      AssetSourceBuilder::platform_default("assets/other", None),
    )
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, setup)
    .run();
}
```

通常资源来自`assets/`文件夹，但我们可以选择其他文件夹，例如`assets/other`或项目目录中的任何其他位置。  

```rust
fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
  commands.spawn(Camera2dBundle::default());

  let path = Path::new("some_image.png");
  let source = AssetSourceId::from("other");
  let asset_path = AssetPath::from_path(path).with_source(source);

  commands.spawn(SpriteBundle {
    texture: asset_server.load(asset_path),
    ..default()
  });
}
```

如果我们不想动态构造路径，我们也可以使用简写：

```rust
commands.spawn(SpriteBundle {
  texture: asset_server.load("other://some_image.png"),
  ..default()
});
```

## Asset server 资产服务器

`AssetServer`是一种在后台使用文件系统异步加载资源的资源。它负责跟踪其管理的资产的加载状态。  

```rust
fn spawn_boid(mut commands: Commands, asset_server: Res<AssetServer>) {
  // Spawns the bevy logo in the center of the screen
  commands.spawn(SpriteBundle {
    transform: Transform::from_xyz(0., 0., 0.),
    // The asset server will return a `Handle<Image>`
    // but that does not mean the asset has
    // been fully loaded yet.
    texture: asset_server.load("images/bevy.png"),
    ..default()
  });
}
```

资源是异步加载的。这意味着，当我们第一次生成此`SpriteBundle`时，即使资产服务器给我们返回了`Handle<Image>`，实际资产可能还不可用。  

我们可以使用`AssetServer::get_load_state`来检查资产是否已加载并可以在`Assets`集合中使用。  

## Loading assets 加载资源

首先，我们可以使用资产服务器从文件加载图像：

```rust
#[derive(Resource)]
struct BevyImage(Handle<Image>);

fn load_sprites(
  mut bevy_image: ResMut<BevyImage>,
  asset_server: Res<AssetServer>,
) {
  bevy_image.0 = asset_server.load("images/bevy.png");
}
```

这里我们加载图像并将`Handle<Image>`存储在资源中。然后在另一个系统中，我们可以查询该资产的加载状态，并且仅在我们知道资产已加载时生成我们的实体：

```rust
use bevy::asset::LoadState;

fn on_asset_event(
  mut commands: Commands,
  asset_server: Res<AssetServer>,
  bevy_image: Res<BevyImage>,
) {
  match asset_server.get_load_state(&bevy_image.0) {
    Some(LoadState::NotLoaded) => {}
    Some(LoadState::Loading) => {}
    Some(LoadState::Loaded) => {
      commands.spawn(SpriteBundle {
        transform: Transform::from_xyz(0., 0., 0.),
        texture: bevy_image.0.clone(),
        ..default()
      });
    }
    Some(LoadState::Failed(_)) => {}
    None => {}
  }
}
```

默认情况下，它会期望您的资产位于应用程序根目录内的`assets`文件夹中。

您可以通过设置以下环境变量之一来更改**Bevy**假定您的资产所在的位置：

- `BEVY_ASSET_ROOT`
- `CARGO_MANIFEST_DIR` 自动设置为您的 crate（工作区）的根文件夹。

提供的`assets.load`路径必须包含文件扩展名。  

您还可以如上所述定义单独的`AssetSource`。

## How assets are processed 资产如何处理

资产由`AssetProcessor`处理，该处理过程旨在崩溃后仍可从中断处继续。  

为此，**Bevy**使用预写日志记录来从崩溃中恢复。因此，它将努力避免在错误期间重新处理资产。  

该处理器将在您的资产旁边创建`.meta`文件，我们可以准确配置每个文件的加载或处理方式。

图像的元文件可能如下所示：  

```rust
(
  meta_format_version: "1.0",
  asset: Load(
    loader: "bevy_render::texture::image_loader::ImageLoader",
    settings: (
      format: FromExtension,
      is_srgb: true,
      sampler: Default,
    ),
  ),
)
```

我们可以编辑这些文件来自定义 Bevy 加载该特定图像的方式。

此处理是可选的，并通过在加载资源时设置`AssetServerMode`或`AssetMode`进行控制。

## Hot reloading 热重载

要启用热重载，建议使用可选的 Bevy 功能​​之一来实现：

```rust
[dependencies]
bevy = {
  version = "0.14.0",
  features = [
    "file_watcher",
    "embedded_watcher"
  ]
}
```

`file_watcher`功能将监视您的文件系统以了解资产的更改并热重载它们。  

`embedded_watcher`功能将监视内存中的资源，并在它们发生变化时进行热重载。  

我们还可以使用`watch_for_changes_override`设置来启用该功能：

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(AssetPlugin {
      watch_for_changes_override: Some(true),
      ..default()
    }))
    .run();
}
```

## Loading assets from a folder 从文件夹加载资源

如果我们有大量资产，我们可以通过将所有资产加载到一个系统中来使事情变得更容易：

```rust
use bevy::asset::LoadedFolder;

fn load_models(asset_server: Res<AssetServer>) {
  // You can load all assets in a folder like this. They will be loaded in
  // parallel without blocking
  let _scenes: Handle<LoadedFolder> = asset_server.load_folder("models/monkey");
}
```

这将加载`models/cars`文件夹中的所有资源。

## Custom asset loader 自定义资产加载器

如果您的资源不属于**Bevy**支持的正常文件类型，您可以创建自己的自定义资源加载器。  

首先，我们需要创建加载器、要加载的自定义资产以及可选的资产设置：  

```rust
use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct MyAssetLoader;

#[derive(Asset, TypePath)]
pub struct MyAsset {
  value: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct MyAssetSettings {
  some_setting: bool,
}
```

资产加载器有 3 种类型需要定义：  

- 资产类型
- 资产设置类型
- 错误类型

可以通过从库（例如`thiserror`）派生`Error`来定义错误：  

```rust
use thiserror::Error;

#[non_exhaustive]
#[derive(Debug, Error)]
pub enum MyAssetLoaderError {
  /// An [IO](std::io) Error
  #[error("Could load shader: {0}")]
  Io(#[from] std::io::Error),
}
```

定义了所有三种类型后，我们可以为自定义资源加载器实现`AssetLoader`：

```rust
use bevy::asset::{
    AssetLoader,
    LoadContext,
    io::Reader
};

use futures_lite::AsyncReadExt;

impl AssetLoader for MyAssetLoader {
  type Asset = MyAsset;
  type Settings = MyAssetSettings;
  type Error = MyAssetLoaderError;

  async fn load<'a>(
    &'a self,
    reader: &'a mut Reader<'_>,
    _settings: &'a MyAssetSettings,
    _load_context: &'a mut LoadContext<'_>,
  ) -> Result<Self::Asset, Self::Error> {
    let mut bytes = Vec::new();
    reader.read(&mut bytes).await?;
    // convert bytes to value somehow
    let value = "Hello World!";
    Ok(MyAsset {
      value: value.into(),
    })
  }

  fn extensions(&self) -> &[&str] {
    &["thing"]
  }
}
```  

要使用读取器读取异步值，您需要使用`futures_lite`扩展，否则您将收到错误，表明读取器未将`read`方法定义为其仍为未来值。  

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .init_asset_loader::<MyAssetLoader>()
    .init_asset::<MyAsset>()
    .run();
}
```
