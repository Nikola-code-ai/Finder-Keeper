import threading

import numpy as np

from .config import settings


class Embeddings:
    def __init__(self):
        self._model = None
        self._lock = threading.RLock()
        self.error = None
        self.ready = False

    def warmup(self):
        with self._lock:
            if self.ready:
                return
            try:
                if settings.embedding_provider == "fastembed":
                    from fastembed import TextEmbedding
                    cache = settings.models_path
                    # A completed local model never needs a network request on subsequent starts.
                    locally_cached = settings.embedding_model == "BAAI/bge-small-en-v1.5" and any(cache.glob("models--Qdrant--bge-small-en-v1.5-onnx-Q/snapshots/*/model_optimized.onnx"))
                    self._model = TextEmbedding(
                        model_name=settings.embedding_model,
                        cache_dir=str(cache),
                        threads=2,
                        providers=["CPUExecutionProvider"],
                        local_files_only=locally_cached,
                    )
                else:
                    from google import genai
                    self._model = genai.Client(vertexai=True, project=settings.google_cloud_project, location=settings.gcp_location)
                self.ready = True
                self.error = None
            except Exception as exc:
                self.error = f"Embedding model could not load ({type(exc).__name__})"
                raise

    def embed(self, texts: list[str], query=False):
        self.warmup()
        with self._lock:
            if settings.embedding_provider == "fastembed":
                # The library default of 256 can allocate gigabytes for a long book.
                # Keep inference batches small on the shared local computer.
                vectors = list(self._model.query_embed(texts, batch_size=16) if query else self._model.passage_embed(texts, batch_size=16))
            else:
                from google.genai import types
                vectors = []
                # gemini-embedding-001 accepts one input per request; bounded worker count controls usage.
                for value in texts:
                    result = self._model.models.embed_content(
                        model=settings.embedding_model,
                        contents=value,
                        config=types.EmbedContentConfig(
                            task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT",
                            output_dimensionality=settings.embedding_dimensions,
                        ),
                    )
                    vectors.append(result.embeddings[0].values)
            matrix = np.asarray(vectors, dtype=np.float32)
            if matrix.shape != (len(texts), settings.embedding_dimensions):
                raise ValueError("Embedding model returned an unexpected dimension")
            matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)
            return matrix.tolist()


embeddings = Embeddings()
