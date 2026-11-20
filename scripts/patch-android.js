// Run after `npx cap add android`: adds the launcher icons, locks landscape and hides the system bars (full screen).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const main = path.join(root, 'android', 'app', 'src', 'main');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

// 1. launcher icons
copyDir(path.join(root, 'android-res'), res);
console.log('icons copied');

// 2. landscape + keep running through config changes
const manifestPath = path.join(main, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('screenOrientation')) {
  manifest = manifest.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
}
fs.writeFileSync(manifestPath, manifest);
console.log('manifest patched');

// 3. immersive full screen
const javaDir = path.join(main, 'java');
let javaFile = null;
(function find(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) find(p); else if (f.name === 'MainActivity.java') javaFile = p;
  }
})(javaDir);
if (!javaFile) throw new Error('MainActivity.java not found');
const pkg = /package\s+([\w.]+);/.exec(fs.readFileSync(javaFile, 'utf8'))[1];
fs.writeFileSync(javaFile, `package ${pkg};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    private void hideBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);
console.log('MainActivity patched (' + pkg + ')');
