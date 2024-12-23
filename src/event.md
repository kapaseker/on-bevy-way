# Events 事件

事件让我们可以在[系统](./system.md)之间进行通信。我们可以在一个系统中写入事件，然后在另一个系统中读取它们以触发我们的游戏逻辑。

它们是我们将_发生的事情_与_应该发生的事情_分离的主要方式，以便我们的游戏更具可扩展性。

这些事件可以发送到以下一个（或两个）位置：

- The event stream
- Observers

我们定义并添加到 `App` 中的每个事件类型都会添加到 `EventRegistry` 中。

每个事件都会自动实现 `Component`。尽管我们通常不会将它们添加到我们的任何实体中。相反，**Bevy**使用 `ComponentId` 来标识每个事件类型。

每个 `Event` 都使用其 `EventId` 单独跟踪。这些 ID 会根据事件的发送顺序自动递增。

## The event stream 事件流

当我们将事件发送到事件流时，它存储在 `Events<T>` 资源中。

此资源是充当双缓冲队列的集合。执行双重缓冲是为了确保系统能够获取每个事件，即使它们是在帧结束时触发的。

`EventReader` 将跟踪哪些系统读取了哪些事件，以便**所有**感兴趣的系统都可以使用每个事件。

为了说明这一点，假设有一个游戏，其中的 `PlayerDetected` 事件刚刚写入流中。我们将有两个缓冲区，事件放置在当前缓冲区中：

```
Buffer A (current): [PlayerDetected]
Buffer B (previous): []
```

在此游戏 tick 结束时，最旧的缓冲区 （Buffer B） 将被清除并成为我们的主缓冲区。

当我们的 `detect_player` 系统在下一帧上再次运行时，我们的缓冲区将如下所示：

```
Buffer A (previous): [PlayerDetected]
Buffer B (current): [PlayerDetected]
```

然后在该时钟周期结束时，最旧的缓冲区（缓冲区 A）被清除并设置为我们当前要将事件写入的缓冲区，使我们的缓冲区看起来像：

```
Buffer A (current): []
Buffer B (previous): [PlayerDetected]
```

通过这种方式，我们的系统可以访问此帧和最后一帧事件。因此，无论我们在触发事件之前还是之后如何对系统进行排序，它都可以访问两者。

## Adding events 添加事件

事件的定义就像我们的资源和[组件](./components.md)一样。

我们将 events 定义为派生 `Event` 的类型：

```rust
#[derive(Event)]
struct PlayerKilled;

#[derive(Event)]
struct PlayerDetected(Entity);

#[derive(Event)]
struct PlayerDamaged {
  entity: Entity,
  damage: f32,
}
```

然后，我们将事件添加到我们的`App`，类似于我们管理[资产](./assets.md)的方式：

```rust
fn main() {
  App::new()
    .add_event::<PlayerKilled>();
}
```

当我们`add_event`时，**Bevy**添加了一个处理该特定类型的系统：`Events<T>::event_update_system`。

此系统运行每个帧，通过调用 `Events<T>::update` 来清理任何未使用的事件。如果未调用此函数，则我们的事件将无限增长，最终耗尽队列。

这也意味着，如果您的事件没有被下一帧消耗，则它们将被清理并静默删除。

## Writing events to the stream 将事件写入流

事件将写入双缓冲队列。这只是意味着生成的事件存储了两个帧。

这可以防止之前调用的系统错过事件的情况，这种情况很常见，因为**Bevy**正在努力并行运行我们的系统。

例如，如果将系统定义为条件运行，则可能会在未调用它的帧期间错过事件。

要将事件写入流，我们使用 `EventWriter`。使用相同事件编写器类型的任何两个系统都不会并行运行，因为它们都使用对 `Events<T>` 的可变访问。

```rust
fn detect_player(
  mut events: EventWriter<PlayerDetected>,
  players: Query<(Entity, &Transform), With<Player>>
) {
  for (entity, transform) in players.iter() {
    // ...
    events.send(PlayerDetected(entity));
  }
}
```

每个 `EventWriter` 只能编写编译时已知的一种类型的事件。有时可能不知道此类型，作为解决方法，您可以通过 `Commands` 发送类型擦除事件：

```rust
commands.add(|w: &mut World| {
  w.send_event(MyEvent);
});
```

## Reading events from the stream 从流中读取事件

这种双缓冲策略意味着我们必须稳定地消耗每一帧的事件，否则就有丢失事件的风险。我们可以使用 `EventReader` 从我们的系统中读取事件，该事件读取缓冲区中的事件：

```rust
fn react_to_detection(
  mut events: EventReader<PlayerDetected>
) {
  for event in events.read() {
    // Do something with each event here
  }
}
```

如果希望以相同的方式处理许多不同类型的事件，则可以使用通用系统和 `Events` 资源：

```rust
fn handle_event<T: Event>(
  mut events: ResMut<Events<T>>
) {
  // We can clear events this frame
  events.clear();

  // Or clear events next frame (bevy default)
  events.update();

  // Or consume our events right here and now
  for event in events.drain() {
    // ...
  }
}

fn main() {
  App::new()
    .init_resource::<Events<PlayerKilled>>()
    .add_systems(Update, handle_event::<PlayerKilled>)
    .run();
}
```

因此，我们可以说 `Events<T>` 资源代表在_最后两次_更新调用中发生的所有事件类型的集合。

## Observers 观察者

`Observer`是一个监听`Trigger`的系统。每个触发器都针对特定的事件类型。

需要注意的是，当使用 `EventWriter` 发送事件时，它们不会自动触发我们的观察者。我们必须手动触发它们，通常使用`Commands`：

```rust
commands.trigger(SomeEvent)
```

这与使用 `EventWriter` 将事件写入事件流不同。相反，这些事件直接发送给观察者并立即处理。不会发送到 `Events<T>` 收藏。

**Bevy**有一些内置触发器，我们可以使用它们来挂钩：

| Type | Description |
| - | - |
| `OnAdd` | Triggers when an entity is added |
| `OnInsert` | Triggers when an entity is inserted |
| `OnRemove` | Triggers when an entity is despawned |

要创建观察者，我们可以将其添加到 `App` 定义中：

```rust
#[derive(Component, Debug)]
struct Position(Vec2);

#[derive(Component)]
struct Enemy;

fn on_respawn(
  trigger: Trigger<OnAdd, Enemy>,
  query: Query<(&Enemy, &Position)>,
) {
  let (enemy, position) = query.get(trigger.entity()).unwrap();
  println!("Enemy was respawned at {:?}", position);
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .observe(on_respawn);
}
```

`Trigger` 的第一个通用参数是事件，第二个是可选的，您可以将其视为事件类型的参数。您创建的大多数观察者只会选择一个。

如果我们想要更多的控制，我们可以选择对某种类型的事件做出反应，并且仅使用特定的实体调用我们的系统：

```rust
#[derive(Component)]
struct Boss;

#[derive(Event)]
struct BossSpawned;

fn on_boss_spawned(
  trigger: Trigger<BossSpawned>,
  query: Query<(&Enemy, &Position)>,
) {
  let (enemy, position) = query.get(trigger.entity()).unwrap();
  println!("Boss was spawned at {:?}", position);
}

fn spawn_boss(
  mut commands: Commands,
) {
  commands.spawn((Enemy, Boss)).observe(on_boss_spawned);
  commands.trigger(BossSpawned);
}
```

以这种方式添加的观察者实际上被创建为 `EntityObserver` ，它将使用组件钩子仅发送我们系统特定的实体。