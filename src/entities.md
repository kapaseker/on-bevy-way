# Entities 实体

概括地说，`Entity`独占拥有零个或多个`Component`实例。  

每个实体只能具有每种类型的单个组件。可以在实体的生命周期内动态添加或删除这些类型。

实体是表示其相关组件的索引的标识符。  


## Entities are identifiers 实体是标识符

`Entity`类型是一个轻量级标识符，仅对其来源的世界有效。

```rust
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_ecs/src/entity/mod.rs
#[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
pub struct Entity {
  generation: u32,
  index: u32,
}
```

类型本身是`index`和`generation`属性的简单持有者。  

两者形成一个代际索引。这允许在数组中删除数据后快速插入，同时保持连续的内存布局，从而提高 ECS 的性能。  

## Entities are local to the world 实体是世界的本地实体

每个`World`都保留一个Entities列表，其中包含3组实体ID：  

1. `freelist`：以前释放的**ID**
1. `reserved`：曾经在空闲列表中但被保留的**ID**列表
1. `pending`：尚不存在的新**ID**的计数

分代索引可确保同时存在的两个实体永远不会共享同一索引。  

每次取消具有给定索引的实体时，代数都会增加。这用作给定索引被重用的次数的 “计数”。   

这些唯一标识符使**Bevy**能够以懒惰的方式分配它们。它首先保留一个**ID**，然后可以稍后分配它。  

此测试说明了以下概念：

```rust
#[cfg(test)]
mod tests {
  #[derive(Component)]
  struct Health(i32);

  #[test]
  fn reserve_and_spawn() {
    let mut world = World::default();
    // We reserve an entity id
    let id = world.entities().reserve_entity();

    // Then we lazily spawn the entity using
    // the reserved id
    world.flush();

    let mut entity = world.entity_mut(id);
    entity.insert(Health(0));
    assert_eq!(
      entity.get::<Health>().unwrap(),
      &Health(0)
    );
  }
}
```

在实际应用程序中，我们实际上并不自己管理任何这些。我们改用`commands`系统参数：

```rust
fn spawn_health(
  mut commands: Commands
) {
  commands.spawn(Health(0));
}
```

## Entities are stored in tables 实体存储在表中

`Entities`是`World`持有的一种类型，用于`World`中所有实体的元数据。每条元数据都包含：

1. 每个实体的生成。  
1. 特定实体的活动/死亡状态。  
1. 实体组件在内存中的位置（`EntityLocation`）。  

`EntityLocation`包含有关存储实体组件的`Table`的信息。  

每个`Table`对于其存储的每种组件类型都有一个`Column`：  

```rust
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_ecs/src/storage/table/mod.rs
pub struct Table {
  columns: ImmutableSparseSet<ComponentId, ThinColumn>,
  entities: Vec<Entity>,
}
```

`ImmutableSparseSet`可以理解为一个简单的`HashMap`，而`Column`则是一个类型擦除的`Vec<T: Component>`。

为了从表中获取行，我们使用`Entity`作为每个`Column`的索引。  

因此，如果我们有一个包含3列的表：  

```
Health column: [_, _, 50]
Player column: [_, _, X]
Enemy column:  [_, _, _]
```

我们可以获取ID为`2`的实体的组件，如下所示：  

```
Health(50)
Player
```

这是一个简化的说明。**Bevy**实际上会创建一个代表此ID的类型`TableRow`，我们可以使用`Entity`标识符来获取`TableRow`。  

## Entities enable structure of arrays 实体启用数组结构

这种存储概念称为**数组结构**（_SoA_），而不是**结构数组**（_AoS_）。

在**AoS**程序中，我们可以想象一个更传统的面向对象的游戏引擎，如**Godot**。我们的结构容纳了我们的所有组件。因此，一个对象具有许多属性，每个属性都是一个组件： 

```rust
struct Player {
  health: u32,
  speed: u32,
  name: String,
  team: u32
}
```

我们可以考虑我们的游戏循环迭代每个玩家并执行其所需的逻辑：

```rust
fn movement_system(mut players: Query<&mut Player>) {}
fn attacking_system(mut players: Query<&mut Player>) {}
```

一个问题是我们不能再拆分这些可变引用。每个对玩家做任何事情的系统都必须等待轮到执行。像这样的神物越集中，问题就越困难。

每个查询还需要更多内存，一个系统可能只使用名​​称，但加载其所有其余组件仍然相同。

相反，在**Bevy**中我们使用数组结构来做同样的事情：

```rust
struct Player;
struct Health(u32);
struct Name(String);
struct TeamId(u32);
```

当我们想要创建一个在某些情况下减少我们健康的系统时，我们不需要可变地借用其他组件。

如果系统不需要对相同数据进行可变访问，**Bevy**将努力尝试安排您的系统并行运行。

## Archetypes group components by entities 原型按实体对组件进行分组  

那么实体的组件进入哪个`Table`？这就是`Archetype`的用武之地。  

每个组件都有一个基于其实体所具有的组件组合的`ArchetypeId`。  

对于实体上每个独特的组件组合，世界只有一个`Archetype`。它们的`ArchetypeId`对于世界而言是本地唯一的，而不是世界之间的全局唯一的。  

原型指向特定的表，但多个原型可以将它们的表组件存储在同一个表中。

`Archetype`和`Table`都已创建，但从未清理。它们不会被移除并持续存在，直到世界被抛弃。  

原型在调度程序使用时非常有用：

```rust
fn system_a(query: Query<&mut Health, With<Player>>) {}
fn system_b(query: Query<&mut Health, Without<Player>>) {}
```

`system_b`将与`system_a`并行，即使两者使用对同一组件类型的可变引用。

尽管两个组件共享相同的`ComponentId`，但它们实际上具有不同的`ArchetypeComponentId`，这让调度程序可以识别这些不相交的查询。
