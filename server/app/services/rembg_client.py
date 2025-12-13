from functools import lru_cache

from rembg import new_session, remove


@lru_cache(maxsize=1)
def get_session():
  return new_session(
    model_name="isnet-general-use",
    providers=["CPUExecutionProvider"],
  )


def remove_background(image_bytes: bytes) -> bytes:
  session = get_session()
  return remove(image_bytes, session=session, force_return_bytes=True)
