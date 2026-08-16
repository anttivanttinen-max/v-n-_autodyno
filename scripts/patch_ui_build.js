const fs=require('fs');
let s=fs.readFileSync('index.html','utf8');
s=s.replace(/<script src="\.\/version\.js\?build=[^"]+"><\/script>/,'<script src="./version.js?build=2026-08-16i"></script>');
s=s.replace(/navigator\.serviceWorker\.register\("\.\/sw\.js\?build=[^"]+"/g,'navigator.serviceWorker.register("./sw.js?build=2026-08-16i"');
fs.writeFileSync('index.html',s);
