"""
Serviço de reconhecimento facial usando facenet-pytorch (MTCNN + InceptionResnetV1).
Funciona no Windows sem compilação. Usa PyTorch CPU por padrão.
"""
import json
import io
import asyncio
from functools import partial
from typing import Optional
import numpy as np
from PIL import Image, ImageOps
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1

# Instâncias singleton (carregadas uma vez)
_mtcnn: Optional[MTCNN] = None
_resnet: Optional[InceptionResnetV1] = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

SIMILARITY_THRESHOLD = 0.7  # cosine similarity ≥ 0.7 = match


def _get_models() -> tuple[MTCNN, InceptionResnetV1]:
    global _mtcnn, _resnet
    if _mtcnn is None:
        _mtcnn = MTCNN(
            image_size=160,
            margin=20,
            min_face_size=20,
            thresholds=[0.4, 0.5, 0.5],
            keep_all=False,
            device=_device,
        )
    if _resnet is None:
        _resnet = InceptionResnetV1(pretrained="vggface2").eval().to(_device)
    return _mtcnn, _resnet


def _extract_encoding_sync(image_bytes: bytes) -> Optional[list]:
    """
    Extrai embedding facial de uma imagem.
    Retorna lista de 512 floats ou None se não detectar exatamente 1 rosto.
    """
    mtcnn, resnet = _get_models()

    image = Image.open(io.BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image)  # corrige rotação EXIF do celular
    image = image.convert("RGB")
    image = _resize_if_needed(image, max_dimension=1200)

    # Detecta e alinha o rosto
    face_tensor = mtcnn(image)

    if face_tensor is None:
        return None

    # Gera embedding
    with torch.no_grad():
        embedding = resnet(face_tensor.unsqueeze(0).to(_device))

    return embedding[0].cpu().numpy().tolist()


def _verify_face_sync(frame_bytes: bytes, stored_encoding_json: str) -> dict:
    """
    Compara rosto capturado com embedding armazenado.
    Retorna dict com match, confidence e distance.
    """
    mtcnn, resnet = _get_models()

    stored_vec = np.array(json.loads(stored_encoding_json), dtype=np.float32)

    image = Image.open(io.BytesIO(frame_bytes))
    image = ImageOps.exif_transpose(image)  # corrige rotação EXIF do celular
    image = image.convert("RGB")
    image = _resize_if_needed(image, max_dimension=1200)
    face_tensor = mtcnn(image)

    # Fallback: tenta com imagem espelhada (selfie iOS pode vir invertida)
    if face_tensor is None:
        face_tensor = mtcnn(image.transpose(Image.FLIP_LEFT_RIGHT))

    if face_tensor is None:
        return {"match": False, "reason": "no_face_detected", "confidence": None, "distance": None}

    with torch.no_grad():
        embedding = resnet(face_tensor.unsqueeze(0).to(_device))

    live_vec = embedding[0].cpu().numpy()

    # Similaridade coseno: 1.0 = idêntico, -1.0 = oposto
    dot = float(np.dot(stored_vec, live_vec))
    norm = float(np.linalg.norm(stored_vec) * np.linalg.norm(live_vec))
    similarity = dot / norm if norm > 0 else 0.0

    # Distância euclidiana normalizada como alternativa
    distance = float(np.linalg.norm(stored_vec - live_vec))

    match = similarity >= SIMILARITY_THRESHOLD

    return {
        "match": match,
        "confidence": round(similarity * 100, 1),
        "distance": round(distance, 4),
        "reason": None,
    }


def _resize_if_needed(image: Image.Image, max_dimension: int) -> Image.Image:
    w, h = image.size
    if max(w, h) > max_dimension:
        ratio = max_dimension / max(w, h)
        new_size = (int(w * ratio), int(h * ratio))
        return image.resize(new_size, Image.LANCZOS)
    return image


# ─── API assíncrona (roda PyTorch em thread pool para não bloquear o loop) ───

async def extract_encoding(image_bytes: bytes) -> Optional[list]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_extract_encoding_sync, image_bytes)
    )


async def verify_face(frame_bytes: bytes, stored_encoding_json: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_verify_face_sync, frame_bytes, stored_encoding_json)
    )
