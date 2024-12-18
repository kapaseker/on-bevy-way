# Archetypes 原型

**Bevy**是一个典型的**ECS**。原型通过根据其组件组成对具有相似行为的实体进行分组，从而能够有效地存储和处理具有相似行为的实体。  

`Archetype`是组件的唯一组合。**Bevy**将这些组合存储在`Table`上。  

通过将一起访问的组件放在同一个内存位置，我们可以帮助我们的内存访问更加高效。  

当查询用作系统参数时，**Bevy**会计算它请求的组件集的匹配`Archetype`。这让**Bevy**可以计算哪些系统可以并行运行（见下文）。

当您将组件添加到实体时，您会将该实体移动到新的原型。  

一个世界对于每个独特的组件组合只有一个`Archetype`。

`Archetype`存储了一些关于自身的元数据：

```rust
// https://docs.rs/bevy/latest/bevy/ecs/archetype/struct.Archetype.html
pub struct Archetype {
  id: ArchetypeId,
  table_id: TableId,
  edges: Edges,
  entities: Vec<ArchetypeEntity>,
  components: ImmutableSparseSet<ComponentId, ArchetypeComponentInfo>,
}
```

`Archetypes`存储在一个特定的世界中，并且仅在该`World`本地唯一：  

```rust
// https://docs.rs/bevy/latest/bevy/ecs/archetype/struct.Archetypes.html
pub struct Archetypes {
  pub(crate) archetypes: Vec<Archetype>,
  archetype_component_count: usize,
  by_components: bevy_utils::HashMap<ArchetypeComponents, ArchetypeId>
}
```

## Starting without archetypes 从原型开始

想象一下，我们有一个**ECS**的朴素实现，它将组件存储为数组，将实体存储为索引：

| Entity ID | Health | Player | Position | Enemy |
|--|--|--|--|--|
| 1 | 100 | √ | (3, 2) |  |
| 2 | 72 |  | (3, 1) | √ |
| 3 | 40 | √ | (4, 2) |  |
| 4 | 20 |  | (3, 0) | √ |


`Player`和`Enemy`中的差距对于我们的内存访问来说非常尴尬。如果我们想编写矢量化代码来处理这些数组，那么空值将带来一个严重的问题。  

“矢量化代码”是指一次对整个数组或数据向量进行操作的代码，而不是按顺序处理单个元素的代码。  

使用**SIMD**（单指令、多数据）指令等硬件优化，可以高效地执行矢量化操作。这些指令允许对多个数据元素同时执行相同的操作，通常可以提高性能。

但是，在给定的场景中，由于实体 ID 与数组索引（我们的空白区域）不匹配，因此编写需要`Player`和`Enemy`数组的矢量化代码变得具有挑战性。

矢量化操作通常依赖于不同数组中的相应元素具有相同的索引的假设。如果 A 和 B 中的实体 ID 未与数组索引对齐，则很难执行依赖于两个数组之间匹配元素的操作。

## Improving the layout of our components 改进组件的布局

如果我们以可能使用的方式存储组件会怎样？  

| Entity ID | Health | Player | Position | Enemy |
|--|--|--|--|--|
| 1 | 100 | √ | (3, 2) |  |
| 3 | 40 | √ | (4, 2) |  |


| Entity ID | Health | Player | Position | Enemy |
|--|--|--|--|--|
| 2 | 72 |  | (3, 1) | √ |
| 4 | 20 |  | (3, 0) | √ |

现在我们有两个表，但每个表都形成一个连续的元素数组，这些元素可以在检索时进行优化。  

这两个表都有不同的`Archetype`。一种用于`Player`，另一种用于`Enemy`。

因此，我们将组件存储在相同类型的数组中，但位于表示实体的 type （如其所有组件的总和）的不同表中。我们将这种“类型”称为`Archetype`。

## Archetypes help find disjointed queries 原型有助于找到交叉的查询

一个`Component`可以出现在许多`Archetype`中。这是通过使用`ArchetypeComponentId`来完成的，这种多对多关系是并行调度程序如何计算出可以同时运行的脱节只读查询的方式。  

乍一看，您可能会认为这不应该能够并行运行：

```rust
fn move_players(
  player_positions: Query<&mut Position, With<Player>>,
) {
  // ...
}

fn move_enemies(
  enemy_positions: Query<&mut Position, Without<Player>>
) {
  // ...
}
```

如果组件只是在巨大的`Vec<T>`上存储和访问，那么`player_positions`将已经借用了`Position` 组件和`enemy_positions`不应并行运行。  

但是，因为我们为每个`Archetype`提供一个表，所以即使两个查询都返回`&mut Position`，它们也不会发生冲突并且可以并行运行。  

这是因为即使`Position`的`ComponentId`相同，它们的`ArchetypeComponentId`也会不同。  

换句话说，每个`Component`只有一个`ComponentId`，但可以有多个`ArchetypeComponentId`。它类似于**SQL**数据库中 `Component`和`Archetype`之间的多对多关系：  

```
Component <-- ComponentId <-- ArchetypeComponentId --> ArchetypeId --> Archetype
```

## When and how do archetypes get updated? 原型何时以及如何更新？

当我们生成或插入`Bundle`时，`Archetype`就会存在。  

给定存储在`Table`或`SparseSet`或两者的某种组合中的一组组件，`Bevy`将调用`Archetypes::get_id_or_insert`来分配或找到一个`TableId`，它将用于创建一个新的`Archetype`。

当我们从`Entity`添加或删除捆绑包时，它会将其移动到新的`Archetype`表。

这些移动可能非常昂贵，因此**Bevy**将这些移动缓存在`Edges`中。下次添加捆绑包时，我们可以获取匹配的边缘并找到目标 `Archetype`将其移动到，而无需从头开始计算。  

## How does bevy know our archetypes have changed? Bevy怎么知道我们的原型已经改变了？

每次我们添加或删除组件时，`Archetypes`的`ArchetypeGeneration`都会发生变化。  

**Bevy**使用当前原型的长度来创建分代索引，以保证在添加或删除原型时有唯一的索引。  

当我们必须更新原型索引时，我们使用这一代，以便当我们查询事物时它们位于它们应该在的位置。  





