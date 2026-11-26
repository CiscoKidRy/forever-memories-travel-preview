import re
from pathlib import Path

root = Path(__file__).resolve().parent
app = (root / "app.py").read_text(encoding="utf-8")
schema = (root / "schema.sql").read_text(encoding="utf-8")
migration = (root / "source-url-test-path.sql").read_text(encoding="utf-8")

expected = (
    'r"^(?:https://preview\\.forevermemoriestravel\\.com|'
    'https://forevermemoriestravel\\.com/test)(/[^\\s]*)?$"'
)
if expected not in app:
    raise SystemExit("app.py source pattern drifted")
if '"https://forevermemoriestravel.com"' not in app:
    raise SystemExit("apex origin missing")
if "https://inquiries.forevermemoriestravel.com" in app.split("ALLOWED_ORIGINS", 1)[1].split("}", 1)[0]:
    raise SystemExit("live inquiry host was added as an origin")

pattern = re.compile(
    r"^(?:https://preview\.forevermemoriestravel\.com|https://forevermemoriestravel\.com/test)(/[^\s]*)?$"
)
cases = {
    "https://preview.forevermemoriestravel.com/": True,
    "https://preview.forevermemoriestravel.com/contact.html": True,
    "https://forevermemoriestravel.com/test": True,
    "https://forevermemoriestravel.com/test/": True,
    "https://forevermemoriestravel.com/test/contact.html": True,
    "https://forevermemoriestravel.com/test/index.html": True,
    "https://forevermemoriestravel.com/": False,
    "https://forevermemoriestravel.com/family.html": False,
    "https://forevermemoriestravel.com/testing": False,
    "https://www.forevermemoriestravel.com/test/": False,
    "https://forevermemoriestravel.com/test.html": False,
}
for url, ok in cases.items():
    matched = pattern.match(url) is not None
    if matched != ok:
        raise SystemExit(f"{url} expected {ok} got {matched}")

for body, label in ((schema, "schema"), (migration, "migration")):
    if "forevermemoriestravel\\.com/test" not in body:
        raise SystemExit(f"{label} missing test path check")
    if "preview\\.forevermemoriestravel\\.com" not in body:
        raise SystemExit(f"{label} missing preview host check")

print("source url checks passed")
