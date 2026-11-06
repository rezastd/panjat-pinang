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

## ✨ Realism Upgrade

- Renderer: `ACESFilmicToneMapping` (exposure 1.1), sRGB, `PCFSoftShadowMap`; warm afternoon sun + hemisphere + ambient bounce
- Sky: gradient dome + drifting low-poly clouds; distant tree/house/tent silhouette ring
- Ground: multi-layer canvas texture (base, patches, 2400+ speckles) with roughness variation; instanced grass tufts (220), stones, glossy mud pits with expanding ripple rings on splash/landing
- Pole: areca wood-grain canvas texture (vertical streaks, knots), grease bands with drip-streak texture + clearcoat sheen/specular; areca leaf crown (bent frond planes); detailed hanging prizes (bicycle torus wheels + frame, TV screen, fan blades, kettle) that sway/rotate
- Climbers: articulated groups (shoulder/elbow/hip/knee pivots), varied skin tones/shirt/shorts, eyes, cap-or-hair variation; 3-person pyramid (top/mid/base roles); grip arms wrap pole, legs clamp; torso lean + head bob tied to velocity/effort; stamina scales arm-reach speed
- Flags/bunting: red-white waving plane geometry (per-vertex sine wave)
- Feedback: grease-splash burst + dust on slip, pole wobble, subtle camera shake on player stumble, confetti on win; capped/reused particle buffers and temp vectors for 60 fps

## ✨ Features

- Three.js 0.160 (CDN importmap): hemisphere + shadowed directional sun, night-lamp point light, fog, canvas ground texture, clearcoat "grease sheen" PBR material on the pinang trunk
- Animated low-poly climbers (3 stacked per team), cheering crowd ring, waving flags
- Red-white 17 Agustus decor: entrance gate + "MERDEKA!" banner, bunting triangles, big & mini Indonesian flags
- HUD (timer, position, progress %, stamina, grip, balance, height), grease-zone warning, bilingual start/win overlays
- WebAudio oscillator SFX (climb squeaks, slip, warnings, win fanfare) — zero assets
- Confetti + mud-dust particles, mud pit base, prize tree (TV/kulkas/beras/sepeda/HP/kipas boxes + bike frame)
- Touch buttons for mobile, follow/orbit camera toggle
- 2 AI opponents with varied speed and random slips; win/lose detection + results table + restart

## Realism pass 2

- **Image-based lighting:** sky + sun + earth bounce prefiltered with
  `PMREMGenerator`; the greased poles now reflect the sky through their
  clearcoat instead of a constant highlight.
- **Procedural normal maps:** ground, bark and grease get Sobel normals.
- **Grease:** soft alpha-mapped smears with irregular drip edges and a
  wet clearcoat, rather than hard tape-like bands.
- **Shadows:** 2048 PCFSoft, blurred, normal-biased; long late-afternoon
  pole shadows.
- **Anatomy:** rounded torso/shorts, capsule limbs, hands, feet, neck,
  shoes; the crowd now has legs, shoes and waving arms.
- **AI realism:** teams have their own stamina — they slow as they tire
  and take short rests, so a steady player can come back.
- **Atmosphere:** macro ground variation (kills tiling), higher clouds,
  wind gusts, birds, drifting leaves, soft particles.
- **Ambience:** synthesised wind / crowd / cicadas; `M` mutes.
- **Camera:** pulled back and raised so a 13 m pole reads as a pole.


## 📁 Files

- `index.html` — scene canvas, HUD, overlays, touch controls, importmap
- `main.js` — all game code (scene, physics, AI, audio, particles)
- `style.css` — HUD/overlay/touch styling
- `README.md` — this file

## 🛠 Tech

Three.js via unpkg importmap (`three@0.160.0`), plain ES modules, no npm.
