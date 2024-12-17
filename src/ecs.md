# ECS

ECS 是“Entity Component System”的首字母缩写词，是一种编程范式（类似于 Model View Controller），**Bevy**针对存储和数据访问做了最大性能优化。

与任何编程范式一样，我们按分类法命名和装箱：

1. **Entities**实体代表世界中的“事物”，它实际上只是一个 ID
1. **Components**组件代表 “things” 上的数据
1. **Systems**系统列举了组件并影响世界其他部分

这种思维方式不像**MVC**编程那样直观，在**MVC**编程中，我们将实体、组件和系统的概念组合在一起。

将它们分开意味着程序员对机器更有同情心，但代价是能够轻松地同时理解整个系统。  

在**ECS**中，我们鼓励将游戏分解为更小的部分，这些部分在这些组件的小集合上运行。这意味着每个功能可能更容易单独编写，但更难理解整个难题。  

那么为什么要费心呢？性能。

## 从CPU中榨取性能

为了提高计算机的速度，我们需要小心将数据存储在内存中的方式。如果我们能让**CPU**从缓存中为我们提供数据，而不是从**RAM**中获取数据，那么我们的**CPU**将会更加高性能，因为**RAM**要昂贵得多。  

我们越能将数据保存在连续数组中，我们的**CPU**就越擅长使用其缓存，从而避免不必要地访问我们计算机的速度要慢得多的内存。  

当我说“contiguous array”时，我的意思是数组中的每个项目都应该既有用又有序，这样当我们访问它时，我们的**CPU**缓存可以正确预测我们的意图。  

我们对**CPU**更加同情，作为交换，我们的**CPU**更加努力地工作，以节省我们访问内存的时间。  

如果`0`表示某个需要访问的物品，则`[1, 0, 0, 0, 5, 0, 0, 7]`的数组可以是连续的。但是，如果我们使用`0`表示`null`，则我们的访问模式将与缓存预期的不匹配。  

**ECS**的一大理念是将所有内容存储在连续的数组中，其方式与我们在游戏逻辑中使用它们的方式相匹配。  

游戏引擎循环遍历我们的游戏逻辑和每个更新，我们想对游戏中的 “things” 执行一些操作。通常会修改它们保存的数据，比如移动它的位置。这推动了我们的游戏状态。  

在经典的面向对象游戏中，我们可以像这样布局我们的玩家：

```rust
struct Position {
  x: f32,
  y: f32,
}

struct Velocity {
  dx: f32,
  dy: f32,
}

struct Points(f32);

struct Player {
  points: Points(f32),
  position: Position,
  velocity: Velocity,
}

fn main() {
  let players: Vec<Player> = vec![
    Player {
      points: Points(1.0),
      position: Position { x: 0.0, y: 0.0 },
      velocity: Velocity { dx: 1.0, dy: 1.0 }
    },
    Player {
      points: Points(1.0),
      position: Position { x: 0.0, y: 0.0 },
      velocity: Velocity { dx: 2.0, dy: 2.0 },
    },
    // More players...
  ];

  loop {
    // Iterate over all entities and update their positions
    for player in players.iter() {
      player.points += 1.0
      player.position.x += player.velocity.dx;
      player.position.y += player.velocity.dy;
    }
  }
}
```


这种方法非常简洁易读，但其性能受到了影响。


## 高效的内存布局

上面示例中的内存布局目前如下所示：

```
Player 1: [Points1, Position1, Velocity1]
Player 2: [Points2, Position2, Velocity2]
Player 3: [Points3, Position3, Velocity3]
```

当我们的**CPU**从内存中获取数据并将其放入缓存时，它会在称为 “缓存行” 的固定块中进行。常见的缓存行大小从**32**到**512**字节不等，其中**64**字节是现代**CPU**的普遍选择。  

**CPU**将抓取整个缓存行，即使实际上只需要一部分数据。  

在此过程中，**CPU**会猜测一起存储在内存中的内容可能会一起访问，这称为空间局部性。  

所以我们可以想象，目前我们的缓存行是这样的：

```
Cache Line 1: [Points1, Position1]
Cache Line 2: [Velocity1, Points2]
Cache Line 3: [Position2, Velocity2]
... etc
```

将变量加载到堆栈上时，会将其加载到缓存中。然后，当稍后再次访问它时，**CPU**将首先检查其缓存。

如果在此期间加载了其他数据，它将被驱逐，必须从内存中获取，这称为缓存未命中。  

当我们遍历上面的玩家并获取每个玩家的数据时，我们会在缓存中跳来跳去，试图获取缺失的数据。这将逐出其他缓存行并获得缓存未命中，从而导致性能变差。

因为我们访问的是包含大量数据的实体，并枚举每个实体的所有数据，所以我们的缓存可能会被清除。 

那么？咋办呢？

好吧，我们可以将游戏数据存储到“数组结构”（SoA） 中，而不是之前的“结构数组”（AoS）。

```rust
struct Entity {
  id: u32,
}

struct PositionComponent {
  x: f32,
  y: f32,
}

struct VelocityComponent {
  dx: f32,
  dy: f32,
}

struct World {
  entities: Vec<Entity>,
  positions: Vec<PositionComponent>,
  velocities: Vec<VelocityComponent>,
}

fn update_positions_and_velocities(world: &mut World) {
  for (position, velocity) in world.positions.iter_mut().zip(world.velocities.iter()) {
    position.x += velocity.dx;
    position.y += velocity.dy;
  }
}
```

现在，当我们加载组件时，我们的内存布局如下：

```
Velocities: [Velocity1, Velocity2, Velocity3]
Positions: [Position1, Position2, Position3]
```

通过将相同类型的组件存储在一起，并使用实体的**ID**作为每个数组中的索引，我们可以只访问我们需要的数据。 

因此，当我们枚举这些数组时，我们的内存访问模式与**CPU**预测的内容相匹配，并且我们的缓存行不太可能被抖动。  

我们通过按顺序访问每个组件来将每个组件加载到堆栈上，从而最大限度地提高缓存的效率。

## 实体帮助我们避免传递对数据的引用

好的，通过使用**ECS**的实体和组件部分，我们可以获得更好的内存性能。但还有一个想法，我们如何管理我们的引用和指针？  

在上面的例子中，我们去掉了我们的`Player`，它变成了隐式的。玩家的概念变成了一个实体，其`Player`组件存储在索引中，与我们实体的`ID`匹配。

要在我们的游戏世界中重建 “thing”，我们只需访问每个数组的第`n`项。  

这是一个强大的抽象，因为我们可以避免传递对数组上数据的引用。相反，我们可以传递实体的索引，当我们需要数据时，我们可以从一个地方请求它。  

通过在系统中本地化我们的内存访问，我们可以彼此并行地执行数据脱节的查询，从而获得更多的性能提升。  

## 原型有助于组件组合在内存中保持在一起

我们的系统通常根据实体拥有的组件组来迭代实体。但是，这些数组可以分散在不同的数组或数组的结构中。  

为了解决这个问题，一些**ECS**框架（包括**Bevy**）引入了原型。

原型通过将具有相似组件组成的实体组织到一个表中来解决这种低效率问题。每个原型都拥有一个表，该表表示特定的组件组合。共享相同组件组成的实体被放置在该原型的表中。

通过对具有相似组件组成的实体进行分组，原型消除了原始组件存储中的冗余。  

每个原型都有它自己的组件数组集，并且同一原型中的实体共享相同的数组实例。与单独存储每个实体的组件相比，这减少了内存开销。  

原型还支持对具有相似组件组成的实体进行批处理。系统可以同时处理同一原型中的多个实体，从而利用数据并行性。这对于更新位置、应用物理特性或执行**AI**计算等操作非常有用。   

这就解释了为什么**Bevy**选择使用原型**ECS**作为其框架的核心。让我们看看它在**Bevy**中具体是如何工作的。  

## Bevy中的ECS

**Bevy**是一个使用**Rust**构建的原型**ECS**。它使用实体（**Entities**）、组件（**Components**）和系统（**Systems**）的组合来构建游戏逻辑，其方式比其他编程范例更可表达且性能更高。  

**ECS**基本上是一个高效的内存数据库。  

### Entities 实体

这些是数据库的行。它们拥有唯一的标识符。  

游戏中的每个事物都是一个实体，具有零个或多个充当列的组件。  

### Components 组件  

组件就是列。它们与特定的`Entity`相关联。  

每个组件类型只保存少量数据，而实体则由许多这样的组件组成。  

将游戏世界对象的身份与其所保存的数据分开的好处是，我们可以仅查询每个系统中所需的组件。  

如果两个系统需要不同的数据，它们可能能够彼此并行运行，这可能会带来超出我们之前讨论的收益。  

在**Bevy**中，组件是存储在`World`中并附加到`Entity`的**Rust**结构。  

### Systems 系统  

系统是实际执行影响组件状态的功能。  

每个系统都声明它需要运行哪些组件或组件组。然后**App**提供每个游戏的特定组件。  

在**Bevy**中，这些是简单的**Rust**函数。它们甚至可以是一个闭包（匿名函数、lambda）。  

默认情况下，系统彼此并行运行，并且它们的顺序是不确定的。  

### Apps 应用程序  

应用程序是控制游戏循环的。  

它们可用于向我们的核心游戏循环添加系统、资源、状态和其他内容。  

```rust
fn main() {
    App::new()
        .add_systems(Startup, startup_system)
        .add_systems(Update, normal_system)
        .run();
}
```

[Read More About App](./app.md)

### Worlds 世界

世界是数据实际存在的地方。

可以将其想象为`HashSet`或`Vec`，用于跟踪帧与帧之间的所有内容。  

`World`引用被传递给诸如命令之类的函数，这些函数使用其数据结构来获取和保留实体和组件。  

### Bundles 捆绑包

为了使生成具有特定组件的实体更加符合人体工程学，我们可以使用`Bundle`一次生成一组组件。  

为了制作`Bundle`，我们实现了`Bundle`特征，它允许插入或删除组件。  

每个实现`Component`的类型也实现`Bundle`。  

在**Bevy**`0.15`中，将引入一个名为必需组件的新概念，作为捆绑包概念的后继者。  

### Archetypes 原型

原型是一组存储在一起的组件，就像我们在系统中访问它们一样。  

每个`World`对于它所包含的每个独特的组件组合都有一个原型。 

原型对于它们所在的`World`来说是本地唯一的。  

原型和捆绑形成一个图表。添加或删除捆绑包会将`Entity`移动到新的`Archetype`。 `Edges`用于缓存这些移动的结果。  

### Resources资源  

没有对应的`Entity`的单例`Component`。

示例：  
1. Asset storage 资产存储
1. Events 事件
1. System state 状态

计数器就是一个例子，它可以计数，但与任何特定实体无关。  

在任何给定时间，每种类型只能存储一个资源到`World`中。

还有非发送资源（_non-send resources_），只能在主线程上访问。

每个资源都由其`TypeID`唯一标识。  

### Commands 命令

命令让我们可以安排对世界的可变访问。命令接收对我们的世界的独占可变访问，并且可以对组件和实体进行更改。  

这对于线程安全的并行执行非常重要。

使用命令的替代方法是使用阻止并行执行的`ExclusiveSystem`。这样我们就可以立即调用我们的命令，而不必担心它们与其他系统的顺序。  

### Events 活动  

事件通过消息总线样式的事件存储来使用，可以使用`EntityReader`和`EntityWriter`访问该事件存储。  

`EntityWriter`会将事件推送到队列以供其他`EntityReader`使用。  

`EntityReader`将使用队列中的事件，确保读取事件的系统仅使用每个事件一次。  


