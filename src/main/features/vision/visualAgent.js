'use strict';
// FahOS — Visual Mouse & Screen Agent (Computer Use)
// 100% In-Memory Screen Capture + Gemini 3.6 Flash Coordinate Detection + Native Mouse Mover
// Zero persistent disk image storage — 100% ephemeral privacy.

const http = require('http');
const https = require('https');
const { exec } = require('child_process');

let screenCapturer = null;

function setScreenCapturer(fn) {
  screenCapturer = fn;
}

// 1. Capture Screen strictly in-memory
async function captureScreenInMemory() {
  if (typeof screenCapturer === 'function') {
    try {
      const b64 = await screenCapturer();
      if (b64) return b64;
    } catch (e) {
      console.warn('[FahOS Visual Agent] Capturer notice:', e.message);
    }
  }

  // Fallback to in-memory PowerShell GDI capture (zero disk files)
  return new Promise((resolve, reject) => {
    const ps = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height",
      "$g = [System.Drawing.Graphics]::FromImage($bmp)",
      "$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)",
      "$ms = New-Object System.IO.MemoryStream",
      "$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)",
      "$b64 = [Convert]::ToBase64String($ms.ToArray())",
      "$g.Dispose()",
      "$bmp.Dispose()",
      "$ms.Dispose()",
      "[Console]::Out.Write($b64)"
    ].join('; ');

    exec(`powershell.exe -NoProfile -Command "${ps}"`, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const b64 = stdout.trim();
      if (!b64) return reject(new Error('Failed to capture in-memory screen'));
      resolve(b64);
    });
  });
}

// 2. Query Gemini 3.6 Flash to locate target button/element coordinates
function locateTargetOnScreen(base64Image, targetDescription, apiKey) {
  return new Promise((resolve, reject) => {
    const prompt = [
      `Analyze this screenshot of the user's computer screen.`,
      `Find the exact location of: "${targetDescription}".`,
      `Return ONLY a JSON object with the pixel coordinates on the image to click:`,
      `{"found": true, "x": <integer_pixel_x>, "y": <integer_pixel_y>, "label": "<name_of_element>"}`,
      `If the element cannot be found on this screen, return:`,
      `{"found": false, "reason": "Not visible on screen"}`
    ].join('\n');

    const payload = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = JSON.parse(rawText);
          resolve(parsed);
        } catch (e) {
          resolve({ found: false, error: 'Could not parse response: ' + data.slice(0, 150) });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// 3. Move Native Windows Mouse & Click
function moveAndClick(x, y) {
  return new Promise((resolve) => {
    console.log(`\n======================================================`);
    console.log(`[FahOS Visual Agent] Moving mouse to (${x}, ${y}) and clicking...`);
    console.log(`======================================================`);

    const ps = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name U32 -Namespace W",
      `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})`,
      "Start-Sleep -Milliseconds 60",
      "[W.U32]::mouse_event(2, 0, 0, 0, 0)", // MouseDown
      "Start-Sleep -Milliseconds 80",
      "[W.U32]::mouse_event(4, 0, 0, 0, 0)", // MouseUp
      "Start-Sleep -Milliseconds 60",
      "[W.U32]::mouse_event(2, 0, 0, 0, 0)", // Second click to guarantee window focus & item open
      "Start-Sleep -Milliseconds 80",
      "[W.U32]::mouse_event(4, 0, 0, 0, 0)"
    ].join('; ');

    const encodedScript = Buffer.from(ps, 'utf16le').toString('base64');

    exec(`powershell.exe -NoProfile -EncodedCommand ${encodedScript}`, (err) => {
      if (err) {
        console.warn(`[FahOS Visual Agent] Mouse notice:`, err.message);
        resolve({ ok: false, error: err.message });
      } else {
        console.log(`[FahOS Visual Agent] [Success] Clicked target successfully at (${x}, ${y})`);
        resolve({ ok: true, x, y });
      }
    });
  });
}

// 4. End-to-End Visual Mouse Click Pipeline
async function clickTarget(targetDescription, apiKey) {
  console.log(`[FahOS Visual Agent] Snapping screen (in-memory, no disk storage)...`);
  const base64Image = await captureScreenInMemory();

  console.log(`[FahOS Visual Agent] Asking Gemini Vision (gemini-3.6-flash) to locate: "${targetDescription}"...`);
  const loc = await locateTargetOnScreen(base64Image, targetDescription, apiKey);

  if (loc && loc.found && typeof loc.x === 'number' && typeof loc.y === 'number') {
    await moveAndClick(loc.x, loc.y);
    return {
      ok: true,
      found: true,
      x: loc.x,
      y: loc.y,
      label: loc.label || targetDescription,
      description: `Located and clicked **${loc.label || targetDescription}** at screen coordinates (${loc.x}, ${loc.y}).`
    };
  } else {
    return {
      ok: false,
      found: false,
      description: `Could not visually locate "${targetDescription}" on your current screen.`
    };
  }
}

// 5. Crop Screen Region strictly in-memory (Zero disk writes, High-DPI display scale aware)
async function cropScreenRegion(opts = {}) {
  return new Promise((resolve, reject) => {
    const { x, y, width, height, logicalBounds } = opts;
    let scaleFactor = 1.0;
    try {
      const electron = require('electron');
      if (electron && electron.screen) {
        scaleFactor = electron.screen.getPrimaryDisplay().scaleFactor || 1.0;
      }
    } catch (_) {}

    const bounds = logicalBounds || { x, y, width, height };
    const rawX = (typeof bounds.x === 'number' && !isNaN(bounds.x)) ? bounds.x : 0;
    const rawY = (typeof bounds.y === 'number' && !isNaN(bounds.y)) ? bounds.y : 0;
    const rawW = (typeof bounds.width === 'number' && !isNaN(bounds.width)) ? bounds.width : 100;
    const rawH = (typeof bounds.height === 'number' && !isNaN(bounds.height)) ? bounds.height : 100;

    // Convert logical CSS bounds to physical screen pixels for high-DPI displays
    const safeX = Math.max(0, Math.floor(rawX * scaleFactor));
    const safeY = Math.max(0, Math.floor(rawY * scaleFactor));
    const safeW = Math.max(10, Math.floor(rawW * scaleFactor));
    const safeH = Math.max(10, Math.floor(rawH * scaleFactor));

    const ps = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "$fullBmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height",
      "$g = [System.Drawing.Graphics]::FromImage($fullBmp)",
      "$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)",
      `$rx = [Math]::Min(${safeX}, $screen.Width - 5)`,
      `$ry = [Math]::Min(${safeY}, $screen.Height - 5)`,
      `$rw = [Math]::Min(${safeW}, $screen.Width - $rx)`,
      `$rh = [Math]::Min(${safeH}, $screen.Height - $ry)`,
      "$cropRect = New-Object System.Drawing.Rectangle $rx, $ry, $rw, $rh",
      "$croppedBmp = $fullBmp.Clone($cropRect, $fullBmp.PixelFormat)",
      
      "$maxDim = 1200",
      "if ($croppedBmp.Width -gt $maxDim -or $croppedBmp.Height -gt $maxDim) {",
      "    $scale = [Math]::Min($maxDim / $croppedBmp.Width, $maxDim / $croppedBmp.Height)",
      "    $newW = [int]($croppedBmp.Width * $scale)",
      "    $newH = [int]($croppedBmp.Height * $scale)",
      "    $scaledBmp = New-Object System.Drawing.Bitmap $newW, $newH",
      "    $sg = [System.Drawing.Graphics]::FromImage($scaledBmp)",
      "    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear",
      "    $sg.DrawImage($croppedBmp, 0, 0, $newW, $newH)",
      "    $sg.Dispose()",
      "    $croppedBmp.Dispose()",
      "    $croppedBmp = $scaledBmp",
      "}",
      
      "$ms = New-Object System.IO.MemoryStream",
      "$croppedBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)",
      "$b64 = [Convert]::ToBase64String($ms.ToArray())",
      "$g.Dispose()",
      "$fullBmp.Dispose()",
      "$croppedBmp.Dispose()",
      "$ms.Dispose()",
      "[Console]::Out.Write($b64)"
    ].join('; ');

    exec(`powershell.exe -NoProfile -Command "${ps}"`, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const b64 = stdout.trim();
      if (!b64) return reject(new Error('Failed to capture cropped screen region'));
      resolve(b64);
    });
  });
}

// 6. Multimodal Visual Reasoning on cropped image + user prompt
function analyzeImageWithPrompt(base64Image, userPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const promptText = userPrompt && userPrompt.trim()
      ? `The user has snipped this region of their computer screen with the following question/request:\n"${userPrompt.trim()}"\n\nCarefully analyze the image and answer the user's request directly, concisely, and in simple, human-friendly terms that any normal person can easily understand.\n\nCRITICAL FORMATTING & EXPLANATION RULES:\n1. EXPLAIN LIKE I'M 5: Explain complex concepts simply and intuitively using everyday real-world examples before jumping into technical details.\n2. NO RAW LATEX: NEVER output raw LaTeX markup or code blocks (do NOT write \\begin{pmatrix}, \\mathbf, \\frac, \\quad, etc.). Write all math, vectors, and calculations in clean, readable plain text (e.g., [3, 7] · [9, 5] = (3 × 9) + (7 × 5) = 62).\n3. CLEAR & SCANNABLE: Use short paragraphs, clear bullet points, and bold headers so it is easy and comfortable to read.`
      : `The user has snipped this region of their computer screen.\n\nPlease analyze it and explain what is visible in simple, human-friendly terms that any normal person can easily understand:\n1. Explain what is on the screen in plain English using simple, relatable language.\n2. If it contains data science, math, or technical formulas, explain what they mean in everyday life using a real-world analogy. NEVER use raw LaTeX syntax (do NOT write \\begin{pmatrix}, \\mathbf, \\frac, etc.)—use clean, readable plain text instead.\n3. If it is code or an error message, explain the issue in plain terms and give a simple 2-3 step fix.\n4. Summarize the key takeaways in 2-3 clean bullet points.`;

    const payload = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    });

    const modelCandidates = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

    (async () => {
      let lastErr = null;
      for (const modelName of modelCandidates) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const resultText = await new Promise((resResolve, resReject) => {
            const req = https.request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            }, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const json = JSON.parse(data);
                  if (json.error) {
                    const errMsg = json.error.message || 'Gemini Vision API error';
                    return resReject(new Error(errMsg));
                  }
                  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    resResolve(text);
                  } else {
                    resReject(new Error('No text in response'));
                  }
                } catch (e) {
                  resReject(e);
                }
              });
            });
            req.on('error', resReject);
            req.write(payload);
            req.end();
          });
          return resolve(resultText);
        } catch (err) {
          console.warn(`[FahOS Visual Agent] Cloud model ${modelName} notice:`, err.message);
          lastErr = err;
        }
      }

      // 2-4. Try Local Ollama Vision Models (qwen3-vl:8b -> gemma3:12b -> llava:13b -> llava)
      const localOllamaModels = ['qwen3-vl:8b', 'gemma3:12b', 'llava:13b', 'llava'];
      for (const ollamaModel of localOllamaModels) {
        try {
          const ollamaRes = await new Promise((oRes, oRej) => {
            const body = JSON.stringify({
              model: ollamaModel,
              prompt: promptText,
              images: [base64Image],
              stream: false
            });
            const req = http.request('http://127.0.0.1:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            }, (res) => {
              let d = '';
              res.on('data', c => d += c);
              res.on('end', () => {
                try {
                  const j = JSON.parse(d);
                  if (j.response) oRes(j.response);
                  else oRej(new Error('No response from Ollama'));
                } catch (e) { oRej(e); }
              });
            });
            req.on('error', oRej);
            req.write(body);
            req.end();
          });
          if (ollamaRes) return resolve(`💻 **[Local Vision: ${ollamaModel}]**\n\n` + ollamaRes);
        } catch (_) {}
      }

      resolve(`⚠️ **Gemini Vision Service Busy**\n\nThe Gemini Vision API is currently experiencing temporary high demand. Please try again in a few moments.`);
    })();
  });
}

module.exports = {
  setScreenCapturer,
  captureScreenInMemory,
  cropScreenRegion,
  analyzeImageWithPrompt,
  locateTargetOnScreen,
  moveAndClick,
  clickTarget
};
