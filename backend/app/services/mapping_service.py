"""
Column mapping ve transform servisi.

Workflow node config'inden ColumnMapping listesi alır,
chunk halinde gelen satır listesini dönüştürür.
Belleğe tüm veriyi yüklemez; her chunk ayrı işlenir.
"""
from __future__ import annotations

from typing import Any, Optional
import logging

logger = logging.getLogger("dataflow")


# ─── Veri tipi dönüştürücüler ──────────────────────────────────────────────

def _cast_value(value: Any, cast_to: str) -> Any:
    """
    Değeri hedef DataType'a dönüştürür.
    DataType: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'timestamp'
    """
    import decimal as _decimal
    import datetime as _dt

    if value is None:
        return None

    try:
        if cast_to == "string":
            if isinstance(value, (_dt.datetime, _dt.date, _dt.time)):
                return value.isoformat()
            return str(value)

        if cast_to == "integer":
            if isinstance(value, bool):
                return int(value)
            if isinstance(value, _decimal.Decimal):
                return int(value)
            # "20231205" gibi sayı formatındaki tarihi integer'a çevirme — str yap
            return int(float(str(value)))

        if cast_to == "float":
            if isinstance(value, bool):
                return float(int(value))
            if isinstance(value, _decimal.Decimal):
                return float(value)
            return float(str(value))

        if cast_to == "boolean":
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float, _decimal.Decimal)):
                return bool(int(value))
            return str(value).lower() in ("1", "true", "yes", "t", "on")

        if cast_to == "date":
            if isinstance(value, _dt.datetime):
                return value.date().isoformat()   # "2023-12-05"
            if isinstance(value, _dt.date):
                return value.isoformat()
            # "20231205" integer → ISO tarih
            s = str(value).strip()
            if s.isdigit() and len(s) == 8:
                return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
            return s  # Zaten "2023-12-05" formatındaysa

        if cast_to in ("datetime", "timestamp"):
            if isinstance(value, (_dt.datetime, _dt.date)):
                return value.isoformat()
            return str(value)

    except (ValueError, TypeError, OverflowError):
        return value  # Dönüşüm başarısız → orijinal değer

    return value


# ─── Tek sütun transform ───────────────────────────────────────────────────

def apply_transforms(value: Any, transforms: list[dict]) -> Any:
    for t in transforms:
        t_type = t.get("type")
        if t_type == "cast":
            value = _cast_value(value, t.get("cast_to", "string"))
        elif t_type == "default":
            if value is None or (isinstance(value, str) and value.strip() == ""):
                value = t.get("default_value")
        elif t_type == "expression":
            # Basit expression: sabit değer veya SQL-style (ileride genişletilebilir)
            expr = t.get("expression", "")
            if expr.startswith("'") and expr.endswith("'"):
                value = expr[1:-1]
            elif expr.isdigit():
                value = int(expr)
            # Daha karmaşık expression'lar execution katmanında ele alınacak
    return value


# ─── Chunk dönüştürme ──────────────────────────────────────────────────────

def apply_column_mappings(
    rows: list[dict[str, Any]],
    column_mappings: list[dict],
) -> list[dict[str, Any]]:
    """
    Verilen mapping listesine göre bir chunk'ı dönüştürür.

    column_mappings her eleman:
        {
            "source_column": "src_col",
            "target_column": "dst_col",
            "transforms": [...],   # opsiyonel
            "skip": false          # true ise bu kolon atlanır
        }

    Mapping yoksa kaynak satır aynen geçer.
    """
    if not column_mappings:
        return rows

    result = []
    for row in rows:
        new_row: dict[str, Any] = {}
        for mapping in column_mappings:
            if mapping.get("skip"):
                continue
            src = mapping.get("source_column", "")
            tgt = mapping.get("target_column", src)
            value = row.get(src)
            transforms = mapping.get("transforms") or []
            if transforms:
                value = apply_transforms(value, transforms)
            new_row[tgt] = value
        result.append(new_row)
    return result


def apply_filter(
    rows: list[dict[str, Any]],
    condition: str,
) -> list[dict[str, Any]]:
    """
    Basit eşitlik/karşılaştırma filtresi.
    Desteklenen format: "column operator value"
      operators: =, !=, >, <, >=, <=, LIKE (basit prefix/suffix * wildcard)

    Karmaşık SQL WHERE ifadeleri execution motorunda ele alınacak.
    """
    if not condition or not condition.strip():
        return rows

    import re
    parts = re.split(r"\s+", condition.strip(), maxsplit=2)
    if len(parts) != 3:
        logger.warning("Geçersiz filtre koşulu, atlanıyor: %s", condition)
        return rows

    col, op, raw_val = parts
    # Tırnak temizle
    val_str = raw_val.strip("'\"")

    def match(row: dict[str, Any]) -> bool:
        cell = row.get(col)
        if cell is None:
            return False
        cell_str = str(cell)
        if op == "=":
            return cell_str == val_str
        if op == "!=":
            return cell_str != val_str
        if op == "LIKE":
            pattern = val_str.replace("*", "")
            if val_str.startswith("*") and val_str.endswith("*"):
                return pattern in cell_str
            if val_str.startswith("*"):
                return cell_str.endswith(pattern)
            if val_str.endswith("*"):
                return cell_str.startswith(pattern)
            return cell_str == val_str
        try:
            cell_n = float(str(cell))
            val_n = float(val_str)
            if op == ">":
                return cell_n > val_n
            if op == "<":
                return cell_n < val_n
            if op == ">=":
                return cell_n >= val_n
            if op == "<=":
                return cell_n <= val_n
        except ValueError:
            pass
        return False

    return [r for r in rows if match(r)]


# ─── Node config yardımcıları ──────────────────────────────────────────────

def get_source_query(node_config: dict) -> Optional[str]:
    """Source node'un kullanacağı SQL sorgusunu döner."""
    query = node_config.get("query")
    if query:
        return query
    schema = node_config.get("schema")
    table = node_config.get("table")
    if table:
        full_table = f"{schema}.{table}" if schema else table
        return f"SELECT * FROM {full_table}"
    return None
