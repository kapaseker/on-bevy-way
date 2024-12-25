# Queries 查询

在**Bevy**中，实体的所有游戏数据都存储在[组件](./components.md)中。

查询是一种声明性的方式，用于指定我们系统中想要的 `Component` 数据。它们仅在您迭代组件时，才会根据组件的规范从您的游戏 `World` 中获取组件。

我们通过将查询作为参数添加到我们的系统来指定查询。然后，**Bevy**会在计划时将参数[注入](https://taintedcoders.com/bevy/building-bevy)我们的系统。

这些参数就像您的其他 `SystemParam` 参数（如 `Res`、`Assets<T>` 或 `EventWriter`）一样。

## Specifying a query 指定查询

`Query` 系统参数允许我们使用两个通用参数指定每个实体所需的数据：

```rust
//     ------- the world query
//    |  ---- the filter
//    v  v
Query<Q, F>

//      --------- Give us all the `Transform` components (readonly)
//     |     ---- Which have a `Player` component on the same entity
//     v     v
Query<&Ball, With<Player>>

//                     --- NOTE: Each parameter can be a tuple as well
//                    |          we will learn more about this later
//                    |
//                    v
Query<&mut Transform, (With<Player>, With<Living>)>
```

当指定 `Query` 作为系统参数时，它不会立即从 `World` 中获取数据。只有当你迭代该查询时，它才会成为一项昂贵的操作。

### Component access 组件访问

在上面的示例中，您可能已经注意到 `Q` 参数为类型指定了一个 `&T` 或 `&mut T`。这表示我们想要对从世界获取的数据进行的借用类型。

当我们请求 `&T` 时，我们请求对数据的只读引用：

```rust
Query<&Ball>
```

这很好，因为这样 Bevy 就可以为许多系统提供只读引用，这些系统将尝试并行运行，以提供更好的性能。

这意味着我们不能更改组件的任何值，除非我们要求它是 `&mut T`：

```rust
Query<&mut Ball>
```

缺点是**Bevy**无法与引用此组件的其他系统并行运行此系统。

### Tuple parameters 元组参数

`Query<Q, F>` 中的每个泛型参数本身都可以是一个元组。

当泛型参数是 `Tuples` 时，该 `Tuples` 中的所有类型都必须由该查询满足。所以上面的例子就像说：

> Fetch me all ball and player components from every entity with both
> 从每个实体中获取所有 ball 和 player 组件

它与过滤器的工作方式类似，确保满足_所有_条件。

## Query fetch 查询获取

第一个参数是你的 `Query<Q, F>` 是你的 `QueryFetch`，它告诉**Bevy**你想要从`World` 中获得什么数据。

```rust
#[derive(Component, Debug)]
struct Player;

fn fetch_players(query: Query<&Player>) {
  for player in &query {
    info!("Player: {:?}", player);
  }
}
```

此查询等效于说：

> Fetch me the player component from each entity that has one
> 从每个拥有玩家组件的实体中获取该玩家组件。

但是 `Tuples` 会改变含义：

```rust
fn fetch_players_with_rocket(
  query: Query<(&Player, &Rocket)>
) {
  for (player, rocket) in &query {
    info!("Player: {:?}", player);
    info!("Rocket: {:?}", rocket);
  }
}
```
现在的意思是说：

> Fetch me every player and rocket from all the entities that have both player and rocket components
> 从同时具有 player 和 rocket 组件的所有实体中获取每个 player 和 rocket

简单的元组组合不足以指定我们想要的所有复杂查询。有一些方便的类型使表达更复杂的查询变得容易：

| parameter | description |
| - | - |
| `Option<T>` | a component but only if it exists, otherwise `None` |
| `AnyOf<T>` | fetches entities with any of the components in type T |
| `Ref<T>` | shared borrow of an entity's component `T` with access to change detection |
| `Entity` | returns the entity |

### Option 选择

假设我们想让我们的游戏世界：

> Fetch me all players _or_ astroids for all entities that have either one
> 为我获取有玩家 _或_ astroids 的所有实体

我们可以传递一个元组，但这些元组表示 _AND_ 操作。为了表达这种 _OR_ 逻辑，我们可以将每个参数包装在一个 `Option` 中：

```rust
fn fetch_players_or_astroids(
  query: Query<(Option<&Player>, Option<&Astroid>)>,
) {
  for (player, astroid) in &query {
    if let Some(player) = player {
      info!("Player: {:?}", player);
    }

    if let Some(astroid) = astroid {
      info!("Astroid: {:?}", astroid);
    }
  }
}
```
### AnyOf 任一的

```rust
Query<AnyOf<(&Player, &Rocket, &mut Astroid)>>
```
在这里我们要说的是：

> Find me an optional player, rocket, or astroid from entities that have any of these components
> 从拥有这些组件（可选的玩家组件、火箭组件或小行星组件）的实体中为我找出一个（符合条件的组件所对应的实体）。

这意味着扩展它相当于：

```rust
Query<(
    Option<&Player>,
    Option<&Rocket>,
    Option<&mut Astroid>
  ),
  Or<(
    With<Player>,
    With<Rocket>,
    With<Astroid>
  )>>
```

每种类型都作为 `Option<T>` 返回，因为实体将具有我们指定的任何类型。

### Ref 引用

如果我们想知道实体如何更改，我们可以使用 `Ref<T>` 参数：

```rust
fn react_to_player_spawning(query: Query<Ref<Player>>) {
  for player in &query {
    if player.is_added() {
      // Do something
    }
  }
}
```

这些借用是不可变的，不需要唯一的访问权限。它最相当于 `Query<&Player>` 但我们还获得了一些额外的更改跟踪方法：

| method | description |
| - | - |
| `is_added` | returns true if this value was added after the system ran |
| `is_changed` | returns true if the value was added or mutably dereferenced either since the last time the system ran or, if the system never ran, since the beginning of the program |
| last_changed | returns the change tick recording the time this data was most recently changed |

### Entity 实体

作为查询的一部分，我们可以请求`Entity`。可以将 `Entity` 想象为一个唯一的**ID**。

```rust
fn fetch_entities(
  query: Query<Entity>
) {
  // ...
}
```

`Entity` 本身并不是很有用。但是一旦我们有了这个**ID**，我们就可以在查询中使用某些方法来从 **that** 实体而不是所有实体获取组件：

```rust
fn fetch_rocket_by_player_entity(
  players: Query<Entity, With<Player>>,
  query: Query<&Rocket>
) {
  for player in &players {
    let rocket = query.get(player).unwrap();
  }
}
```

## Query filter 查询过滤器

`Query<Q, F>` 中的第二个参数是 `QueryFilter`。这些过滤器由条件类型包装：

| method | description |
| - | - |
| `With<T>` | only items with a `T` component |
| `Without<T>` | only items without a `T` component |
| `Or<T>` | checks if all filters in the tuple `F` apply |
| `Changed<T>` | only components of type `T` that were changed this tick |
| `Added<T>` | only components of type `T` that were added this tick |

当对更改跟踪器使用过滤器类型时，例如：

```rust
Query<Player, Added<Player>>
```

它基本上与使用  `Ref<T>`  并直接访问更改跟踪器相同：

```rust
fn react_to_player_spawning(
  query: Query<Ref<Player>>
) {
  for player in &query {
    if player.is_added() {
        // Do something
    }
  }
}
```

就性能而言，这些是等效的。

### Disjointed queries  脱节的查询

当查询可以包含相同组件的两个可变类型时，我们必须使用 `Without` 来分离集合并遵循 Rust 的借用规则：

```rust
fn fetch_players_and_rockets(
  players: Query<&mut Player, With<Rocket>>,
  rockets: Query<&mut Player, With<Invincibility>>
) {
  // This will panic at runtime
}
```

否则，是否存在同时具有`Rocket`和`Invincibility`的实体就太模糊了。这将导致相同组件的重复借用。

另一种方法是将两个查询包装到  `ParamSet`  中：

```rust
fn fetch_with_param_set(
  query: ParamSet<(
    Query<&mut Player, With<Rocket>>,
    Query<&mut Player, With<Invincibility>>
  )>
) {
  // This is ok
}
```

从 Bevy `0.12` 开始，我们可以通过不连贯的查询一次安全地访问多个 `EntityMut` 值：

```rust
fn disjointed_mutable_access(
  transforms: Query<EntityMut, With<Transform>>,
  entities: Query<EntityMut, Without<Transform>>
) {
  for entity in &entities {
    // Do stuff here
  }
}
```

这涉及更改 `EntityMut` 以缩小范围。

在它可以删除组件、消失实体并提供对整个世界的可变访问之前。但现在他们只能修改自己的组件。

## Retrieving components 检索组件

要从 **ECS** 存储中检索组件，我们的 `Query` 系统参数提供了多种方法：

| method | description |
| - | - |
| `iter` | returns an iterator over all items |
| `for_each` | runs the given function in parallel for each item |
| `iter_many` | runs a given function for each item matching a list of entities |
| `iter_combinations` | returns an iterator over all combinations of a specified number of items |
| `par_iter` | returns a parallel iterator |
| `get` | returns a query item for a given entity |
| `get_component<T>` | returns the component for a given entity |
| `many` | returns a query item for a given list of entities |
| `get_single` | the safe version of `single` which returns a `Result<T>` |
| `single` | returns the query item while panicking if there are others |
| `is_empty` | returns true if the query is empty |
| `contains` | returns true if query contains a given entity |

每个方法还有一个相应的 `*_mut` 变体，它将返回具有可变所有权的组件。这让我们可以更改他们的数据，而不仅仅是读取数据。

### Retrieving components from a single entity 从单个实体检索组件

有多种不同的方法可以检索单个实体的组件。每个都有自己的用例，并且可能会出现恐慌或不恐慌，具体取决于您的游戏逻辑。

#### Find a single entity 查找单个实体

如果我们知道查询中_只有_一个实体，我们可以使用`single`/`single_mut`：

```rust
fn move_player(
  mut query: Query<&mut Transform>
) {
  let mut transform = query.single_mut();
  transform.translation.x += 1.;
}
```

然而，如果有多个实体包含 `Transform` 组件，则此方法会出现 `panic`。

如果您不能 100% 确定只有一个实体，您应该更喜欢更安全的访问版本 `get_single`，它会返回 `Result`：

```rust
fn move_player_safely(
  mut query: Query<&mut Transform>
) {
  if let Ok(mut transform) = query.get_single_mut() {
    transform.translation.x += 1.
  }
}
```
`Result` 是**Rust**中的内置类型，表示可能成功也可能不成功的操作。 `Result` 是 `Ok` 或 `Err` 的并集。在上面的示例中，我们使用惯用的 `if let` 语法，仅当 `Result` 为 `Ok` 时才可以更改`x`位置。

#### Get a single component 获取单个组件

在我们有特定`Entity`（基本上是一个ID）的情况下，我们可以使用`get`或`get_mut`。

使用此功能的好时机是当我们存储资源（或其他任何内容）并且保证该组件在整个游戏中可用时。

```rust
#[derive(Resource)]
struct PlayerRef(Entity);

fn move_player_by_component(
  mut query: Query<&mut Transform>,
  player: Res<PlayerRef>
) {
  if let Ok(mut transform) = query.get_mut(player.0) {
    transform.translation.x += 1.;
  }
}
```

对许多组件的所有查询都会返回一个 `Iterator` ，它将根据我们的 `Query` 的 `Q` 泛型生成一个组件元组。

向系统提供组件的最常见方法是使用 `iter` 方法来枚举存在的每个组件：

```rust
fn move_players(
  mut query: Query<&mut Transform>
) {
  // We can enumerate all matches
  for mut transform in query.iter_mut() {
    transform.translation.x += 1.;
  }
}
```

因为 `QueryState` 本身是可迭代的，我们可以将上面的代码简化为直接枚举查询，而不是调用 `iter`：

```rust
fn move_players_shorthand(
  mut query: Query<&mut Transform>
) {
  // We can enumerate all matches
  for mut transform in &mut query {
    transform.translation.x += 1.;
  }
}
```

#### Combinations 组合

当我们想要枚举两组组件，将它们压缩在一起，并枚举所有组合的元组时，我们可以使用 `iter_combinations`：

```rust
#[derive(Component)]
struct Steering(Vec2);

#[derive(Component)]
struct Avoid;

const AVOID_DISTANCE: f32 = 100.;
const AVOIDANCE_FORCE: f32 = 0.1;

fn ship_avoidance_system(
  mut query: Query<(&mut Steering, &Transform), With<Avoid>>
) {
  let mut iter = query.iter_combinations_mut();

  while let Some([
    (mut steering_a, transform_a),
    (mut steering_b, transform_b)
  ]) = iter.fetch_next() {
    let a_to_b = transform_b.translation - transform_a.translation;
    let distance = a_to_b.length_squared();

    if distance < AVOID_DISTANCE {
      // Steer the two ships away from each other
      steering_a.0 += AVOIDANCE_FORCE;
      steering_b.0 -= AVOIDANCE_FORCE;
    }
  }
}
```

不保证迭代器产生的组合具有任何特定的顺序。

如果我们想要 `3` 个或更多的组合，我们可以调整函数的  `K`  参数：

```rust
fn every_three_transforms(
  mut query: Query<&mut Transform>
) {
  // Set our `K` parameter on the function to 3
  let mut combinations = query.iter_combinations_mut::<3>();

  // Now we get all combinations of 3 items returned
  while let Some([
    transform_a,
    transform_b,
    transform_c
  ]) = combinations.fetch_next() {
    // mutably access components data
  }
}
```
如果我们只需要只读访问，我们可以使用语法而无需一遍又一遍地查询 `iter`：

```rust
fn readonly_combinations(query: Query<&Transform>) {
  for [
    transform_a,
    transform_b
  ] in query.iter_combinations() {
    // ...
  }
}
```

#### Iterating over specific entities 迭代特定实体

如果我们有一个 `Entity` 列表，并且我们只想迭代那些实体组件，我们可以使用 `iter_many`。

```rust
#[derive(Component)]
struct Health(pub f32);

#[derive(Resource)]
struct Selection {
  enemies: Vec<Entity>
}

const ATTACK_DAMAGE: f32 = 10.;

fn attack_selected_enemies(
  mut query: Query<&mut Health>,
  selected: Res<Selection>
) {
  let mut iter = query.iter_many_mut(&selected.enemies);
  while let Some(mut health) = iter.fetch_next() {
    health.0 -= ATTACK_DAMAGE;
  }
}
```

#### Faster iteration 更快的迭代

如果我们的查询需要更高的性能（但放弃任何链接），我们可以在 `iter` 或 `iter_mut` 上使用 `for_each`：

```rust
fn fast_move_players(
  mut query: Query<&mut Transform>
) {
  // We can enumerate all matches
  query.iter_mut().for_each(|mut transform| {
    transform.translation.x += 1.;
  });
}
```

这会更快，但它不能链接到其他任何东西。

## Performance concerns 性能问题

`Table` 组件存储类型对于查询迭代比 `SparseSet` 更加优化。

如果两个系统都访问相同的组件类型，并且至少其中一个访问是可变的，则两个系统不能并行执行。

除非执行者可以验证在两个查询中都找不到实体，否则就会发生这种情况。为此，它使用 [archetypes](./arche) 来加快查找过程。

在原型碎片较多的世界中，`for_each` 方法通常比其 `iter` 版本更快。除非确实需要性能，否则建议使用 `iter` 方法而不是 `for_each` 方法。


## Query Transmutation 查询嬗变

如果希望一个 `Query` 产生另一个兼容的 `Query` ，你可以创建一个名为 `QueryLens` 的工具进行查询。

```rust
fn debug_positions(
    query: Query<&Transform>,
) {
    for transform in query.iter() {
        eprintln!("{:?}", transform.translation);
    }
}

fn move_player(
    mut query_player: Query<&mut Transform, With<Player>>,
) {
    // TODO: mutate the transform to move the player

    // say we want to call our debug_positions function

    // first, convert into a query for `&Transform`
    let mut lens = query_player.transmute_lens::<&Transform>();
    debug_positions(lens.query());
}

fn move_enemies(
    mut query_enemies: Query<&mut Transform, With<Enemy>>,
) {
    // TODO: mutate the transform to move our enemies

    let mut lens = query_enemies.transmute_lens::<&Transform>();
    debug_positions(lens.query());
}
```

注意：当我们从每个函数调用 `debug_positions` 时，它将访问的是不同的实体！即使 `Query<&Transform>` 参数类型没有任何额外的过滤器。因为它是通过 `QueryLens` 创建的，因此它只能访问源自原始 `Query` 的实体和组件。如果我们添加 `debug_positions` 为 **Bevy** 作为常规系统，它才会访问所有实体。

另：这会产生一些性能开销；转换操作不是无负担的。**Bevy** 通常会在多个运行的系统中缓存一些查询元数据。当创建新查询时，会复制它。