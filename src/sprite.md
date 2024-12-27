# Sprites 精灵

`Sprite` 表示我们想要[渲染](./rendering.md)的图像。

在 **Bevy** 中，`Sprite` 保存特定纹理的位置、颜色和大小数据。

当我们谈论纹理时，我们实际上是指为[光栅图形](https://en.wikipedia.org/wiki/Raster_graphics)表示的任何图像数据，它使用二维图片作为像素颜色值的矩阵。

我们将这些图像加载到我们的[资产](./assets.md)中，并将它们添加到具有 `Sprite` 组件的实体中，该组件将使用 GPU 将它们渲染到我们的游戏中。

## Rendering a sprite 渲染精灵

为了渲染 `sprite` ，我们将 `SpriteBundle` 添加到实体中：

```rust
fn spawn_player(mut commands: Commands, asset_server: Res<AssetServer>) {
  commands.spawn((
    SpriteBundle {
      transform: Transform::default(),
      texture: asset_server.load("sprites/ball.png"),
      ..default()
    },
    Player,
  ));
}
```
这将在屏幕中央生成一个图像。`sprite` 的大小将是其自然图像尺寸。

### Changing the sprite size 更改精灵大小

我们可以通过在添加 `sprite` 时提供自定义尺寸来控制 `sprite` 的大小：

```rust
fn spawn_player_with_custom_size(
  mut commands: Commands,
  asset_server: Res<AssetServer>,
) {
  commands.spawn((
    SpriteBundle {
      texture: asset_server.load("sprites/ball.png"),
      sprite: Sprite {
        custom_size: Some(Vec2::new(100., 100.)),
        ..default()
      },
      ..default()
    },
    Player,
  ));
}
```

我们还可以选择设置其  `Transform`  的比例。


### Sprites load from your assets folder 从 assets 文件夹加载精灵

默认情况下，Bevy 将从 `./assets` 文件夹加载您的资产。所以当我们写：

```rust
asset_server.load("sprites/ball.png")
```

**Bevy** 将加载 `./assets/sprites/ball.png`。`load` 方法将返回一个 `Handle<Image>`，我们将其作为组件添加到我们的玩家实体中。

请记住，`AssetServer` 不会立即加载图像。

相反，它返回一个 [handle](./handles.md) 组件：`Handle<Image>` 并将其添加到我们的实体中。在图像完全加载之前，`sprite` 实际上不会渲染。

## Use a SpriteBundle to spawn sprites 使用 SpriteBundle 生成 Sprite

`SpriteBundle` 仅包含一对 `Sprite` 和 `Handle<Image>` 组件，以及一组其他组件，这些组件有助于在渲染器中定位它：

```rust
// https://docs.rs/bevy/latest/bevy/sprite/prelude/struct.SpriteBundle.html
pub struct SpriteBundle {
  // Unique to a sprite bundle:
  pub sprite: Sprite,
  pub texture: Handle<Image>,

  // `SpatialBundle` components:
  pub visibility: Visibility,
  pub inherited_visibility: InheritedVisibility,
  pub view_visibility: ViewVisibility,
  pub transform: Transform,
  pub global_transform: GlobalTransform,
}
```

将其与 `SpatialBundle` 进行比较，后者将与实体的正确位置渲染相关的所有组件分组：

```rust
// https://docs.rs/bevy/latest/bevy/prelude/struct.SpatialBundle.html
pub struct SpatialBundle {
  pub visibility: Visibility,
  pub inherited_visibility: InheritedVisibility,
  pub view_visibility: ViewVisibility,
  pub transform: Transform,
  pub global_transform: GlobalTransform,
}
```

`Sprite` 只是一个组件，它准确地表示如何显示我们附加到实体的纹理：

```rust
// https://docs.rs/bevy/latest/bevy/sprite/struct.Sprite.html
#[repr(C)]
pub struct Sprite {
  pub color: Color,
  pub flip_x: bool,
  pub flip_y: bool,
  pub custom_size: Option<Vec2>,
  pub rect: Option<Rect>,
  pub anchor: Anchor,
}
```

宏  `#[repr(C)]`  告诉 **rust** 编译器按照 **C** 语言中的方式创建这个结构体。

**Bevy** 之所以这样做，是因为它最终会通过 **FFI** 边界传递此 `sprite`，以便由用 **C** 语言编写的库进行处理。

## Sprites are anchored Sprite 需要锚点

如果你的摄像机以 `(0, 0)` 为中心，你会注意到 sprite 出现在屏幕的死点。这是因为 sprite 的默认 `Anchor` 是 `Anchor::Center`。

`Sprite` 的锚点字段决定了 `Sprite` 相对于其 `transform` 的定位方式：

```rust
// https://docs.rs/bevy/latest/bevy/sprite/enum.Anchor.html
pub enum Anchor {
  Center,
  BottomLeft,
  BottomCenter,
  BottomRight,
  CenterLeft,
  CenterRight,
  TopLeft,
  TopCenter,
  TopRight,
  Custom(Vec2),
}
```

`Custom(Vec2)` 值将按 `Sprite` 的大小进行比例运算。因此，您不需要知道 sprite 的确切物理大小，只需使用相对值即可。

所以左上角是 `(-0.5, 0.5)`中间是 `(0., 0.)`。

## Stacking sprites 堆叠 Sprite

生成 `sprite` 时，其  `Transform`  的  `z`  值将决定其绘制顺序。

如果希望一个 `sprite` 在另一个 `sprite` 之前渲染，则需要将其 `z-index` 设置为高于在后台显示的 `sprite`。

```rust
fn setup_game(mut commands: Commands, asset_server: Res<AssetServer>) {
  // z-index is 0. so it will get spawned behind
  commands.spawn((
    SpriteBundle {
      transform: Transform::default(),
      texture: asset_server.load("sprites/grass.png"),
      ..default()
    },
    Tile,
  ));

  // z-index is 1. so it will get spawned in front of our grass tile
  commands.spawn((
    SpriteBundle {
      transform: Transform::from_xyz(0., 0., 1.),
      texture: asset_server.load("sprites/ball.png"),
      ..default()
    },
    Player,
  ));
}
```

`ball.png` `Sprite` 将会显示在 `grass.png` `Sprite` 上面。

## Creating a sprite sheet 创建 Sprite 表

有时我们想要动画的 `sprite`，或者我们可以在运行时更改它们的纹理。为此，我们使用 `SpriteSheetBundle`。

这与 `SpriteBundle` 相同，只是它需要一个需要 `TextureAtlasLayout`的 `TextureAtlas`。

`TextureAtlasLayout` 是有关如何分解 `spritesheet` （如瓦片地图）的容器。因此，我们提供了 `layout` 参数，然后使用 `layout` 来切片任何 `sprite` 表。

要加载 `sprite` 表，一种常见的模式是在为其定义  `FromWorld`  的资源中执行加载：

```rust
#[derive(Resource)]
struct PlayerSpriteSheet(Handle<TextureAtlasLayout>);

impl FromWorld for PlayerSpriteSheet {
  fn from_world(world: &mut World) -> Self {
    let texture_atlas = TextureAtlasLayout::from_grid(
      (24, 24).into(), // The size of each image
      7,               // The number of columns
      1,               // The number of rows
      None,            // Padding
      None,            // Offset
    );

    let mut texture_atlases = world
      .get_resource_mut::<Assets<TextureAtlasLayout>>()
      .unwrap();
    let texture_atlas_handle = texture_atlases.add(texture_atlas);
    Self(texture_atlas_handle)
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .init_resource::<PlayerSpriteSheet>()
    .run();
}
```

在本例中，我们正在加载一个新的纹理图集布局，我们可以将其应用于图像以获取精灵表。我们的布局初始化为： 

- 7列
- 1行
- 精灵每帧图像大小为 `24x24` 。

然后我们可以轻松地引用这个布局并在我们的其他系统中创建精灵表：

```rust
fn spawn_player_sprite(
  mut commands: Commands,
  sprite_atlas: Res<PlayerSpriteSheet>,
  asset_server: Res<AssetServer>,
) {
  let sprite: Handle<Image> = asset_server.load("animations/player.png");

  commands.spawn((
    SpriteBundle {
      texture: sprite.clone(),
      ..default()
    },
    TextureAtlas {
      layout: sprite_atlas.0.clone(),
      index: 0,
    },
  ));
}
```

纹理图集将根据一系列表示图像在精灵表上的像素位置的 `Vec<Rect>` 来分割图像。我们刚刚创建的相同布局可以用于许多图像，如果您使用许多固定大小的精灵表，这会很方便。

### Texture atlases 纹理图集

在单个文件中存储许多纹理是很常见的。精灵表或图块地图可以包含布置在 2D 网格上的数百个纹理。

**Bevy** 使用 `TextureAtlas` 的概念，其中包含 `TextureAtlasLayout` 和 `index`，这使得处理这些类型的文件变得更加容易。

每个 `TextureAtlasLayout` 也是一个 `Asset`，如图像、网格等。因此添加它们需要使用资源服务器加载它们并保留对 `Handle<TextureAtlasLayout>`。

通常，我们将这些引用存储在资源中，以便我们可以在其他系统中轻松引用它们。但是没有什么可以阻止您将其存储为实体上的组件。

### Texture atlas builder 纹理图集生成器

`TextureAtlas` 假设您给它一个图像文件，它会将其分割成许多纹理。

一些工作流程将精灵表分成许多单独的文件。如果我们有许多_单独的图*_并且想要将它们组合成_单个_精灵表，我们可以使用`TextureAtlasBuilder`。

首先，我们需要在游戏早期加载纹理。这可以在上面示例中的  `FromWorld`  实现中完成，但出于多样性考虑，我们将从启动系统加载它：

```rust
// https://github.com/bevyengine/bevy/blob/release-0.14.2/examples/2d/texture_atlas.rs
#[derive(Resource, Default)]
struct RpgSpriteFolder(Handle<LoadedFolder>);

fn load_textures(mut commands: Commands, asset_server: Res<AssetServer>) {
  let folder = RpgSpriteFolder(asset_server.load_folder("textures/rpg"));

  // load multiple, individual sprites from a folder
  commands
    .insert_resource(folder);
}
```

这将加载  `./assets/textures/rpg`  中的每个文件。

稍后，在它们加载后，我们可以创建纹理图集：

```rust
fn create_texture_atlas(
  loaded_folders: Res<Assets<LoadedFolder>>,
  rpg_sprite_handles: Res<RpgSpriteFolder>,
  mut atlases: ResMut<Assets<TextureAtlasLayout>>,
  mut textures: ResMut<Assets<Image>>,
) {
  let mut builder = TextureAtlasBuilder::default();
  let folder = loaded_folders.get(&rpg_sprite_handles.0).unwrap();

  for handle in folder.handles.iter() {
    let id = handle.id().typed_unchecked::<Image>();

    let Some(texture) = textures.get(id) else {
      warn!("Texture not loaded: {:?}", handle.path().unwrap());
      continue;
    };

    builder.add_texture(Some(id), texture);
  }

  let (atlas, texture) = builder.build().unwrap();
  textures.add(texture);
  atlases.add(atlas);
}
```

对于字体图集或动态阴影贴图等高级用例，还有  `DynamicTextureAtlasBuilder`，它可以在运行时以低廉的成本进行更新，而不是最终确定。然而，不鼓励将其用于带有动画的精灵表。

## Getting the bounding box of transformed sprites 获取变换后的精灵的边界框

精灵图像尺寸可能与屏幕上图像的物理尺寸不完全相同。

精灵的渲染方式由其 `Transform` 比例或 `custom_size`（如果提供）决定。这意味着显示器上精灵的图像尺寸（物理尺寸）可能与其在游戏世界中的逻辑尺寸不同。

因此，为了获得真实的逻辑尺寸，我们应该对图像的原始尺寸应用相同的缩放。一个简单的方法是使用 `Rect` 来表示它：

```rust
fn print_sprite_bounding_boxes(
  mut sprites: Query<(&Transform, &Handle<Image>), With<Sprite>>,
  assets: Res<Assets<Image>>,
) {
  for (transform, image_handle) in &mut sprites {
    let image_size = assets.get(image_handle).unwrap().size_f32();

    info!("image_dimensions: {:?}", image_size);
    info!("position: {:?}", transform.translation);
    info!("scale: {:?}", transform.scale);

    let scaled = image_size * transform.scale.truncate();
    let bounding_box =
      Rect::from_center_size(transform.translation.truncate(), scaled);

    info!("bounding_box: {:?}", bounding_box);
  }
}
```

控制台的输出将是：

```
image_dimensions: Vec2(288.0, 288.0)
position: Vec3(0.0, 0.0, 0.0)
scale: Vec3(0.1, 0.1, 0.1)
scaled_image_dimension: Vec2(28.800001, 28.800001)
bounding_box: Rect {
    min: Vec2(-14.400001, -14.400001),
    max: Vec2(14.400001, 14.400001)
}
```

## Clicking on our sprites 点击精灵

上面的代码将返回游戏世界中精灵边界的逻辑值。然而，如果我们想点击它，我们就会遇到一个大问题：

实际的鼠标光标需要根据我们当前`Camera`的视图进行投影。过去，这必须手动完成，并涉及计算标准化设备坐标。但最近  `Camera`  组件有一些方法可以帮助我们：

```rust
fn cast_cursor_ray(
  windows: Query<&Window>,
  cameras: Query<(&Camera, &GlobalTransform)>,
) {
  let window = windows.single();
  let (camera, position) = cameras.single();

  // check if the cursor is inside the window and get its position
  // then, ask bevy to convert into world coordinates, and truncate to discard Z
  if let Some(world_position) = window
    .cursor_position()
    .and_then(|cursor| camera.viewport_to_world(position, cursor))
    .map(|ray| ray.origin.truncate())
  {
    info!("World coords: {}/{}", world_position.x, world_position.y);
  }
}
```

标准化设备坐标将是 `Vec3`，其范围为 `x` 和 `y` 中的 `(-1, 1)`方向和 `z` 轴上的 `(0, 1)`。

这些标准化的设备坐标允许我们将鼠标投射到游戏世界中，以给出游戏世界中鼠标的逻辑值，无论我们的相机如何放大或缩小。

然后，我们可以检查这些坐标是否位于边界框的  `Rect`  内，以注册单击事件并在其他系统中对它们做出反应。

## How sprites are rendered 精灵是如何渲染的

精灵的渲染是通过 wgpu 将纹理加载到 GPU 上来高效渲染的。

要进行任何后期处理，我们可以设置一个特定的  `Camera`  来仅渲染我们的精灵并向其添加额外的处理。

当渲染系统消耗精灵时，您的  `Sprite`  组件在提供给渲染管道之前会扩展为  `ExtractedSprite`。

最后，精灵被批处理到包含  `SpriteBatch`  组件的实体中，这有助于加快渲染速度。此批处理对前面提到的 z-index 很敏感，它将决定渲染顺序。

**Bevy** 会自动为屏幕外的精灵设置  `ComputedVisibility`，并且渲染系统不会尝试渲染它们。

## Pixel perfect rendering 像素完美渲染

默认情况下，图像是抗锯齿的，这使得它们的边缘在放置时稍微模糊。这可能会导致精灵中出现“出血”，并且可能会在精灵的边缘出现不应该出现的线条。

当在游戏中使用大部分精灵时，您需要通过将  `ImagePlugin`  设置为使用最近邻采样来防止精灵模糊：

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(ImagePlugin::default_nearest()))
    .init_resource::<PlayerSpriteSheet>()
    .run();
}
```

默认值是线性插值，这会使精灵的边缘看起来模糊。最近邻采样将保留硬边缘并使精灵看起来像素完美。

