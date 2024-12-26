# Rendering 渲染

**Bevy** 中的渲染是通过 wgpu 库完成的。这允许 **Bevy** 在本机和基于 Web 的环境中进行渲染。

 `wgpu` 是一个基于 `WebGPU API` 的 **Rust** 安全可移植图形库。

在 **Bevy** 中，每一帧都有两件大事发生：

- 模拟我们得游戏运行逻辑
- 渲染屏幕上的内容

这两个部分是并行完成的，而渲染则是迄今为止更不熟悉的幕后工作。

早期的 **Bevy** 渲染管道过于复杂，其中存在自行发明的抽象，这使得它很难学习。`Sprite` 渲染速度很慢，并且很难渲染到多个[窗口](./window.md)。它还以落后的自定义方式实现了 wgpu。

在 **Bevy** `0.6` 中，我们完成了第一个渲染管道的实现，它更快、更简单、模块化并提供更美观的渲染。

新渲染器也是“ECS 驱动的”，这意味着“渲染世界”填充了从“主世界”提取的数据。这也意味着可以使用其他渲染组件修改摄像机等视图。

由于在屏幕上绘制内容的成本相当高，因此 **Bevy** 会自动使用摄像机的视点来确定要绘制哪些内容，以及要忽略哪些内容，此过程称为“视锥体剔除”。

## The Render Pipeline 渲染管线

**Bevy** 渲染管道有 5 个步骤：

1. **提取**，其中渲染所需的所有信息都取自游戏世界
2. **准备**，设置所有顶点数据并写入顶点缓冲区的位置
3. **排队**，获取创建的管道，设置绑定组并将实体添加到“渲染阶段”（我们将用于执行绘制调用的项目列表）
4. **渲染图**，它位于正常的 ECS 和系统流之外，并调用生成绘制调用的每个节点
5. **Draw 函数**，我们使用上一步生成的 `RenderCommand` 在屏幕上执行实际绘图

### Extraction 提取

此步骤的目标是从游戏世界中提取我们需要的所有数据，以便模拟和渲染可以继续进行，而无需相互担心。

它充当同步点，因此模拟和渲染都将在此步骤中锁定，并且在此步骤完成之前无法继续。

由于它的阻塞性质，因此必须尽可能快地保持此步骤，并且只复制值，而不需要任何繁重的算法。

两个系统将会添加到我们得应用：一个用于提取摄像机视图，另一个用于提取 UI 节点。此系统生成一个 `ExtractedView` 组件，该组件被包装到队列步骤期间使用的渲染阶段。

我们需要 `ExtractedView`，它考虑了我们的摄像机视图，以便我们可以将节点相对于其视点投影到屏幕上。

### Prepare 准备

这里我们的目标是写入点并将组数据绑定到  `UiMeta`  资源。

### Queue 队列

在这里，我们通过告诉 GPU 我们如何在前面的准备步骤中布置顶点数据来设置 `UiPipeline`。

然后，我们设置顶点和片段着色器。**Bevy** 还使用一些缓存来检查此管道的句柄，以查看它是否已更改，否则我们可以缓存结果。

### Render Graph 渲染图

在此步骤中，我们将创建一个非循环渲染图，其中包含在屏幕上渲染节点的所有步骤。

渲染图是一种以模块化方式对 GPU 命令构造进行逻辑建模的方法。图形节点将纹理和缓冲区等 GPU 资源（有时是实体）相互传递，形成有向无环图。

当图形节点运行时，它使用其图形输入和 Render World 来构建 GPU 命令列表。

渲染图还支持可由任何节点调用的子图（基本上是命名空间图）（例如，“2d”子图和“3d”子图用于游戏的不同部分或多个窗口）。

这还将调用 wgpu 以开始渲染通道。

### Draw functions 绘制函数

我们的渲染通道已经开始，我们开始渲染我们的阶段项。

对于我们添加到渲染阶段的每个项目，我们在 `DrawFunction` 上调用 `draw`。

`Draw`  实际上只是一个我们可以自己实现或使用  `RenderCommand`  的 trait。

`RenderCommand`  本身可以是  `RenderCommand`  的元组。

## Textures 纹理

纹理是指用于向 3D 模型表面添加细节、颜色和图案的二维图像。纹理通常是在 Photoshop 或 GIMP 等图像编辑软件中创建的。

它们可以是简单的图像，例如木纹的图片，也可以是定义材质不同方面的复杂贴图，例如漫反射贴图、法线贴图、镜面反射贴图等。

纹理通常以 PNG 或 JPEG 等格式存储为文件。

`TextureAtlas`  用于瓦片地图或 Sprite 地图并对其进行导航。

## Materials 材质

`Material`定义光线与对象表面的交互方式。它确定视觉属性，例如颜色、反射率、光泽度、透明度等。

纹理将应用于材质。你可以将纹理视为对象外观的视觉细节，而材质包含有关纹理在给定环境下应如何显示的规则。

在 **Bevy** 中，材质是使用着色器定义的，着色器是在 GPU 上运行的程序，用于计算光线如何与对象的几何体交互。

[基于物理的渲染 （Physical based rendering，PBR）](https://google.github.io/filament/Material%20Properties.pdf)  使用一系列属性来模拟现实：

-   Color 颜色
-   Metalic 金属
-   Roughness 粗糙度
-   Reflectance 反射系数
-   Clear coat 透明图层
-   Clear coat roughness 透明涂层粗糙度
-   Anisotrophy (shapliness) 各向异性

## Meshes 网格

渲染游戏对象时，网格提供应用纹理和材质的底层几何体。

网格的顶点存储位置信息，这些信息决定了对象的形状和结构。边连接顶点，面定义形成对象可见表面的多边形。

纹理通常使用 UV 坐标映射到网格上，UV 坐标定义纹理图像如何包裹在几何体周围。UV 坐标将网格表面上的特定点分配给纹理图像中的相应像素。

该材质负责确定光线如何被网格的不同部分反射或吸收，从而赋予其特定的视觉外观。

在 **Bevy** 中，我们提供了一些表示常见形状的内置网格：

-   `Cube`
-   `Box`
-   `Quad`  (deprecated in  `0.13`, replaced with  `Rectangle`)`Quad`  
-   `Rectangle`
-   `Plane`
-   `Capsule`
-   `Cylinder`
-   `Icosphere`  a sphere made from a subdivided Icosahedron.
-   `RegularPolygon`
-   `Torus`
-   `UVSphere`  a sphere made of sectors and stacks.

## Rendering entities 渲染实体

实际上，我们可以通过为实体提供  `Material`（包含  `Texture`）和  `Mesh`  来在屏幕上渲染实体：

```rust
use bevy::{
  color::palettes::css::RED,
  math::prelude::*, prelude::*,
  sprite::MaterialMesh2dBundle,
};

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, setup)
    .run();
}

fn setup(
  mut commands: Commands,
  mut meshes: ResMut<Assets<Mesh>>,
  mut materials: ResMut<Assets<ColorMaterial>>,
  asset_server: Res<AssetServer>,
) {
  // Spawn our viewport so we can see things
  commands.spawn(Camera2dBundle::default());

  let red: Color = RED.into();
  let circle = Circle::new(50.);

  // Circle mesh
  commands.spawn(MaterialMesh2dBundle {
    mesh: meshes.add(circle).into(),
    material: materials.add(ColorMaterial::from(red)),
    transform: Transform::from_xyz(-150., 0., 0.),
    ..default()
  });

  // Sprite
  commands.spawn(SpriteBundle {
    texture: asset_server.load("enemy.png"),
    transform: Transform::from_translation(Vec3::new(-50., 0., 0.)),
    ..default()
  });
}
```

对 `into()` 的调用让你的编译器弄清楚如何将更基本的类型更改为函数期望的类型，而不必手动转换。它通过在相应类型上实施 `From` 和 `Into` 特征来实现此目的。

当我们调用  `materials.add`  或  `meshes.add`  时，我们在`Assets`中插入了一个`Asset`，并得到了一个[句柄](https://taintedcoders.com/rust/handles)。它还会创建一个  `AssetEvent::Created`，如果我们愿意，我们可以在其他系统中读取它。

## Text 文本

**Bevy** 中的默认文本大小为  `24px`。要更改任何默认样式，我们渲染两个捆绑包中的一个并传入我们自己的  `TextStyle`。

我们可以使用  `Text2dBundle`  将文本渲染为场景的一部分：

```rust
fn spawn_text(asset_server: ResMut<AssetServer>, mut commands: Commands) {
  let font = asset_server.load("fonts/FiraSans-Bold.ttf");
  let text_style = TextStyle {
    font: font.clone(),
    font_size: 60.0,
    color: Color::WHITE,
  };

  let text = Text::from_section("translation", text_style.clone());

  // 2d camera
  commands.spawn(Camera2dBundle::default());
  // Demonstrate changing translation
  commands.spawn(Text2dBundle {
    text: text.with_justify(JustifyText::Center),
    ..default()
  });
}
```

或者使用  `TextBundle`  将其作为 UI 的一部分呈现：

```rust
fn spawn_text_bundle(
  asset_server: ResMut<AssetServer>,
  mut commands: Commands,
) {
  commands.spawn(
    // Create a TextBundle that has a Text with a single section.
    TextBundle::from_section(
      // Accepts a `String` or any type that converts into a `String`, such as `&str`
      "hello\nbevy!",
      TextStyle {
        font: asset_server.load("fonts/FiraSans-Bold.ttf"),
        font_size: 100.0,
        color: Color::WHITE,
      },
    ) // Set the alignment of the Text
    .with_text_justify(JustifyText::Center)
    // Set the style of the TextBundle itself.
    .with_style(Style {
      position_type: PositionType::Absolute,
      bottom: Val::Px(5.0),
      right: Val::Px(15.0),
      ..default()
    }),
  );
}
```

## Lighting 照明

常见照明捆绑包（**Bevy** `0.15` 官方已经在库包中不再使用捆绑包，当然开发者依然可以使用）：

- `PointLightBundle`从中心点向各个方向发射光的光
- `SpotLightBundle`从中心点向给定方向发射光的光
- `DirectionalLightBundle`来自非常远的地方的定向光（如太阳）

