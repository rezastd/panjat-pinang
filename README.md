# 🇮🇩 Panjat Pinang 3D — Simulator Lomba 17 Agustus

Realistic 3D browser simulator of **Panjat Pinang** (greased-pole climb), the iconic Indonesian Independence Day game. No build step — just static files + CDN.

## ▶️ Run / Cara menjalankan

```bash
cd panjat-pinang
python3 -m http.server 8000
# then open: http://localhost:8000
```

> `file://` won't work (ES modules + CDN importmap require http). Any static server works.

## 🎮 Controls / Kontrol

| Input | ID | EN |
|---|---|---|
| `SPACE` (mash repeatedly) / `▲ PANJAT` button | Memanjat (menguras stamina) | Shinny up (drains stamina) |
| `A`/`D` or `←`/`→` / `◀ ▶` buttons | Jaga keseimbangan | Shift weight / balance |
| Mouse drag / `🎥` button | Orbit bebas / kamera ikuti | Free orbit / follow cam |
| `Enter` | Restart setelah selesai | Restart after game over |

**Rules:** reach the prize wheel at 13 m before the 2 rival AI teams and before the 2:00 timer. Greasy yellow zones drain grip and push your balance — if the balance marker hits the edge you slip down. Rest (stop mashing) to recover stamina.

## ✨ Features

- Three.js 0.160 (CDN importmap): hemisphere + shadowed directional sun, night-lamp point light, fog, canvas ground texture, clearcoat "grease sheen" PBR material on the pinang trunk
- Animated low-poly climbers (3 stacked per team), cheering crowd ring, waving flags
- Red-white 17 Agustus decor: entrance gate + "MERDEKA!" banner, bunting triangles, big & mini Indonesian flags
- HUD (timer, position, progress %, stamina, grip, balance, height), grease-zone warning, bilingual start/win overlays
- WebAudio oscillator SFX (climb squeaks, slip, warnings, win fanfare) — zero assets
- Confetti + mud-dust particles, mud pit base, prize tree (TV/kulkas/beras/sepeda/HP/kipas boxes + bike frame)
- Touch buttons for mobile, follow/orbit camera toggle
- 2 AI opponents with varied speed and random slips; win/lose detection + results table + restart

## 📁 Files

- `index.html` — scene canvas, HUD, overlays, touch controls, importmap
- `main.js` — all game code (scene, physics, AI, audio, particles)
- `style.css` — HUD/overlay/touch styling
- `README.md` — this file

## 🛠 Tech

Three.js via unpkg importmap (`three@0.160.0`), plain ES modules, no npm.
