# Systems 系统

系统是**Rust**函数，它是实现了`SystemParam`的特殊参数。我们指定我们想要的系统参数，**Bevy**使用一些类型魔法来提供它们。

**Rust**没有可变参数，因此这是通过宏实现的，这些宏为具有许多受支持参数（最多`15`个）的函数实现`trait`。

**Rust**函数（或`lambda`）可以通过`IntoSystem trait`自动转换为`System`：

```rust
fn hello_world() {
  println!("Hello, world!");
}

let mut system = IntoSystem::into_system(hello_world);
```

资源、命令和查询都描述了在**ECS**中获取数据的方法。因此，你的参数是与游戏`World`交互的一种声明性方式。

当`App`运行系统时，它会根据特定参数自动找出调用函数的正确方式。  

**Bevy**还使用我们类型的数据访问信息来确定哪些系统并行运行。

## Scheduling systems 调度系统

当系统被添加到我们的`App`时，它们会被添加到特定的`Schedule`。这些计划包含每个系统在每个帧的运行过程中应何时运行的规则。

事实上，**Bevy**正在尝试安排所有不需要对相同数据的可变访问的系统并行运行。这一切都是为了加快我们的游戏速度。

要调度一个系统，我们调用`add_systems`并指定调度和我们想要运行的系统：

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Update, hello_world);
}
```

或者，如果我们需要对排序进行细粒度的控制，我们可以使用**Bevy**的内置方法，如`before`和`after`：

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Update, (defend, attack.after(defend)));
}
```

在`0.11`之前，有`6`种方法可以初始化我们的系统，这引起了很多困惑。但后来它被浓缩成一个更加友好高效`add_systems`函数。

需要注意的一点是，仅拥有参数并有条件地使用它们不会阻止并行执行：

```rust
fn system_a(mut commands: Commands) {
  if random_bool() {
    commands.spawn_empty();
  }
}

fn system_b(mut commands: Commands) {
  if random_bool() {
    commands.spawn_empty();
  }
}
```

这两个系统有可能并行运行。可变借用的开销取决于我们是否调用它。

## Ordering 次序

默认情况下，系统彼此并行运行，并且它们的顺序是不确定的。

普通系统无法安全地直接访问`World`实例，因为它们并行运行。我们的`World`包含我们所有的组件，因此并行更改它的任意部分不是线程安全的。

可以通过以下方式控制排序：

- The core sets like`Update`, `PostUpdate`, `FixedUpdate`, etc..
- by calling the `.before(this_system)` or `.after(that_system)` methods when adding them to your schedule
- by adding them to a `SystemSet`, and then using `.configure_set(ThisSet.before(ThatSet))` syntax to configure many systems at once
- hrough the use of `.add_systems(Update, (system_a, system_b, system_c).chain())`
- by calling `.in_schedule`
- by calling `.on_startup`

## System params and param sets 系统参数和参数集

`System params`将自动从`World`中获取数据，而无需直接与`World`结构体交互。

系统采用`SystemParam trait`参数。`SystemParam`结构有两个生命周期：

- `'w` for data stored in the World
- `'s` for data stored in a parameter's local state

一些常见的`SystemParam`是：

| System parameter | Description |
|-|-|
| `Res` | A reference to a resource |
| `ResMut` | A mutable reference to a resource |
| `Local` | A local system variable that persists between invocations of the system |
| `Deferred` | A param that stores a buffer which gets applied to a `World` during an `apply_system_buffers` call |
| `NonSend/NonSendMut` | A shared borrow of a non `Send` resource, systems taking these are forced onto the main thread to avoid sending these resources between threads |  
| `SystemChangeTick` | Reads the previous and current change ticks containing a `last_run` and `this_run` each holding a `Tick` which can be used to check the time the system has been run at. |
| `Query` | A query for resources, components or entities |
| `Commands` | The main interface for scheduling commands to run |
| `EventReader` | An interface for reading events of a particular type |
| `EventWriter` | An interface for writing events of a particular type |
| `&World` | A reference to the current `World` |
| `Archetypes` | Metadata about archetypes |
| `Bundles` | Metadata about bundles |
| `Components` | Metadata about components |
| `Entities` | Metadata about entities |

`ParamSet`是可能冲突的`SystemParam`的集合。它允许系统安全地访问最多`8`个互斥的参数并与之交互。例如：引用相同可变数据的两个查询或相同类型的事件读取器和写入器。

我们可以根据它们在类型中定义的顺序来访问`p0`、`p1`等的`ParamSet`的参数。

`ParamSet`可以采用任何`SystemParam`。

在一个系统中可变地访问同一个组件两次时，可以使用`ParamSet`：

```rust
// This will panic at runtime when the system gets initialized.
fn bad_system(
  mut enemies: Query<&mut Health, With<Enemy>>,
  mut allies: Query<&mut Health, With<Ally>>,
) {
  // ...
}
```

相反，`ParamSet`利用借用检查器来确保在给定时间只访问一个包含的参数。

```rust
fn good_system(
  mut set: ParamSet<(
    Query<&mut Health, With<Enemy>>,
    Query<&mut Health, With<Ally>>,
  )>,
) {
  // This will access the first `SystemParam`.
  for mut health in set.p0().iter_mut() {
    // Do your fancy stuff here...
  }
  // The second `SystemParam`.
  // This would fail to compile if the previous parameter was still borrowed.
  for mut health in set.p1().iter_mut() {
    // Do even fancier stuff here...
  }
}
```

## Custom system parameters 自定义系统参数

我们可以通过在结构体上派生`trait`来创建自己的系统参数。我们唯一需要注意的是前面提到的两次生命周期标注。

```rust
// The [`SystemParam`] struct can contain any types that can also be included in
// a system function signature.
//
// In this example, it includes a query and a mutable resource.
#[derive(SystemParam)]
struct PlayerCounter<'w, 's> {
  players: Query<'w, 's, &'static Player>,
  count: ResMut<'w, PlayerCount>,
}

impl<'w, 's> PlayerCounter<'w, 's> {
  fn count(&mut self) {
    self.count.0 = self.players.iter().len();
  }
}

// The [`SystemParam`] can be used directly in a system argument.
fn count_players(mut counter: PlayerCounter) {
  counter.count();

  println!("{} players in the game", counter.count.0);
}
```

## System state 系统状态

系统可以使用`Local<T>``system`参数进行状态的本地化：

```rust
fn print_at_end_round(mut counter: Local<u32>) {
  *counter += 1;
  println!("In set 'Last' for the {}th time", *counter);
  // Print an empty line between rounds
  println!();
}
```

`Local``counter`变量将在函数调用之间保持其状态，仅对该系统有效，其他系统无法获取到该资源。

## Combining systems 组合系统

高阶系统甚至可以由使用`pipe`法的许多其他系统组成：

这应该与`ParamSet`结合使用，以避免`SystemParam`冲突。

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(
      Update,
      (
        parse_message_system.pipe(handler_system),
        data_pipe_system.pipe(info),
        parse_message_system.pipe(debug),
        warning_pipe_system.pipe(warn),
        parse_error_message_system.pipe(error),
        parse_message_system.pipe(ignore),
      ),
    );
}
```
