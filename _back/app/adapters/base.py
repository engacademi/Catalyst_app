"""Source adapter protocol.

Every competition source (CSV today; AES, TIMU or MyTeam.click once access is authorized)
turns its own format into these normalized rows. Page code and the database never see a
vendor-specific shape.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol

IMPORT_KINDS = ("entries", "matches", "rosters")


@dataclass
class ParsedRow:
    row: int
    external_id: str
    data: dict[str, Any]
    errors: list[str] = field(default_factory=list)


@dataclass
class ParseResult:
    rows: list[ParsedRow]
    errors: list[str]
    warnings: list[str] = field(default_factory=list)


@dataclass
class Capabilities:
    name: str
    version: str
    kinds: tuple[str, ...]
    live: bool
    notes: str


class SourceAdapter(Protocol):
    def capabilities(self) -> Capabilities: ...

    def parse(self, kind: str, content: bytes, *, timezone: str, strict: bool) -> ParseResult: ...
