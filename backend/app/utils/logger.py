import io
import logging
import sys


def setup_logger(name: str = "dataflow", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level)

    # Windows'ta cp1252 encoding sorununu önlemek için UTF-8 stream kullan
    if sys.platform == "win32" and hasattr(sys.stdout, "buffer"):
        utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    else:
        utf8_stdout = sys.stdout

    handler = logging.StreamHandler(utf8_stdout)
    handler.setLevel(level)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


logger = setup_logger()
