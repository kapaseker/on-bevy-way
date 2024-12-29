# Timers 定时器

计时器可以创建为资源或组件。 `Timer` 本身并没有多大作用。由我们来`tick`，直到完成。

定时器有两种模式：

- `TimerMode::Once` 一次会减至 0，只能手动重置
- `TimerMode::Repeat` 将滴答至 0，然后自动重置

在 **Bevy** 中，计时器不会从其初始值开始计时。相反，它们从零开始计时，直到达到`Duration`。

然后，我们可以调用 `finished` 或 `just_finished` 在完成后切换行为。

## Timers as a resource 计时器作为资源

当我们想要一个不属于游戏中特定实体的计时器时，资源非常有用。例如，假设我们想要为火箭联盟这样的比赛编写一个计时器。

比赛计时器作为一个单独的实体是没有意义的，我们只想生成一个单独的计时器。

所以我们可以为自己创建一个资源：

```rust
#[derive(Resource)]
pub struct MatchTime(Timer);

impl MatchTime {
  pub fn new() -> Self {
    Self(Timer::from_seconds(60.0, TimerMode::Once))
  }
}

// We need to implement Default so that our timer can be initialized as
// a resource when we call `init_resource`
impl Default for MatchTime {
  fn default() -> Self {
    Self::new()
  }
}
```

我们创建一个 `MatchTime` 资源并实现 `Default`，以便在定义应用程序时可以轻松初始化它。这使得它在游戏开始时就可用，无需任何额外设置。

```rust
fn countdown(
  time: Res<Time>,
  mut match_time: ResMut<MatchTime>
) {
  match_time.0.tick(time.delta());
}

fn end_match(match_time: Res<MatchTime>) {
  if match_time.0.finished() {
    // Here we would rest our game
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .init_resource::<MatchTime>()
    .add_systems(Update, (countdown, end_match.after(countdown)))
    .run();
}
```

比赛时间不会自行滴答作响。我们需要一个系统，根据自上次价格变动以来经过的时间进行更新。

**Bevy** 有一个内置的 `Time` 资源，我们可以使用它来获取此 `tick` 和最后一个 `tick` 之间的秒`delta`。我们只需根据此值提前计时即可。

## Timers as a component 计时器作为组件

现在假设我们想为我们的一个技能设置`Cooldown`。这作为资源没有意义，因为冷却时间是特定于我们的一位玩家的。

```rust
#[derive(Component)]
struct Cooldown(Timer);

#[derive(Component)]
struct Player;

fn cast_spell(
  mut commands: Commands,
  mut player_query: Query<Entity, With<Player>>,
  cooldowns: Query<&Cooldown, With<Player>>,
) {
  let player = player_query.single();

  if let Ok(cooldown) = cooldowns.get(player) {
    info!(
      "You cannot cast yet. Your cooldown is {:0.0}% complete!",
      cooldown.0.fraction() * 100.0
    )
  } else {
    // Add an entity to the world with a timer
    commands
      .entity(player)
      .insert(Cooldown(Timer::from_seconds(5.0, TimerMode::Once)));

    // Cast the spell here
  }
}

fn tick_cooldowns(
  mut commands: Commands,
  mut cooldowns: Query<(Entity, &mut Cooldown)>,
  time: Res<Time>,
) {
  for (entity, mut cooldown) in &mut cooldowns {
    cooldown.0.tick(time.delta());

    if cooldown.0.finished() {
      commands.entity(entity).remove::<Cooldown>();
    }
  }
}
```

当玩家施放咒语时，我们会添加一个冷却时间，然后勾选这些冷却时间，直到完成。

最后我们删除了冷却时间组件，让他们再次施展法术。