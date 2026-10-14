# Durable store migration

The current pull request keeps the operational JSON cache. The SQLite/WAL replacement is developed in a stacked branch so package-boundary admission and durable-state semantics can be reviewed independently.
