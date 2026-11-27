#!/usr/bin/env bash
set -euo pipefail
P=extracted/xiaomei-ai/app/src/main
mkdir -p "$P/res/drawable" "$P/res/mipmap-anydpi-v26"
cat > "$P/res/drawable/xiaomei_icon_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="28dp"/>
    <solid android:color="#FFF3F8"/>
</shape>
EOF
cat > "$P/res/drawable/xiaomei_icon_fg.xml" <<'EOF'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#F05B9B" android:pathData="M54,91 C47,84 17,64 17,40 C17,24 29,15 42,18 C49,19 53,24 54,29 C58,21 65,17 74,18 C88,19 96,31 93,45 C90,63 68,82 54,91 Z"/>
    <path android:fillColor="#FFFFF2" android:pathData="M32,34 C36,28 44,28 48,33 C51,37 50,42 47,46 C42,40 36,38 32,34 Z"/>
</vector>
EOF
cat > "$P/res/mipmap-anydpi-v26/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/xiaomei_icon_bg"/>
    <foreground android:drawable="@drawable/xiaomei_icon_fg"/>
</adaptive-icon>
EOF
python3 - <<'PY'
from pathlib import Path
import re
p=Path("extracted/xiaomei-ai/app/src/main/AndroidManifest.xml")
s=p.read_text()
s=re.sub(r'<application\b([^>]*)>', lambda m: '<application'+m.group(1).replace('android:icon="@mipmap/ic_launcher"','').replace('android:roundIcon="@mipmap/ic_launcher"','')+' android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher">', s, count=1)
p.write_text(s)
PY
