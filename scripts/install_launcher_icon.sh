#!/usr/bin/env bash
set -euo pipefail
P=extracted/xiaomei-ai/app/src/main
mkdir -p "$P/res/drawable" "$P/res/mipmap-anydpi-v26" "$P/res/values"
cat > "$P/res/drawable/xiaomei_icon_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="28dp"/>
    <gradient android:angle="135" android:startColor="#F9B8D2" android:centerColor="#F4C6E8" android:endColor="#BDAAF4"/>
</shape>
EOF
cat > "$P/res/drawable/xiaomei_icon_fg.xml" <<'EOF'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#FFFFFC" android:pathData="M25,24 C25,19 29,15 34,15 L74,15 C79,15 83,19 83,24 L83,59 C83,64 79,68 74,68 L52,68 L37,81 C34,84 29,82 29,77 L29,67 C26,65 25,62 25,58 Z"/>
    <path android:fillColor="#F17DAA" android:pathData="M54,56 C51,53 40,46 40,38 C40,29 51,26 56,34 C61,26 72,29 72,38 C72,46 61,53 58,56 C57,57 55,57 54,56 Z"/>
    <path android:fillColor="#D6A2F2" android:pathData="M78,72 L81,64 L84,72 L92,75 L84,78 L81,86 L78,78 L70,75 Z"/>
    <path android:fillColor="#FFFFFF" android:pathData="M27,83 L29,78 L31,83 L36,85 L31,87 L29,92 L27,87 L22,85 Z"/>
    <path android:fillColor="#FFFFFF" android:pathData="M80,24 L82,19 L84,24 L89,26 L84,28 L82,33 L80,28 L75,26 Z"/>
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
p=Path("extracted/xiaomei-ai/app/src/main/AndroidManifest.xml")
s=p.read_text()
s=s.replace('android:label="小美AI" android:allowBackup="false"',
            'android:label="小美AI" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher" android:allowBackup="false"')
p.write_text(s)
PY
