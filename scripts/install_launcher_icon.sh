#!/usr/bin/env bash
set -euo pipefail
P=extracted/xiaomei-ai/app/src/main
mkdir -p "$P/res/drawable" "$P/res/mipmap-anydpi-v26"
cat > "$P/res/drawable/xiaomei_icon_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="28dp"/>
    <gradient android:angle="135" android:startColor="#FFD1E3" android:centerColor="#F9DDF0" android:endColor="#DCCEFF"/>
</shape>
EOF
cat > "$P/res/drawable/xiaomei_icon_fg.xml" <<'EOF'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#A86A72" android:pathData="M20,35 C13,27 17,15 27,13 C37,12 43,22 40,33 Z"/>
    <path android:fillColor="#F5B6C8" android:pathData="M25,28 C22,23 24,18 29,18 C34,19 36,24 33,29 Z"/>
    <path android:fillColor="#A86A72" android:pathData="M68,33 C65,22 72,12 82,13 C92,15 95,27 88,35 Z"/>
    <path android:fillColor="#F5B6C8" android:pathData="M75,28 C73,23 76,18 81,18 C86,19 87,24 83,29 Z"/>
    <path android:fillColor="#FFF0D9" android:pathData="M54,18 C33,18 19,34 19,56 C19,79 34,94 54,94 C74,94 89,79 89,56 C89,34 75,18 54,18 Z"/>
    <path android:fillColor="#68494B" android:pathData="M37,51 C37,48 40,46 43,46 C46,46 48,49 48,52 C48,55 46,57 43,57 C40,57 37,55 37,51 Z"/>
    <path android:fillColor="#68494B" android:pathData="M60,51 C60,48 63,46 66,46 C69,46 71,49 71,52 C71,55 69,57 66,57 C63,57 60,55 60,51 Z"/>
    <path android:fillColor="#FFF9F0" android:pathData="M43,68 C43,63 48,60 54,60 C60,60 65,63 65,68 C65,75 60,79 54,79 C48,79 43,75 43,68 Z"/>
    <path android:fillColor="#8D5960" android:pathData="M49,66 C49,63 52,62 54,62 C57,62 59,64 59,66 C59,69 56,70 54,70 C51,70 49,69 49,66 Z"/>
    <path android:fillColor="#8D5960" android:pathData="M53,70 L55,70 L55,75 C55,78 51,78 50,76 Z"/>
    <path android:fillColor="#F3A8BB" android:pathData="M25,65 C29,61 37,61 40,66 C42,71 37,75 32,74 C27,73 24,69 25,65 Z"/>
    <path android:fillColor="#F3A8BB" android:pathData="M68,66 C71,61 79,61 83,65 C84,69 81,73 76,74 C71,75 66,71 68,66 Z"/>
    <path android:fillColor="#E889AD" android:pathData="M72,20 C66,13 59,18 63,25 C57,32 67,36 72,28 C78,35 88,29 81,23 C87,15 77,12 72,20 Z"/>
    <path android:fillColor="#FFF7FA" android:pathData="M70,23 C72,20 76,21 76,24 C76,27 72,28 70,25 Z"/>
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
