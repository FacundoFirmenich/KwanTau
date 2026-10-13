use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};

type HmacSha256 = Hmac<Sha256>;
type AnyResult<T> = Result<T, Box<dyn Error + Send + Sync>>;

#[derive(Debug)]
struct HostState {
    fs_path: PathBuf,
    network_addr: SocketAddr,
    secret: Vec<u8>,
    challenge: Vec<u8>,
    consumed: [bool; 3],
    transcript: Vec<&'static str>,
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

fn digest_word(bytes: &[u8]) -> u64 {
    let digest = sha256(bytes);
    u64::from_be_bytes(digest[..8].try_into().expect("eight-byte prefix"))
}

fn hmac_word(secret: &[u8], challenge: &[u8]) -> AnyResult<u64> {
    let mut mac = HmacSha256::new_from_slice(secret)?;
    mac.update(challenge);
    let bytes = mac.finalize().into_bytes();
    Ok(u64::from_be_bytes(bytes[..8].try_into()?))
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push(DIGITS[(byte >> 4) as usize] as char);
        result.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    result
}

fn read_http_body(addr: SocketAddr) -> AnyResult<Vec<u8>> {
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(3))?;
    stream.set_read_timeout(Some(Duration::from_secs(3)))?;
    stream.set_write_timeout(Some(Duration::from_secs(3)))?;
    stream.write_all(b"GET /kwan-v015 HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")?;
    let mut response = Vec::new();
    stream.read_to_end(&mut response)?;
    let split = response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or("loopback response lacks header terminator")?;
    Ok(response[(split + 4)..].to_vec())
}

fn spawn_one_shot_server(body: Vec<u8>) -> AnyResult<(SocketAddr, thread::JoinHandle<AnyResult<()>>)> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;
    let handle = thread::spawn(move || -> AnyResult<()> {
        let (mut stream, _) = listener.accept()?;
        stream.set_read_timeout(Some(Duration::from_secs(3)))?;
        let mut request = [0u8; 4096];
        let read = stream.read(&mut request)?;
        let request_text = String::from_utf8_lossy(&request[..read]);
        if !request_text.starts_with("GET /kwan-v015 HTTP/1.1") {
            return Err("unexpected loopback request target".into());
        }
        let headers = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream.write_all(headers.as_bytes())?;
        stream.write_all(&body)?;
        stream.flush()?;
        Ok(())
    });
    Ok((addr, handle))
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn main() -> AnyResult<()> {
    let started = Instant::now();
    let root = std::env::temp_dir().join(format!("kwantau-v015-{}", std::process::id()));
    fs::create_dir_all(&root)?;
    let fs_payload = b"kwantau-v015-filesystem-evidence".to_vec();
    let net_payload = b"kwantau-v015-loopback-evidence".to_vec();
    let secret = b"kwantau-v015-private-secret".to_vec();
    let challenge = b"kwantau-v015-hmac-challenge".to_vec();
    let fs_path = root.join("input.bin");
    fs::write(&fs_path, &fs_payload)?;
    let (network_addr, server) = spawn_one_shot_server(net_payload.clone())?;

    let component_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("component")
        .join("brokered-imports.wat");
    let component_bytes = fs::read(&component_path)?;

    let mut config = Config::new();
    config.wasm_component_model(true);
    let engine = Engine::new(&config)?;
    let component = Component::new(&engine, &component_bytes)?;
    let mut linker = Linker::<HostState>::new(&engine);

    linker.root().func_wrap(
        "filesystem-read-sha256-word",
        |mut caller, (ordinal,): (u32,)| -> wasmtime::Result<(u64,)> {
            if ordinal != 0 || caller.data().consumed[0] {
                wasmtime::bail!("filesystem import is not the declared one-shot ordinal")
            }
            let payload = fs::read(&caller.data().fs_path)?;
            let word = digest_word(&payload);
            let state = caller.data_mut();
            state.consumed[0] = true;
            state.transcript.push("FILESYSTEM_READ_SHA256_WORD");
            Ok((word,))
        },
    )?;
    linker.root().func_wrap(
        "network-get-sha256-word",
        |mut caller, (ordinal,): (u32,)| -> wasmtime::Result<(u64,)> {
            if ordinal != 1 || caller.data().consumed[1] {
                wasmtime::bail!("network import is not the declared one-shot ordinal")
            }
            let payload = read_http_body(caller.data().network_addr)
                .map_err(|error| wasmtime::Error::msg(error.to_string()))?;
            let word = digest_word(&payload);
            let state = caller.data_mut();
            state.consumed[1] = true;
            state.transcript.push("NETWORK_GET_SHA256_WORD");
            Ok((word,))
        },
    )?;
    linker.root().func_wrap(
        "secret-hmac-sha256-word",
        |mut caller, (ordinal,): (u32,)| -> wasmtime::Result<(u64,)> {
            if ordinal != 2 || caller.data().consumed[2] {
                wasmtime::bail!("secret import is not the declared one-shot ordinal")
            }
            let word = hmac_word(&caller.data().secret, &caller.data().challenge)
                .map_err(|error| wasmtime::Error::msg(error.to_string()))?;
            let state = caller.data_mut();
            state.consumed[2] = true;
            state.transcript.push("SECRET_HMAC_SHA256_WORD");
            Ok((word,))
        },
    )?;

    let state = HostState {
        fs_path,
        network_addr,
        secret,
        challenge,
        consumed: [false; 3],
        transcript: Vec::new(),
    };
    let mut store = Store::new(&engine, state);
    let instance = linker.instantiate(&mut store, &component)?;
    let run = instance.get_typed_func::<(), (u64,)>(&mut store, "run")?;
    let (observed,) = run.call(&mut store, ())?;
    run.post_return(&mut store)?;
    server.join().map_err(|_| "loopback server panicked")??;

    let expected = digest_word(&fs_payload)
        ^ digest_word(&net_payload)
        ^ hmac_word(
            b"kwantau-v015-private-secret",
            b"kwantau-v015-hmac-challenge",
        )?;
    let consumed = store.data().consumed;
    let transcript = store.data().transcript.clone();
    if observed != expected || consumed != [true, true, true] || transcript.len() != 3 {
        return Err("component import transcript did not match the preregistered plan".into());
    }

    let component_sha = hex(&sha256(&component_bytes));
    let report_material = format!("{}:{}:{}", component_sha, observed, transcript.join(","));
    let report_sha = hex(&sha256(report_material.as_bytes()));
    println!(
        "{{\"format\":\"KWANTAU2DOS_V015_EXTERNAL_BROKERED_IMPORT_EVIDENCE_V1\",\"passed\":true,\"platform\":\"{}\",\"wasmtime_version\":\"49.0.2\",\"component_sha256\":\"{}\",\"observed_result\":{},\"expected_result\":{},\"one_shot_imports\":3,\"transcript\":[\"{}\"],\"elapsed_millis\":{},\"payload_returned_to_component\":false,\"plaintext_secret_returned\":false,\"ambient_authority\":false,\"authority_granted\":false,\"promotion_performed\":false,\"scientific_claim_created\":false,\"report_sha256\":\"{}\"}}",
        json_escape(std::env::consts::OS),
        component_sha,
        observed,
        expected,
        transcript
            .iter()
            .map(|value| json_escape(value))
            .collect::<Vec<_>>()
            .join("\",\""),
        started.elapsed().as_millis(),
        report_sha,
    );
    fs::remove_dir_all(root)?;
    Ok(())
}
