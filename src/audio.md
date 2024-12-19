# Audio 音频

**Bevy**的音频系统为您提供基础知识。您可以播放声音和控制音量，甚至可以在空间上。  

音频是通过实体组件系统完成的，方法是将某些组件添加到`AudioPlugin`用于播放声音的实体中。  

`AudioSource`保存音频数据并连接到`AudioSink`，这通常通过生成`AudioBundle`来完成。  

## Playing audio 播放音频

我们可以通过在任何实体上生成`AudioBundle`来触发声音播放。  

```rust
fn play_background_audio(
  asset_server: Res<AssetServer>,
  mut commands: Commands
) {
  // Create an entity dedicated to playing our background music
  commands.spawn(AudioBundle {
    source: asset_server.load("background_audio.ogg"),
    settings: PlaybackSettings::LOOP,
  });
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, play_background_audio)
    .run();
}
```

加载资源后，音乐将开始循环播放，直到我们生成的这个实体消失或组件被移除。  

此音频的实际播放发生在`AudioPlugin`中添加的系统中。系统会将一个`AudioSink`添加到我们刚刚添加的`AudioBundle`中，它将控制播放。  

数据必须是**Bevy**支持的文件格式之一：

- `wav`
- `ogg`
- `flac`
- `mp3`

**Bevy**默认包含`ogg`，但对于其他音频格式，您需要在`Cargo.toml`中包含该功能：

```toml
[dependencies]
bevy = { version = "0.14.2", features = ["mp3"] }
```

内置的播放设置：  

![img](https://i.imgur.com/ikswDzQ.png)

## Controlling playback 控制播放

为了控制`AudioBundle`的播放，我们可以使用`AudioPlugin`在生成实体时添加的`AudioSink`：  

```rust
fn volume_system(
  keyboard_input: Res<ButtonInput<KeyCode>>,
  music_box_query: Query<&AudioSink, With<MusicBox>>
) {
  if let Ok(sink) = music_box_query.get_single() {
    if keyboard_input.just_pressed(KeyCode::Equal) {
      sink.set_volume(sink.volume() + 0.1);
    } else if keyboard_input.just_pressed(KeyCode::Minus) {
      sink.set_volume(sink.volume() - 0.1);
    }
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, play_background_audio)
    .add_systems(Update, volume_system)
    .run();
}
```
音频接收器还可以`set_speed`和`toggle`来播放或停止音频。

## Spatial audio 空间音频

上面的示例将为我们提供给`bundle`的任何源播放平坦的未修改声音。

要全局更改我们的空间音频设置，我们可以设置音频插件设置：

```rust
use bevy::audio::{SpatialScale, AudioPlugin};
const AUDIO_SCALE: f32 = 1. / 100.;

fn main() {
  App::new()
    .add_plugins(DefaultPlugins.set(AudioPlugin {
      default_spatial_scale: SpatialScale::new_2d(AUDIO_SCALE),
      ..default()
    }))
    .run();
}
```

然后，为了播放声音，我们可以添加一个带有`SpatialListener`组件的监听器，并将它们相对于发出声音的任何实体移动：

```rust
fn play_2d_spatial_audio(
  mut commands: Commands,
  asset_server: Res<AssetServer>
) {
  // Spawn our emitter
  commands.spawn((
    Player,
    AudioBundle {
      source: asset_server.load("flight_of_the_valkaries.ogg"),
      settings: PlaybackSettings::LOOP
    }
  ));

  // Spawn our listener
  commands.spawn((
    SpatialListener::new(100.), // Gap between the ears
    SpatialBundle::default()
  ));
}
```

这将生成一个玩家实体，并从其位置发出声音。例如，周围的其他玩家可以根据他们离我们的距离多远来听到它。

## Volume 音量

我们的应用程序有两个独立的音量来源：

1. Global volume 全局音量
1. Audio sink volume 音频接收器音量

要更改全局音量，我们修改`GlobalVolume`资源：

```rust
use bevy::audio::Volume;

fn change_global_volume(
  mut volume: ResMut<GlobalVolume>,
) {
  volume.volume = Volume::new(0.5);
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .insert_resource(GlobalVolume::new(0.2))
    .add_systems(Startup, change_global_volume)
    .run();
}
```

然后，对于各个音频接收器，我们可以使用系统内的公共接口来修改其各自的值：

```rust
fn volume_system(
  keyboard_input: Res<ButtonInput<KeyCode>>,
  music_box_query: Query<&AudioSink, With<MusicBox>>
) {
  if let Ok(sink) = music_box_query.get_single() {
    if keyboard_input.just_pressed(KeyCode::Equal) {
      sink.set_volume(sink.volume() + 0.1);
    } else if keyboard_input.just_pressed(KeyCode::Minus) {
      sink.set_volume(sink.volume() - 0.1);
    }
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Update, volume_system)
    .run();
}
```

## Internals 内部结构

在内部，**Bevy**使用[rodio](https://docs.rs/rodio/latest/rodio/index.html)来解码这些源。

`AudioBundle`由`source`和一些控制播放的`settings`组成：

```rust
// https://github.com/bevyengine/bevy/blob/5c759a1be800209f537bea31d32b8ba7e966b0c1/crates/bevy_audio/src/audio.rs#L229
pub type AudioBundle = AudioSourceBundle<AudioSource>;

pub struct AudioSourceBundle<Source = AudioSource>
where
  Source: Asset + Decodable,
{
  // Asset containing the audio data to play.
  pub source: Handle<Source>,
  // Initial settings that the audio starts playing with.
  // If you would like to control the audio while it is playing,
  // query for the [`AudioSink`][crate::AudioSink] component.
  // Changes to this component will *not* be applied to already-playing audio.
  pub settings: PlaybackSettings,
}
```

`Decodable`特征允许**Bevy**将源文件转换为`rodio`兼容的`rodio::Source`类型。实现此特征的类型将保存原始声音数据，然后将其转换为样本迭代器。