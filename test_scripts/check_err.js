async function check() {
  const r = await fetch('http://localhost:3000');
  const text = await r.text();
  console.log("STATUS:", r.status);
  const idx = text.indexOf('"err"');
  if (idx !== -1) {
    console.log("ERR:", text.substring(idx, idx + 800));
  } else {
    console.log("FULL:", text.substring(0, 1000));
  }
}
check();
