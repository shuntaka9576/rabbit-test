use anyhow::{Context, Result};
use axum::{
    extract::Json,
    response::sse::{Event, Sse},
    routing::{get, post},
    Router,
};
use futures::stream::{self, Stream};
use serde::Deserialize;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_stream::StreamExt as _;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    init_logger()?;
    bootstrap().await
}

fn init_logger() -> Result<()> {
    let subscriber = tracing_subscriber::fmt::layer()
        .with_file(true)
        .with_line_number(true)
        .with_target(false)
        .json();
    tracing_subscriber::registry().with(subscriber).try_init()?;
    Ok(())
}

async fn hello_axum() -> &'static str {
    "Hello, axum!"
}

async fn get_sse_handler() -> Sse<impl Stream<Item = Result<Event, axum::Error>>> {
    sse_stream(15)
}

#[derive(Deserialize)]
struct PostSseRequest {
    count: u64,
}

async fn post_sse_handler(
    Json(payload): Json<PostSseRequest>,
) -> Sse<impl Stream<Item = Result<Event, axum::Error>>> {
    sse_stream(payload.count)
}

fn sse_stream(count: u64) -> Sse<impl Stream<Item = Result<Event, axum::Error>>> {
    let counter = Arc::new(AtomicU64::new(0));
    let stream = stream::repeat_with(move || {
        let current = counter.fetch_add(1, Ordering::Relaxed);
        if current < count {
            Event::default().data(current.to_string())
        } else {
            Event::default().data("[DONE]")
        }
    })
    .map(Ok)
    .take(count as usize + 1)
    .throttle(Duration::from_secs(1));

    Sse::new(stream)
}

async fn bootstrap() -> Result<()> {
    let app = Router::new()
        .route("/hello", get(hello_axum))
        .route("/sse", get(get_sse_handler))
        .route("/sse", post(post_sse_handler));

    let addr = SocketAddr::new(Ipv4Addr::LOCALHOST.into(), 8080);
    let listener = TcpListener::bind(addr).await.unwrap();
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Unexpected error happened in server")
        .inspect_err(
            |e| tracing::error!(error.cause_chain = ?e, error.message = %e, "Unexpected error"),
        )
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM Signal handler")
            .recv()
            .await
            .expect("Failed to receive SIGTERM signal");
    };

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Ctrl-Cを受信しました。");
        },
        _ = terminate => {
            tracing::info!("SIGTERMを受信しました。");
        }
    }
}
