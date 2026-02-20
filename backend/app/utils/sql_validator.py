"""
SQL güvenlik doğrulama yardımcıları.
- Tehlikeli MSSQL komutlarını engeller.
- Tablo/şema adlarını bracket escaping ile güvence altına alır.
"""
from __future__ import annotations

import re

# ── Tehlikeli SQL komutları / ifadeleri (case-insensitive) ────────────────────
_DANGEROUS_PATTERNS: list[tuple[str, str]] = [
    (r"\bxp_cmdshell\b", "xp_cmdshell"),
    (r"\bsp_configure\b", "sp_configure"),
    (r"\bsp_OACreate\b", "sp_OACreate"),
    (r"\bsp_OAMethod\b", "sp_OAMethod"),
    (r"\bOPENROWSET\b", "OPENROWSET"),
    (r"\bOPENDATASOURCE\b", "OPENDATASOURCE"),
    (r"\bOPENQUERY\b", "OPENQUERY"),
    (r"\bBULK\s+INSERT\b", "BULK INSERT"),
    (r"\bSHUTDOWN\b", "SHUTDOWN"),
    (r"\bRECONFIGURE\b", "RECONFIGURE"),
    (r"\bEXEC\s*\(\s*@", "Dinamik EXEC(@...)"),
    (r"\bEXECUTE\s*\(\s*@", "Dinamik EXECUTE(@...)"),
]

_COMPILED_PATTERNS = [
    (re.compile(pat, re.IGNORECASE), desc) for pat, desc in _DANGEROUS_PATTERNS
]

# ── Geçerli tablo / şema adı regex'i ─────────────────────────────────────────
_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_@#$]{0,127}$")


class DangerousSQLError(Exception):
    """Tehlikeli SQL komutu tespit edildiğinde fırlatılır."""
    pass


def validate_sql(sql: str) -> None:
    """
    SQL metnini tehlikeli komutlar açısından kontrol eder.
    Tehlikeli komut bulunursa DangerousSQLError fırlatır.
    """
    for pattern, description in _COMPILED_PATTERNS:
        if pattern.search(sql):
            raise DangerousSQLError(
                f"Güvenlik ihlali: SQL sorgusunda yasaklı komut tespit edildi — {description}"
            )


def validate_identifier(name: str) -> bool:
    """Tablo veya şema adının geçerli bir SQL identifier olup olmadığını kontrol eder."""
    return bool(_IDENTIFIER_RE.match(name))


def safe_table_reference(schema: str | None, table: str) -> str:
    """
    Şema ve tablo adını bracket escaping ile güvenli hale getirir.
    İçerideki ] karakterleri ]] ile escape edilir (MSSQL standardı).
    """
    escaped_table = table.replace("]", "]]")
    if schema:
        escaped_schema = schema.replace("]", "]]")
        return f"[{escaped_schema}].[{escaped_table}]"
    return f"[{escaped_table}]"
