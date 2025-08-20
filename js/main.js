diff --git a//dev/null b/js/main.js
index 0000000000000000000000000000000000000000..ae061194da172d20cf483f4e915b9d9639a26ead 100644
--- a//dev/null
+++ b/js/main.js
@@ -0,0 +1,10 @@
+import './firebase.js';
+import { updateResourcePanel } from './ui.js';
+import { addXP } from './state.js';
+import { startPlacement } from './game.js';
+import './editor.js';
+import './auth.js';
+
+window.startPlacement = startPlacement;
+updateResourcePanel();
+addXP(0);
