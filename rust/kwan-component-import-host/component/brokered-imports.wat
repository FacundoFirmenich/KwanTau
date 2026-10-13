(component
  (import "filesystem-read-sha256-word"
    (func $filesystem-read-sha256-word (param "ordinal" u32) (result u64)))
  (import "network-get-sha256-word"
    (func $network-get-sha256-word (param "ordinal" u32) (result u64)))
  (import "secret-hmac-sha256-word"
    (func $secret-hmac-sha256-word (param "ordinal" u32) (result u64)))

  (core func $filesystem-read-sha256-word-core
    (canon lower (func $filesystem-read-sha256-word)))
  (core func $network-get-sha256-word-core
    (canon lower (func $network-get-sha256-word)))
  (core func $secret-hmac-sha256-word-core
    (canon lower (func $secret-hmac-sha256-word)))

  (core module $m
    (import "" "filesystem-read-sha256-word"
      (func $filesystem-read-sha256-word (param i32) (result i64)))
    (import "" "network-get-sha256-word"
      (func $network-get-sha256-word (param i32) (result i64)))
    (import "" "secret-hmac-sha256-word"
      (func $secret-hmac-sha256-word (param i32) (result i64)))

    (func (export "run") (result i64)
      i32.const 0
      call $filesystem-read-sha256-word
      i32.const 1
      call $network-get-sha256-word
      i64.xor
      i32.const 2
      call $secret-hmac-sha256-word
      i64.xor)
  )

  (core instance $i
    (instantiate $m
      (with "" (instance
        (export "filesystem-read-sha256-word"
          (func $filesystem-read-sha256-word-core))
        (export "network-get-sha256-word"
          (func $network-get-sha256-word-core))
        (export "secret-hmac-sha256-word"
          (func $secret-hmac-sha256-word-core))
      ))))

  (func (export "run") (result u64)
    (canon lift (core func $i "run")))
)
